import {
    json,
    authenticateRequest,
    assertTripParticipant,
} from './shared.ts';

type AuthSuccess = Extract<Awaited<ReturnType<typeof authenticateRequest>>, { admin: unknown }>;
type AdminClient = AuthSuccess['admin'];

const CHAT_SELECT = 'message_id, conversation_id, user_id, content, type, metadata, created_at, sender:users!messages_user_id_fkey(id, auth_user_id, full_name, avatar_url)';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_METADATA_LENGTH = 8192;

type ChatSender = {
  id?: string | null;
  auth_user_id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

type ChatRow = {
  message_id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  type?: 'text' | 'location' | 'system' | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  sender?: ChatSender | ChatSender[] | null;
};

function firstSender(sender: ChatRow['sender']): ChatSender | null {
  if (Array.isArray(sender)) {return sender[0] ?? null;}
  return sender ?? null;
}

function mapMessage(row: ChatRow, tripId: string, currentUserId: string) {
  const sender = firstSender(row.sender);
  const senderId = sender?.auth_user_id || row.user_id;
  return {
    id: row.message_id,
    trip_id: tripId,
    sender_id: senderId,
    content: row.content,
    type: row.type === 'location' || row.type === 'system' ? row.type : 'text',
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {},
    // The deployed chat schema stores a per-conversation read cursor. This
    // compatibility projection lets older web/mobile models keep their shape.
    read_by: senderId === currentUserId ? [currentUserId] : [],
    created_at: row.created_at,
    sender: {
      id: senderId,
      full_name: sender?.full_name ?? 'Wasel',
      avatar_url: sender?.avatar_url ?? '',
    },
  };
}

async function getOrCreateConversationId(admin: AdminClient, tripId: string, userId: string): Promise<string> {
  const title = `trip:${tripId}`;
  const lookup = await admin
    .from('conversations')
    .select('conversation_id')
    .eq('title', title)
    .maybeSingle();
  if (lookup.error) {throw lookup.error;}

  let conversationId = lookup.data?.conversation_id as string | undefined;
  if (!conversationId) {
    const inserted = await admin
      .from('conversations')
      .insert({ created_by: userId, title })
      .select('conversation_id')
      .single();
    if (inserted.error?.code === '23505') {
      const raced = await admin
        .from('conversations')
        .select('conversation_id')
        .eq('title', title)
        .single();
      if (raced.error) {throw raced.error;}
      conversationId = raced.data.conversation_id as string;
    } else if (inserted.error) {
      throw inserted.error;
    } else {
      conversationId = inserted.data.conversation_id as string;
    }
  }

  const membership = await admin
    .from('conversation_members')
    .upsert(
      { conversation_id: conversationId, user_id: userId, role: 'member' },
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
    );
  if (membership.error) {throw membership.error;}
  return conversationId;
}

function clampMessageLimit(value: string | null): number {
  if (!value) {return 50;}
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {return 50;}
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

export async function handleGetChatMessages(request: Request, path: string) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) {return auth.error;}

  let tripId: string;
  try {
    tripId = decodeURIComponent(path.split('/')[3] ?? '');
  } catch {
    return json({ error: 'Invalid trip id' }, 400);
  }
  if (!UUID_RE.test(tripId)) {return json({ error: 'Invalid trip id' }, 400);}
  if (!(await assertTripParticipant(auth.admin, tripId, auth.canonicalUser.id))) {
    return json({ error: 'Not authorized to read messages in this trip' }, 403);
  }

  try {
    const conversationId = await getOrCreateConversationId(auth.admin, tripId, auth.canonicalUser.id);
    const [messages, membership] = await Promise.all([
      auth.admin
        .from('messages')
        .select(CHAT_SELECT)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(clampMessageLimit(new URL(request.url).searchParams.get('limit'))),
      auth.admin
        .from('conversation_members')
        .select('last_read_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', auth.canonicalUser.id)
        .maybeSingle(),
    ]);

    if (messages.error || membership.error) {
      console.error('[chat] Failed to load trip messages', messages.error ?? membership.error);
      return json({ error: 'Could not load trip messages' }, 500);
    }

    const lastReadAt = membership.data?.last_read_at ? Date.parse(membership.data.last_read_at) : Number.NaN;
    const readByCurrentUser = (messages.data ?? []).map((row: ChatRow) => {
      const sender = firstSender(row.sender);
      const senderId = sender?.auth_user_id || row.user_id;
      const sentAt = Date.parse(row.created_at);
      const mapped = mapMessage(row, tripId, auth.authUser.id);
      if (senderId !== auth.authUser.id && Number.isFinite(lastReadAt) && Number.isFinite(sentAt) && sentAt <= lastReadAt) {
        mapped.read_by.push(auth.authUser.id);
      }
      return mapped;
    }).reverse();

    return json({ messages: readByCurrentUser, conversationId });
  } catch (error) {
    console.error('[chat] Failed to prepare trip conversation', error);
    return json({ error: 'Could not load trip messages' }, 500);
  }
}

