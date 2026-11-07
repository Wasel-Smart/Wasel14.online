export function resolveCorsOrigin(origin: string | null, configuredOrigins: string): string | null {
  if (!origin || origin === 'null') return null;

  let requestOrigin: string;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    requestOrigin = parsed.origin;
  } catch {
    return null;
  }

  const allowed = configuredOrigins
    .split(/[\r\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .some((value) => {
      try {
        return new URL(value).origin === requestOrigin;
      } catch {
        return false;
      }
    });

  return allowed ? requestOrigin : null;
}
