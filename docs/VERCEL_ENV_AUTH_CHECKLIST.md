# Vercel Production Environment Variables — Auth Checklist

Set these in **Vercel → Project Settings → Environment Variables**.
Mark each as **Production** environment. Server-only vars must NOT have the `VITE_` prefix.

## Required for auth to work at all

| Variable | Value | Scope |
|---|---|---|
| `SUPABASE_URL` | `https://zexlxabdcsjefptmjhuq.supabase.co` | Server |
| `SUPABASE_ANON_KEY` | `sb_publishable_JVm491I75epeoSqNOvN9EQ_sON38c3x` | Server |
| `VITE_SUPABASE_URL` | `https://zexlxabdcsjefptmjhuq.supabase.co` | Client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_JVm491I75epeoSqNOvN9EQ_sON38c3x` | Client |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_JVm491I75epeoSqNOvN9EQ_sON38c3x` | Client |
| `VITE_APP_URL` | `https://www.wasel14.online` | Client |
| `VITE_AUTH_CALLBACK_PATH` | `/app/auth/callback` | Client |
| `VITE_EDGE_FUNCTION_NAME` | `make-server-0b1f4071` | Client |
| `VITE_EDGE_FUNCTIONS_BASE_URL` | `https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1` | Client |
| `VITE_API_URL` | `https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071` | Client |
| `VITE_DATA_PATH` | `edge` | Client |

## Required for OAuth (Google / Facebook)

| Variable | Value | Scope |
|---|---|---|
| `SUPABASE_AUTH_GOOGLE_CLIENT_ID` | `631682127784-k348s2idi8lklci5uiu0o9kc4gi7o6nj.apps.googleusercontent.com` | Server |
| `SUPABASE_AUTH_GOOGLE_CLIENT_SECRET` | *(your Google OAuth secret)* | Server |
| `SUPABASE_AUTH_FACEBOOK_CLIENT_ID` | `2154021471813673` | Server |
| `SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET` | *(your Facebook App secret)* | Server |

## Required in Supabase Dashboard (not Vercel)

Go to **Supabase → Authentication → URL Configuration → Redirect URLs** and add:
```
https://www.wasel14.online/app/auth/callback
https://wasel14.online/app/auth/callback
```

Go to **Supabase → Authentication → URL Configuration → Site URL**:
```
https://www.wasel14.online
```

## Required in Google Cloud Console

Go to **APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs** and add:
```
https://zexlxabdcsjefptmjhuq.supabase.co/auth/v1/callback
```

## Required in Facebook Developer Console

Go to **Facebook Login → Settings → Valid OAuth Redirect URIs** and add:
```
https://zexlxabdcsjefptmjhuq.supabase.co/auth/v1/callback
```

## Notes

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (without `VITE_` prefix) are read by
  `api/auth/callback.ts` (the Vercel serverless function). Without them the
  server-side code exchange fails and every OAuth/email-link sign-in redirects
  to the error page.
- `VITE_*` vars are inlined into the browser bundle at build time by Vite.
  They must be set in Vercel as **Production** environment variables before
  triggering a new deployment.
- Do NOT set `VITE_ALLOW_DIRECT_SUPABASE_FALLBACK=true` in production.
  Profile creation now falls back automatically without this flag.
