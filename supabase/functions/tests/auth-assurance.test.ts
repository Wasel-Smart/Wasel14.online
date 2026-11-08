import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { satisfiesRequiredAal } from '../_shared/auth-assurance.ts';
import { isHighPrivilegeRole, resolveAccessRole } from '../make-server-0b1f4071/_shared/rbac.ts';

function requiresAal2(role: string): boolean {
  return isHighPrivilegeRole(resolveAccessRole(role));
}

Deno.test('AAL2 is required for privileged roles and not ordinary roles', () => {
  assertEquals(requiresAal2('admin'), true);
  assertEquals(requiresAal2('finance'), true);
  assertEquals(requiresAal2('trust'), true);
  assertEquals(requiresAal2('support'), false);
  assertEquals(requiresAal2('driver'), false);
});

Deno.test('only AAL2 satisfies the privileged assurance requirement', () => {
  assertEquals(satisfiesRequiredAal(requiresAal2('admin'), 'aal1'), false);
  assertEquals(satisfiesRequiredAal(requiresAal2('admin'), 'aal2'), true);
  assertEquals(satisfiesRequiredAal(requiresAal2('support'), 'aal1'), true);
  assertEquals(satisfiesRequiredAal(requiresAal2('unknown-role'), 'aal1'), true);
});
