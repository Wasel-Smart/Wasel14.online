import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/config';
import { getUserIdentity, type UserIdentity } from './identity';

/**
 * Trip chat on top of the real schema:
 *   conversations(conversation_id, created_by, title)
 *   conversation_members(conversation_id, user_id, role)
 *   messages(message_id, conversation_id, user_id, content, created_at)
 *
 * A trip's conversation is identified by title = `trip:<trip_id>`.
 * messages.user_id is public.users.id; the UI compares against the auth id, so
 * `senderId` is mapped back to the auth id for the signed-in user.
 */
export type TripMessageType = 'text' | 'location' | 'system';

type SenderProfile = {
  id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

type RawMessage = {
  message_id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  sender?: SenderProfile | SenderProfile[] | null;
};

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

const PLAIN_SELECT = 'message_id, conversation_id, user_id, content, created_at';
const MESSAGE_SELECT = `${PLAIN_SELECT}, sender:v_users_public!messages_user_id_fkey(id, full_name, avatar_url)`;

const tripTitle = (tripId: string) => `trip:${tripId}`;

function firstProfile(profile: RawMessage['sender']): SenderProfile | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile ?? null;
}

function normalizeMessage(raw: RawMessage, tripId: string, me: UserIdentity): TripMessage {
  const sender = firstProfile(raw.sender);
  return {
    id: raw.message_id,
    tripId,
    senderId: raw.user_id === me.publicId ? me.authId : raw.user_id,
    senderName: sender?.full_name?.trim() || 'Wasel',
    content: raw.content ?? '',
    type: 'text',
    metadata: {},
    readBy: [],
    readAt: null,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

function byCreatedAt(a: TripMessage, b: TripMessage): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

export class MobileChatService {
  private channels = new Map<string, RealtimeChannel>();

  async getMessages(tripId: string, limit = 50): Promise<TripMessage[]> {
    if (!tripId) throw new Error('Missing trip id');
    const me = await getUserIdentity();

    const conversationId = await this.findConversationId(tripId);
    if (!conversationId) return [];

    const rows = await this.selectMessages(q =>
      q.eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(limit),
    );
    return rows.map(row => normalizeMessage(row, tripId, me)).sort(byCreatedAt);
  }

  async sendMessage(request: SendTripMessageRequest): Promise<TripMessage> {
    const content = request.content.trim();
    if (!request.tripId) throw new Error('Missing trip id');
    if (!content) throw new Error('Message is empty');

    const me = await getUserIdentity();
    await this.assertTripParticipant(request.tripId, me.publicId);
    const conversationId = await this.ensureConversation(request.tripId, me.publicId);

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: me.publicId, content })
      .select(PLAIN_SELECT)
      .single();

    if (error) throw error;
    return normalizeMessage({ ...(data as RawMessage), sender: { full_name: null } }, request.tripId, me);
  }

  /** The schema has no per-message read receipts yet, so this is intentionally a no-op. */
  async markAsRead(_messageIds: string[]): Promise<void> {
    return;
  }

  subscribeToTrip(
    tripId: string,
    onMessage: (message: TripMessage) => void,
    onError?: (error: Error) => void,
  ): () => void {
    if (!tripId) throw new Error('Missing trip id');

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const channelName = `mobile-trip-messages-${tripId}`;

    const existing = this.channels.get(channelName);
    if (existing) {
      void supabase.removeChannel(existing);
      this.channels.delete(channelName);
    }

    void (async () => {
      try {
        const me = await getUserIdentity();
        const conversationId = await this.findConversationId(tripId);
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
              if (!id) return;
              try {
                const rows = await this.selectMessages(q => q.eq('message_id', id).limit(1));
                if (rows[0]) onMessage(normalizeMessage(rows[0], tripId, me));
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

  /** Selects with the sender join; falls back to a plain select if the embed is not permitted. */
  private async selectMessages(build: (q: any) => PromiseLike<{ data: unknown; error: unknown }>): Promise<RawMessage[]> {
    const withSender = await build(supabase.from('messages').select(MESSAGE_SELECT) as any);
    if (!withSender.error) return (withSender.data ?? []) as RawMessage[];

    const plain = await build(supabase.from('messages').select(PLAIN_SELECT) as any);
    if (plain.error) throw plain.error;
    return (plain.data ?? []) as RawMessage[];
  }

  private async findConversationId(tripId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('conversation_id')
      .eq('title', tripTitle(tripId))
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.conversation_id ?? null;
  }

  private async ensureConversation(tripId: string, publicUserId: string): Promise<string> {
    let conversationId = await this.findConversationId(tripId);

    if (!conversationId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ created_by: publicUserId, title: tripTitle(tripId) })
        .select('conversation_id')
        .single();
      if (error) throw error;
      conversationId = data.conversation_id;
    }

    const { error: memberError } = await supabase
      .from('conversation_members')
      .upsert(
        { conversation_id: conversationId, user_id: publicUserId, role: 'member' },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
      );
    if (memberError) throw memberError;

    return conversationId;
  }

  /** The user must be the trip's driver (drivers.user_id) or hold a booking on it. */
  private async assertTripParticipant(tripId: string, publicUserId: string): Promise<void> {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('trip_id, driver:drivers!trips_driver_id_fkey(user_id)')
      .eq('trip_id', tripId)
      .maybeSingle();
    if (tripError) throw tripError;
    if (!trip) throw new Error('Trip not found');

    const driver = Array.isArray(trip.driver) ? trip.driver[0] : trip.driver;
    if (driver?.user_id === publicUserId) return;

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('booking_id')
      .eq('trip_id', tripId)
      .eq('passenger_id', publicUserId)
      .limit(1)
      .maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking) throw new Error('Not authorized to send messages in this trip');
  }
}

export const chatService = new MobileChatService();
