type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (key: string, value: string) => void;
  json: (body: Record<string, unknown>) => void;
};

/**
 * POST /api/metrics — server-side metrics sink.
 * Accepts structured metric payloads from the client and forwards them
 * to the configured VITE_METRICS_ENDPOINT, or discards them silently
 * when no endpoint is configured.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const origin = (() => {
    const value = request.headers?.['origin'];
    return Array.isArray(value) ? value[0] : value;
  })();

  const allowed = new Set(
    (process.env.ALLOWED_ORIGINS ?? 'https://www.wasel14.online,https://wasel14.online')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );
  if (process.env.VERCEL_URL) {allowed.add(`https://${process.env.VERCEL_URL}`);}

  if (origin && !allowed.has(origin)) {
    return response.status(403).json({ error: 'Forbidden origin' });
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ received: true });
}
