// GENERATED FILE — DO NOT EDIT.
// Vendored from supabase/functions/_shared/auth-assurance.ts
// by scripts/prepare-edge-bundles.mjs so that this function is a closed,
// self-contained module graph. Edit the source of truth instead.
export function satisfiesRequiredAal(
  requiresAal2: boolean,
  aal: string | null | undefined,
): boolean {
  return !requiresAal2 || aal === 'aal2';
}
