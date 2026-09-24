/**
 * LocalAuth
 *
 * Backward-compatible adapter on top of AuthContext.
 * No longer owns a separate auth state or provider.
 */
import { useAuth } from './AuthContext';
import type { WaselUser } from './authContextHelpers';

export type { WaselUser };

export interface LocalAuthCtx {
  user: WaselUser | null;
  loading: boolean;
  /** True while a sign-in / sign-up / profile request is in flight. */
  isSubmitting?: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    returnTo?: string;
  }) => Promise<{
    error: string | null;
    requiresEmailConfirmation: boolean;
    email: string;
  }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<WaselUser>) => Promise<void>;
}

/**
 * Convert an auth error into a plain, non-empty message.
 * `String(error)` would yield "Error: Incorrect email or password." (with the
 * class-name prefix), which then leaks into the UI banner. The result is never
 * an empty string, because callers treat a falsy error as "success".
 */
function toErrorMessage(error: unknown): string | null {
  if (!error) {return null;}
  if (error instanceof Error) {return error.message || error.name || 'Request failed';}
  if (typeof error === 'string') {return error || 'Request failed';}
  return String(error) || 'Request failed';
}

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useLocalAuth(): LocalAuthCtx {
  const auth = useAuth();

  const signIn = async (email: string, password: string) => {
    const result = await auth.signIn(email, password);
    return {
      error: toErrorMessage(result.error),
    };
  };

  const register = async (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    returnTo?: string;
  }) => {
    const { name, email, password, phone, returnTo } = input;
    const result = await auth.signUp(email, password, name, phone ?? '', returnTo);
    return {
      error: toErrorMessage(result.error),
      requiresEmailConfirmation: result.requiresEmailConfirmation ?? false,
      email,
    };
  };

  return {
    user: auth.waselUser,
    loading: auth.loading,
    isSubmitting: auth.isSubmitting,
    signIn,
    register,
    signOut: auth.signOut,
    updateUser: auth.updateUser,
  };
}
