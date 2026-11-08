jest.mock('../lib/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../lib/config', () => ({
  supabase: { channel: jest.fn(), removeChannel: jest.fn() },
}));

import { apiClient } from '../lib/api';
import { supabase } from '../lib/config';
import { MobileChatService } from './chat';

const api = apiClient as unknown as { get: jest.Mock; post: jest.Mock };
const realtime = supabase as unknown as {
  channel: jest.Mock;
  removeChannel: jest.Mock;
};

const history = (messages: unknown[] = [], conversationId = 'conversation-1') => ({
  data: { messages, conversationId }, error: null, status: 200,
});

const rawMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'message-1',
  trip_id: 'trip-1',
  sender_id: 'user-1',
  content: 'Hello',
  type: 'text',
  metadata: {},
  read_by: [],
  created_at: '2026-11-08T00:00:00.000Z',
  sender: { full_name: 'Rider' },
  ...overrides,
});

describe('MobileChatService API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    realtime.removeChannel.mockResolvedValue('ok');
  });

  it('loads the canonical chat API response and returns chronological messages', async () => {
    api.get.mockResolvedValue(history([
      rawMessage({ id: 'newer', created_at: '2026-11-08T00:02:00.000Z' }),
      rawMessage({ id: 'older', created_at: '2026-11-08T00:01:00.000Z' }),
    ]));

    const messages = await new MobileChatService().getMessages('trip-1', 200);

    expect(api.get).toHaveBeenCalledWith('/v1/chat/trips/trip-1/messages?limit=100');
    expect(messages.map(message => message.id)).toEqual(['older', 'newer']);
    expect(messages[0]).toMatchObject({ tripId: 'trip-1', senderId: 'user-1', senderName: 'Rider' });
  });

  it('sends bounded content and preserves supported message metadata', async () => {
    api.post.mockResolvedValue({ data: { message: rawMessage({ id: 'sent-1', content: 'Ready' }) }, error: null, status: 201 });

    const message = await new MobileChatService().sendMessage({
      tripId: 'trip-1', content: '  Ready  ', type: 'location', metadata: { lat: 31.95, lng: 35.93 },
    });

    expect(api.post).toHaveBeenCalledWith('/v1/chat/trips/trip-1/messages', {
      content: 'Ready', type: 'location', metadata: { lat: 31.95, lng: 35.93 },
    });
    expect(message).toMatchObject({ id: 'sent-1', content: 'Ready', tripId: 'trip-1' });
  });

  it('does not make a request for empty messages and propagates API errors', async () => {
    await expect(new MobileChatService().sendMessage({ tripId: 'trip-1', content: '  ' }))
      .rejects.toThrow('Message is empty');
    expect(api.post).not.toHaveBeenCalled();

    api.get.mockResolvedValue({ data: null, error: 'Forbidden', status: 403 });
    await expect(new MobileChatService().getMessages('trip-1')).rejects.toThrow('Forbidden');
  });

  it('marks at most 100 unique message ids through the API', async () => {
    api.post.mockResolvedValue({ data: { ok: true }, error: null, status: 200 });
    const ids = Array.from({ length: 101 }, (_, index) => `message-${index}`);
    await new MobileChatService().markAsRead([ids[0], ids[0], ...ids]);

    expect(api.post).toHaveBeenCalledWith('/v1/chat/messages/read', { messageIds: ids.slice(0, 100) });
  });

  it('authorizes through history before subscribing by deployed conversation id', async () => {
    let onChange: ((payload: { new?: { message_id?: string } }) => void) | undefined;
    const channel = {
      on: jest.fn((_event, _filter, handler) => { onChange = handler; return channel; }),
      subscribe: jest.fn().mockReturnThis(),
    };
    realtime.channel.mockReturnValue(channel);
    api.get.mockResolvedValueOnce(history([], 'conversation-7'))
      .mockResolvedValueOnce(history([rawMessage({ id: 'live-1' })], 'conversation-7'));

    const onMessage = jest.fn();
    const dispose = new MobileChatService().subscribeToTrip('trip-1', onMessage);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(realtime.channel).toHaveBeenCalledWith('mobile-trip-messages-trip-1');
    expect(channel.on).toHaveBeenCalledWith('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.conversation-7',
    }, expect.any(Function));

    onChange?.({ new: { message_id: 'live-1' } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'live-1' }));
    dispose();
    expect(realtime.removeChannel).toHaveBeenCalledWith(channel);
  });
});
