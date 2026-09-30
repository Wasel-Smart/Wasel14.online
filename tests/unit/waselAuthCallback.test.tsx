import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const navigate = vi.fn();

vi.mock('@/hooks/useIframeSafeNavigate', () => ({
  useIframeSafeNavigate: () => navigate,
}));

const getSession = vi.fn();

vi.mock('@/utils/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

import WaselAuthCallback from '@/pages/WaselAuthCallback';
import { setCurrentLang } from '@/locales/tx';

function setSearch(search: string) {
  window.history.replaceState({}, '', `/app/auth/callback${search}`);
}

describe('WaselAuthCallback - cancelled or failed social sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // tx() defaults to Arabic (locales/tx.ts); pin it so assertions are stable.
    setCurrentLang('en');
    getSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('explains a cancellation instead of echoing the provider description', async () => {
    // Facebook returns error_description="Permissions error" with this code.
    setSearch('?error=access_denied&error_code=200&error_description=Permissions+error');

    render(<WaselAuthCallback />);

    await waitFor(() => {
      expect(screen.getByText('Sign-in was cancelled. You can try again.')).toBeDefined();
    });
    expect(screen.queryByText(/Permissions error/)).toBeNull();
  });

  it('reads the error code from the hash when the provider uses it', async () => {
    setSearch('#error=access_denied&error_description=Permissions+error');

    render(<WaselAuthCallback />);

    await waitFor(() => {
      expect(screen.getByText('Sign-in was cancelled. You can try again.')).toBeDefined();
    });
  });

  it('still surfaces a real provider error verbatim', async () => {
    setSearch('?error=server_error&error_description=Google+is+having+trouble');

    render(<WaselAuthCallback />);

    await waitFor(() => {
      expect(screen.getByText('Google is having trouble')).toBeDefined();
    });
  });

  it('offers a way back to the sign-in form when sign-in fails', async () => {
    setSearch('?error=access_denied&error_description=Permissions+error');

    render(<WaselAuthCallback />);

    // Regression: the error state used to render no button at all, stranding
    // the user on the callback page with no way to retry.
    const backButton = await screen.findByRole('button', { name: 'Back to sign in' });
    expect(backButton).toBeDefined();

    backButton.click();
    expect(navigate).toHaveBeenCalledWith(
      expect.stringContaining('/app/auth?tab=signin'),
      { replace: true },
    );
  });

  it('offers a way back when the session could not be established', async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Auth session missing!' },
    });
    setSearch('?returnTo=%2Fapp%2Ffind-ride');

    render(<WaselAuthCallback />);

    const backButton = await screen.findByRole('button', { name: 'Back to sign in' });
    expect(backButton).toBeDefined();

    backButton.click();
    expect(navigate).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('/app/find-ride')),
      { replace: true },
    );
  });

  it('shows no button while sign-in is still in progress', async () => {
    let resolveSession: (value: unknown) => void = () => {};
    getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    setSearch('');

    render(<WaselAuthCallback />);

    expect(screen.queryByRole('button', { name: 'Back to sign in' })).toBeNull();
    resolveSession({ data: { session: null }, error: null });
  });
});
