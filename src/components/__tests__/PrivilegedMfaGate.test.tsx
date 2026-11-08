import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { mockUseAuth, mockGetSupabaseClient, mfa } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockGetSupabaseClient: vi.fn(),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('@/contexts/auth/auth-service', () => ({ getSupabaseClient: mockGetSupabaseClient }));
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', dir: 'ltr' }),
}));

import { PrivilegedMfaGate } from '../PrivilegedMfaGate';

const session = { user: { id: 'admin-user' } };
const client = { auth: { mfa } };

function setAccount(role: string, loading = false) {
  mockUseAuth.mockReturnValue({
    loading,
    profile: { role },
    session,
  });
}

function protectedContent() {
  return <div>Protected application</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mockGetSupabaseClient.mockReturnValue(client);
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1' },
    error: null,
  });
  mfa.listFactors.mockResolvedValue({
    data: { totp: [], phone: [], all: [] },
    error: null,
  });
  mfa.enroll.mockResolvedValue({
    data: {
      id: 'new-factor',
      totp: { qr_code: '<svg></svg>', secret: 'test-secret' },
    },
    error: null,
  });
  mfa.challenge.mockResolvedValue({ data: { id: 'challenge-id' }, error: null });
  mfa.verify.mockResolvedValue({ data: {}, error: null });
});

describe('PrivilegedMfaGate', () => {
  it('does not gate ordinary accounts', () => {
    setAccount('passenger');

    render(<PrivilegedMfaGate>{protectedContent()}</PrivilegedMfaGate>);

    expect(screen.getByText('Protected application')).toBeInTheDocument();
    expect(mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it('keeps a privileged account blocked until enrollment verifies at AAL2', async () => {
    setAccount('admin');
    mfa.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1' }, error: null })
      .mockResolvedValueOnce({ data: { currentLevel: 'aal2' }, error: null });

    render(<PrivilegedMfaGate>{protectedContent()}</PrivilegedMfaGate>);

    expect(screen.queryByText('Protected application')).not.toBeInTheDocument();
    expect(await screen.findByText('Set up an authenticator')).toBeInTheDocument();
    expect(screen.getByText('test-secret')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

    expect(await screen.findByText('Protected application')).toBeInTheDocument();
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: 'new-factor' });
    expect(mfa.verify).toHaveBeenCalledWith({
      factorId: 'new-factor',
      challengeId: 'challenge-id',
      code: '123456',
    });
  });

  it('does not unlock a privileged account when verification does not establish AAL2', async () => {
    setAccount('admin');
    mfa.listFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'verified-factor', status: 'verified' }],
        phone: [],
        all: [{ id: 'verified-factor', factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    });
    mfa.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1' }, error: null })
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1' }, error: null });

    render(<PrivilegedMfaGate>{protectedContent()}</PrivilegedMfaGate>);
    expect(await screen.findByText('Enter the 6-digit code from your authenticator app.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Second-factor verification did not establish AAL2.',
      );
    });
    expect(screen.queryByText('Protected application')).not.toBeInTheDocument();
  });
});
