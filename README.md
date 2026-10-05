# PageBot — Facebook Chatbot SaaS

Multi-tenant SaaS where Facebook Page owners connect their page, upload products,
and an automated Messenger bot takes orders (Bangla/Banglish/English), replies to
comments, and hands over to a human when asked.

**Stack:** Next.js 16 (App Router, TypeScript, Turbopack) · Tailwind CSS + shadcn/ui ·
Supabase (Postgres + Auth + Storage + Realtime) · Meta Graph API v21.0 · Vercel

Full architecture, schema and rules: [`PROJECT.md`](./PROJECT.md).

## Getting started

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql`
   (tables, RLS policies, `decrement_stock()`, `product-images` bucket).
3. Project Settings → API: copy the URL, `anon` key and `service_role` key.

### 2. Meta (Facebook) app

1. Create an app at [developers.facebook.com](https://developers.facebook.com) →
   type **Business** → add the **Facebook Login for Business** product.
2. App settings → add to **Valid OAuth Redirect URIs**:
   `https://<your-domain>/api/connect/callback`
3. Webhooks → callback URL `https://<your-domain>/api/webhook`,
   **Verify token** = your `FACEBOOK_VERIFY_TOKEN`, subscribe to
   `messages`, `messaging_postbacks`, `feed`.
4. Permissions to request:
   `pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,pages_manage_engagement,pages_manage_posts`

### 3. Environment

`.env.local`:

```
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_VERIFY_TOKEN=...
FACEBOOK_GRAPH_VERSION=v21.0
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only
APP_URL=https://<your-domain>
```

## Routes

| Route | Purpose |
| --- | --- |
| `GET/POST /api/webhook` | Meta webhook: `hub.challenge` verify + `X-Hub-Signature-256` HMAC, then `after()` async processing |
| `GET /api/connect` | Starts Facebook OAuth (`pages_show_list,pages_messaging,...`) |
| `GET /api/connect/callback` | code → long-lived user token → `/me/accounts` → never-expiring page token → `subscribed_apps` |
| `GET/POST /api/pages`, `PATCH/DELETE /api/pages/[id]` | page list/choose/disconnect |
| `GET/POST /api/products`, `PATCH/DELETE /api/products/[id]` | products CRUD + CSV bulk import |
| `GET /api/orders`, `PATCH /api/orders/[id]` | orders + status updates |
| `GET/PUT /api/settings` | bot settings |
| `POST /api/upload` | product image → Supabase Storage (service role, server-side) |
| `PATCH /api/conversations/[id]` | human-takeover toggle |
| `POST /api/conversations/[id]/reply` | agent reply (24h window enforced) |

## Bot state machine

`idle → browsing → ask_size → ask_qty → ask_name → ask_phone → ask_address → confirm → order_placed`

- Stock checked atomically with `decrement_stock()` (SQL function).
- BD phone validation: `/^01[3-9]\d{8}$/`
- Keywords in Bangla / Banglish / English. `"human"` / `"agent"` / `"মানুষ"`
  pauses the bot (human takeover), `"bot"` resumes it.
- Delivery charge comes from `bot_settings` (inside/outside Dhaka).

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and page access tokens are read only in
  `server-only` modules (`src/lib/env.ts`, `src/lib/supabase/admin.ts`).
- Every client table has RLS: `owner_id = auth.uid()` for `pages`, and a
  `pages` sub-select for `products`, `orders`, `bot_settings`,
  `conversations`, `messages`, `comment_replies`.
- `src/proxy.ts` (Next 16's middleware) refreshes the session and guards
  `/dashboard` + authenticated API routes.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # eslint
npx tsc --noEmit # typecheck
```
