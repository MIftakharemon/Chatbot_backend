# PROJECT.md — Facebook Chatbot SaaS Platform ("PageBot")

## Overview
A multi-tenant SaaS platform where Facebook Page owners (e-commerce pages) connect
their page via Facebook OAuth, upload their business data (products, prices, sizes,
stock), and our chatbot automatically handles Messenger conversations: product
browsing, order taking (name → phone → address), comment auto-replies, and human
takeover. Built with Next.js 14+ (App Router, TypeScript) + Supabase.

## Tech Stack
- Next.js 14+ App Router, TypeScript, Tailwind CSS + shadcn/ui
- Supabase: PostgreSQL database, Auth (email), Storage (product images), Realtime
- Node.js runtime for API routes; deployed on Vercel
- Meta Graph API v21.0: Messenger Send API, Webhooks, OAuth (Facebook Login for Business)

## Architecture
- Landing page (marketing) at /
- Client dashboard at /dashboard (Supabase Auth protected, RLS enforced)
- API routes:
  - GET+POST /api/webhook — Meta webhook (GET: hub.challenge verify; POST: verify
    X-Hub-Signature-256 HMAC with FACEBOOK_APP_SECRET, then process events async,
    return 200 immediately)
  - GET /api/connect — start OAuth: redirect to
    https://www.facebook.com/v21.0/dialog/oauth?client_id=...&redirect_uri=.../api/connect/callback
    &state={csrf}&scope=pages_show_list,pages_messaging,pages_manage_metadata,
    pages_read_engagement,pages_manage_engagement,pages_manage_posts
  - GET /api/connect/callback — exchange code → short-lived user token →
    long-lived user token (fb_exchange_token) → GET /me/accounts (list pages) →
    save selected page token → POST /{page-id}/subscribed_apps
    ?subscribed_fields=messages,messaging_postbacks,feed → GET /{page-id}
    ?fields=access_token for a never-expiring page token → store in pages table
  - CRUD /api/products, /api/orders, /api/settings, /api/pages (auth'd client routes)
- Bot engine in lib/bot/engine.ts — per-conversation state machine:
  idle → product select → ask_size → ask_qty → ask_name → ask_phone → ask_address
  → confirm → place order. State + cart stored in `conversations` table.
  Global keywords: "human"/"agent" pauses bot. Bangla + Banglish + English keywords.
- lib/bot/send.ts — Send API helpers: sendText, sendButtons (button template),
  sendGeneric (product cards). All use the page's stored access_token.

## Database Schema (Supabase — run in SQL editor, RLS enabled on all)
- profiles (id=auth.users FK pk, full_name, phone, role client|admin, plan, created_at)
- pages (id uuid pk, owner_id→profiles, fb_page_id text unique, page_name,
  page_avatar_url, access_token text, token_expires_at, is_active, connected_at)
- products (id uuid pk, page_id→pages cascade, name, description, price numeric,
  sizes jsonb [], colors jsonb [], stock int, image_url, sku, is_active, created_at;
  index on page_id)
- bot_settings (page_id pk fk, welcome_message, fallback_message, delivery_inside
  default 60, delivery_outside default 120, payment_methods jsonb,
  auto_comment_reply bool, comment_reply_text, bot_enabled bool)
- conversations (id uuid pk, page_id fk, psid text, customer_name, customer_pfp,
  state text default 'idle', cart jsonb '[]', temp_data jsonb '{}',
  last_message_at; unique(page_id, psid))
- orders (id uuid pk, page_id fk, order_number serial unique, psid,
  customer_name, customer_phone, customer_address, items jsonb, subtotal,
  delivery_charge, total, status pending|confirmed|shipped|delivered|cancelled,
  created_at; index on (page_id, created_at desc))
- comment_replies (id uuid pk, page_id fk, fb_comment_id unique, post_id,
  comment_text, replied_at)
- RLS policies: pages where owner_id = auth.uid(); products/orders/bot_settings/
  conversations where page_id in (select id from pages where owner_id = auth.uid())
- SQL function decrement_stock(product_id, qty)
- Webhook routes use SUPABASE_SERVICE_ROLE_KEY (bypass RLS), server-only.

## Dashboard Pages
/dashboard (overview: orders today, revenue, low stock), /dashboard/pages,
/dashboard/products (CRUD + image upload + CSV import), /dashboard/orders
(status update, click-to-call), /dashboard/conversations (live via Supabase
Realtime + human takeover toggle), /dashboard/settings (bot settings form).

## Environment Variables
FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_VERIFY_TOKEN, FACEBOOK_GRAPH_VERSION=v21.0,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL

## Rules
- Always verify webhook HMAC signature before processing.
- Reply to users only within the 24h messaging window.
- Validate BD phone: /^01[3-9]\d{8}$/
- Bot messages in Bangla; UI labels Bangla+English.
- Never expose service role key or page tokens to the client.
