/**
 * Maps the Supabase auth user to the public.users row.
 *
 * Most tables (messages, bookings, wallets, safety_incidents, ...) reference
 * public.users.id, which is NOT the same value as auth.users.id.
 */
import { supabase } from '../lib/config';

export interface UserIdentity {
  authId: string;
  publicId: string;
}

let cached: UserIdentity | null = null;

export function clearIdentityCache(): void {
  cached = null;
}

export async function getUserIdentity(): Promise<UserIdentity> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('User not authenticated');

  if (cached && cached.authId === user.id) return cached;

  let publicId: string | null = null;

  const viaRpc = await supabase.rpc('current_user_id');
  if (!viaRpc.error && typeof viaRpc.data === 'string' && viaRpc.data) {
    publicId = viaRpc.data;
  }

  if (!publicId) {
    const viaTable = await supabase.from('users').select('id').eq('auth_user_id', user.id).maybeSingle();
    publicId = viaTable.data?.id ?? null;
  }

  if (!publicId) throw new Error('Profile not found for this account');

  cached = { authId: user.id, publicId };
  return cached;
}
