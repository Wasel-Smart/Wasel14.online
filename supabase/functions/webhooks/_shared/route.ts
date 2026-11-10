/** Return the route below the `webhooks` Supabase Edge Function prefix. */
export function getWebhookRequestPath(pathname: string): string {
  const prefixes = ['/functions/v1/webhooks', '/webhooks'];
  for (const prefix of prefixes) {
    if (pathname === prefix) {return '/';}
    if (pathname.startsWith(`${prefix}/`)) {return pathname.slice(prefix.length);}
  }
  return pathname || '/';
}
