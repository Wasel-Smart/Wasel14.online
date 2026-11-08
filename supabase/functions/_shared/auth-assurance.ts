export function satisfiesRequiredAal(
  requiresAal2: boolean,
  aal: string | null | undefined,
): boolean {
  return !requiresAal2 || aal === 'aal2';
}
