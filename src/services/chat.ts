import { supabase } from '@/utils/supabase/client';
import { apiGet, apiPost } from '@/utils/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  trip_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'location' | 'system';
  metadata: Record<string, unknown>;
  read_by: string[];
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface SendMessageRequest {
  tripId: string;
  content: string;
  type?: 'text' | 'location' | 'system';
  metadata?: Record<string, unknown>;
}

class ChatService {
  private channels: Map<string, RealtimeChannel> = new Map();

  async sendMessage(request: SendMessageRequest): Promise<Message> {
    const response = await apiPost<{ message: Message }>(
      `/v1/chat/trips/${encodeURIComponent(request.tripId)}/messages`,
      {
        content: request.content,
        type: request.type ?? 'text',
        metadata: request.metadata ?? {},
      },
    );
    return response.message;
  }

  async getMessages(tripId: string, limit = 50): Promise<Message[]> {
    const response = await apiGet<{ messages: Message[] }>(
      `/v1/chat/trips/${encodeURIComponent(tripId)}/messages`,
      { limit: Math.min(100, Math.max(1, Math.floor(limit))) },
    );
    return Array.isArray(response.messages) ? response.messages : [];
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    const ids = [...new Set(messageIds.map(String).filter(Boolean))].slice(0, 100);
    if (!ids.length) {return;}
    await apiPost('/v1/chat/messages/read', { messageIds: ids });
  }

  subscribeToTrip(
    tripId: string,
    onMessage: (message: Message) => void,
    onError?: (error: Error) => void,
  ): () => void {
    if (!supabase) {throw new Error('Supabase not configured');}
    const sb = supabase;
    const channelName = `trip:${tripId}`;

    if (this.channels.has(channelName)) {
      const oldChannel = this.channels.get(channelName);
      if (oldChannel) {
        void oldChannel.unsubscribe();
        this.channels.delete(channelName);
      }
    }

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void (async () => {
      try {
        // Read through the authenticated API first. This also ensures the
        // participant's conversation membership before subscribing to RLS-
        // protected Postgres changes.
        const data = await apiGet<{ messages: Message[]; conversationId: string }>(
          `/v1/chat/trips/${encodeURIComponent(tripId)}/messages`,
          { limit: 1 },
        );
        const conversationId = data?.conversationId;
        if (cancelled || !conversationId) {return;}

        channel = sb
          .channel(channelName, { config: { broadcast: { self: false } } })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload: { new: { message_id?: string } }) => {
              const messageId = payload.new?.message_id;
              if (!messageId) {return;}
              try {
                const messages = await this.getMessages(tripId, 100);
                const message = messages.find(item => item.id === messageId);
                if (message) {onMessage(message);}
              } catch {
                // A failed refresh is recoverable on the next history load.
              }
            },
          )
          .subscribe((status: string) => {
            if ((status === 'SUBSCRIPTION_ERROR' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && onError) {
              onError(new Error('Subscription failed'));
            }
          });
        if (cancelled && channel) {
          void channel.unsubscribe();
          return;
        }
        if (channel) {this.channels.set(channelName, channel);}
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Subscription failed'));
      }
    })();

    return () => {
      cancelled = true;
      if (channel) {void channel.unsubscribe();}
      this.channels.delete(channelName);
    };
  }

  async getUnreadCount(tripId: string): Promise<number> {
    const response = await apiGet<{ count: number }>(
      `/v1/chat/trips/${encodeURIComponent(tripId)}/unread-count`,
    );
    return Math.max(0, Number(response.count) || 0);
  }
}

export const chatService = new ChatService();
