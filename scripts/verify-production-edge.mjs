const supabaseUrl = process.argv[2]?.replace(/\/$/, '');
const publishableKey = process.argv[3];
if (!supabaseUrl || !publishableKey?.startsWith('sb_publishable_')) {
  console.error('Usage: node scripts/verify-production-edge.mjs <supabase-url> <publishable-key>');
  process.exit(2);
}

const baseUrl = `${supabaseUrl}/functions/v1/make-server-0b1f4071`;
const headers = {
  apikey: publishableKey,
  origin: 'https://www.wasel14.online',
};

const authSettings = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers });
console.log(`Auth settings: ${authSettings.status}`);
if (!authSettings.ok) process.exit(1);

const health = await fetch(`${baseUrl}/health`, { headers });
console.log(`health: ${health.status}`);
if (!health.ok) process.exit(1);

const tripSearch = await fetch(
  `${baseUrl}/trips/search?from=__codex_connectivity_check__`,
  { headers },
);
console.log(`database trip search: ${tripSearch.status}`);
if (!tripSearch.ok) {
  console.error((await tripSearch.text()).slice(0, 500));
  process.exit(1);
}
await tripSearch.body?.cancel();

const pricing = await fetch(`${baseUrl}/trips/calculate-price`, {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'passenger', distance_km: 10, base_price: 1 }),
});
console.log(`public pricing POST: ${pricing.status}`);
if (!pricing.ok) {
  console.error((await pricing.text()).slice(0, 500));
  process.exit(1);
}
console.log(`pricing payload: ${JSON.stringify(await pricing.json())}`);