export async function handleSendChatMessage(request: Request, path: string) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) {return auth.error;}

  let tripId: string;
  try {
    tripId = decodeURIComponent(path.split('/')[3] ?? '');
  } catch {
    return json({ error: 'Invalid trip id' }, 400);
  }
  if (!UUID_RE.test(tripId)) {return json({ error: 'Invalid trip id' }, 400);}
  if (!(await assertTripParticipant(auth.admin, tripId, auth.canonicalUser.id))) {
    return json({ error: 'Not authorized to send messages in this trip' }, 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Invalid message request' }, 400);
  }
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content || content.length > MAX_MESSAGE_LENGTH) {
    return json({ error: `Message content must be between 1 and ${MAX_MESSAGE_LENGTH} characters` }, 400);
  }
  const type = body.type === 'location' || body.type === 'system' ? body.type : 'text';
  const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : {};
  if (JSON.stringify(metadata).length > MAX_METADATA_LENGTH) {
    return json({ error: 'Message metadata is too large' }, 400);
  }

  try {
    const conversationId = await getOrCreateConversationId(auth.admin, tripId, auth.canonicalUser.id);
    const { data, error } = await auth.admin
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: auth.canonicalUser.id, content, type, metadata })
      .select(CHAT_SELECT)
      .single();
    if (error) {
      console.error('[chat] Failed to persist trip message', error);
      return json({ error: 'Could not send trip message' }, 500);
    }
    return json({ message: mapMessage(data as ChatRow, tripId, auth.authUser.id) }, 201);
  } catch (error) {
    console.error('[chat] Failed to prepare trip conversation', error);
    return json({ error: 'Could not send trip message' }, 500);
  }
}

export async function handleMarkChatMessagesRead(request: Request) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) {return auth.error;}
  const body = await request.json().catch(() => null);
  const messageIds = Array.isArray(body?.messageIds)
    ? [...new Set(body.messageIds.filter((id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id)))].slice(0, 100)
    : [];
  if (messageIds.length === 0) {return json({ ok: true });}

  const { data: messages, error } = await auth.admin
    .from('messages')
    .select('message_id, conversation_id')
    .in('message_id', messageIds);
  if (error) {
    console.error('[chat] Failed to resolve messages for read receipt', error);
    return json({ error: 'Could not mark messages read' }, 500);
  }
  const conversationIds = [...new Set((messages ?? []).map((message: Record<string, unknown>) => String(message.conversation_id)).filter(Boolean))];
  if (conversationIds.length === 0) {return json({ ok: true });}

  const { error: updateError } = await auth.admin
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('user_id', auth.canonicalUser.id)
    .in('conversation_id', conversationIds);
  if (updateError) {
    console.error('[chat] Failed to update conversation read cursor', updateError);
    return json({ error: 'Could not mark messages read' }, 500);
  }
  return json({ ok: true });
}

export async function handleGetChatUnreadCount(request: Request, path: string) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) {return auth.error;}
  let tripId: string;
  try {
    tripId = decodeURIComponent(path.split('/')[3] ?? '');
  } catch {
    return json({ error: 'Invalid trip id' }, 400);
  }
  if (!UUID_RE.test(tripId)) {return json({ error: 'Invalid trip id' }, 400);}
  if (!(await assertTripParticipant(auth.admin, tripId, auth.canonicalUser.id))) {
    return json({ count: 0 });
  }

  try {
    const conversationId = await getOrCreateConversationId(auth.admin, tripId, auth.canonicalUser.id);
    const { data: member, error: memberError } = await auth.admin
      .from('conversation_members')
      .select('last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', auth.canonicalUser.id)
      .maybeSingle();
    if (memberError) {throw memberError;}

    let query = auth.admin
      .from('messages')
      .select('message_id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('user_id', auth.canonicalUser.id);
    query = member?.last_read_at ? query.gt('created_at', member.last_read_at) : query;
    const { count, error } = await query;
    if (error) {throw error;}
    return json({ count: count ?? 0 });
  } catch (error) {
    console.error('[chat] Failed to count unread trip messages', error);
    return json({ error: 'Could not count unread trip messages' }, 500);
  }
}
