import type { RealtimeChannel } from '@supabase/supabase-js';

import { apiClient } from '../lib/api';
import { supabase } from '../lib/config';

export type TripMessageType = 'text' | 'location' | 'system';

type SenderProfile = {
  id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

type RawMessage = {
  id: string;
  trip_id: string;
  sender_id: string;
  content: string;
  type?: TripMessageType;
  metadata?: Record<string, unknown>;
  read_by?: string[];
  created_at: string;
  sender?: SenderProfile | SenderProfile[] | null;
};

type ChatHistoryResponse = { messages: RawMessage[]; conversationId: string };

export interface TripMessage {
  id: string;
  tripId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: TripMessageType;
  metadata: Record<string, unknown>;
  readBy: string[];
  readAt: string | null;
  createdAt: string;
}

export interface SendTripMessageRequest {
  tripId: string;
  content: string;
  type?: TripMessageType;
  metadata?: Record<string, unknown>;
}

function firstProfile(profile: RawMessage['sender']): SenderProfile | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile ?? null;
}

function normalizeMessage(raw: RawMessage, tripId: string): TripMessage {
  const sender = firstProfile(raw.sender);
  return {
    id: raw.id,
    tripId,
    senderId: raw.sender_id,
    senderName: sender?.full_name?.trim() || 'Wasel',
    content: raw.content ?? '',
    type: raw.type === 'location' || raw.type === 'system' ? raw.type : 'text',
    metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {},
    readBy: Array.isArray(raw.read_by) ? raw.read_by : [],
    readAt: null,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

function byCreatedAt(a: TripMessage, b: TripMessage): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function requireData<T>(response: { data: T | null; error: string | null }): T {
  if (response.error) throw new Error(response.error);
  if (response.data === null) throw new Error('Chat service returned an empty response');
  return response.data;
}

function historyPath(tripId: string, limit: number): string {
  const boundedLimit = Math.min(100, Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : 50)));
  return `/v1/chat/trips/${encodeURIComponent(tripId)}/messages?limit=${boundedLimit}`;
}

export class MobileChatService {
  private channels = new Map<string, RealtimeChannel>();

  async getMessages(tripId: string, limit = 50): Promise<TripMessage[]> {
    if (!tripId) throw new Error('Missing trip id');
    const response = await apiClient.get<ChatHistoryResponse>(historyPath(tripId, limit));
    const data = requireData(response);
    return (Array.isArray(data.messages) ? data.messages : [])
      .map(row => normalizeMessage(row, tripId))
      .sort(byCreatedAt);
  }

  async sendMessage(request: SendTripMessageRequest): Promise<TripMessage> {
    const content = request.content.trim();
    if (!request.tripId) throw new Error('Missing trip id');
    if (!content) throw new Error('Message is empty');

    const response = await apiClient.post<{ message: RawMessage }>(
      `/v1/chat/trips/${encodeURIComponent(request.tripId)}/messages`,
      { content, type: request.type ?? 'text', metadata: request.metadata ?? {} },
    );
    const data = requireData(response);
    return normalizeMessage(data.message, request.tripId);
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    const ids = [...new Set(messageIds.filter(Boolean))].slice(0, 100);
    if (ids.length === 0) return;
    const response = await apiClient.post<{ ok: boolean }>('/v1/chat/messages/read', { messageIds: ids });
    requireData(response);
  }

  subscribeToTrip(
    tripId: string,
    onMessage: (message: TripMessage) => void,
    onError?: (error: Error) => void,
  ): () => void {
    if (!tripId) throw new Error('Missing trip id');
    if (!supabase) throw new Error('Supabase is not configured');

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const channelName = `mobile-trip-messages-${tripId}`;
    const emitted = new Set<string>();
    const existing = this.channels.get(channelName);
    if (existing) {
      void supabase.removeChannel(existing);
      this.channels.delete(channelName);
    }

    void (async () => {
      try {
        const response = await apiClient.get<ChatHistoryResponse>(historyPath(tripId, 1));
        const data = requireData(response);
        const conversationId = data.conversationId;
        if (cancelled || !conversationId) return;

        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload: { new?: { message_id?: string } }) => {
              const id = payload.new?.message_id;
              if (!id || emitted.has(id)) return;
              try {
                const messages = await this.getMessages(tripId, 100);
                const message = messages.find(item => item.id === id);
                if (message && !cancelled) {
                  emitted.add(id);
                  onMessage(message);
                }
              } catch (error) {
                onError?.(error instanceof Error ? error : new Error('Could not load new message'));
              }
            },
          )
          .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              onError?.(new Error('Live chat connection failed'));
            }
          });

        if (cancelled) {
          void supabase.removeChannel(channel);
          return;
        }
        this.channels.set(channelName, channel);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Live chat connection failed'));
      }
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }
}

export const chatService = new MobileChatService();
