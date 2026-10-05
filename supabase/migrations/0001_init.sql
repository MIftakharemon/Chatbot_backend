-- ============================================================
-- PageBot — Supabase schema + RLS
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'client' check (role in ('client', 'admin')),
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- pages (connected Facebook pages)
-- ------------------------------------------------------------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  fb_page_id text not null unique,
  page_name text not null,
  page_avatar_url text,
  access_token text not null,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  connected_at timestamptz not null default now()
);

create index if not exists pages_owner_id_idx on public.pages (owner_id);

alter table public.pages enable row level security;

drop policy if exists "pages_owner_all" on public.pages;
create policy "pages_owner_all" on public.pages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  sizes jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  stock int not null default 0,
  image_url text,
  sku text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_page_id_idx on public.products (page_id);

alter table public.products enable row level security;

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all" on public.products
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- bot_settings (1:1 with page)
-- ------------------------------------------------------------
create table if not exists public.bot_settings (
  page_id uuid primary key references public.pages (id) on delete cascade,
  welcome_message text not null default 'আসসালামু আলাইকুম! 👋 আমাদের পণ্য দেখতে "অর্ডার" লিখুন।',
  fallback_message text not null default 'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে মেনু থেকে একটি অপশন বেছে নিন।',
  delivery_inside int not null default 60,
  delivery_outside int not null default 120,
  payment_methods jsonb not null default '["ক্যাশ অন ডেলিভারি", "বিকাশ"]'::jsonb,
  auto_comment_reply boolean not null default true,
  comment_reply_text text not null default 'ইনবক্স করুন — আমরা সাথে সাথে অর্ডার করে দিতে পারব! 📦',
  bot_enabled boolean not null default true
);

alter table public.bot_settings enable row level security;

drop policy if exists "bot_settings_owner_all" on public.bot_settings;
create policy "bot_settings_owner_all" on public.bot_settings
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- Auto-create default settings when a page is connected
create or replace function public.handle_new_page()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bot_settings (page_id) values (new.id)
  on conflict (page_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_page_created on public.pages;
create trigger on_page_created
  after insert on public.pages
  for each row execute function public.handle_new_page();

-- ------------------------------------------------------------
-- conversations (bot state machine)
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  psid text not null,
  customer_name text,
  customer_pfp text,
  state text not null default 'idle',
  cart jsonb not null default '[]'::jsonb,
  temp_data jsonb not null default '{}'::jsonb,
  is_paused boolean not null default false,
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (page_id, psid)
);

create index if not exists conversations_page_id_idx on public.conversations (page_id);
create index if not exists conversations_last_message_idx on public.conversations (page_id, last_message_at desc);

alter table public.conversations enable row level security;

drop policy if exists "conversations_owner_all" on public.conversations;
create policy "conversations_owner_all" on public.conversations
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- messages (chat log shown live in the dashboard)
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  psid text not null,
  role text not null check (role in ('customer', 'bot', 'agent')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_page_id_idx on public.messages (page_id);

alter table public.messages enable row level security;

drop policy if exists "messages_owner_all" on public.messages;
create policy "messages_owner_all" on public.messages
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  order_number bigserial unique,
  psid text,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null default 0,
  delivery_charge numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists orders_page_created_idx on public.orders (page_id, created_at desc);
create index if not exists orders_status_idx on public.orders (page_id, status);

alter table public.orders enable row level security;

drop policy if exists "orders_owner_all" on public.orders;
create policy "orders_owner_all" on public.orders
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- comment_replies (dedupe auto-replies on feed comments)
-- ------------------------------------------------------------
create table if not exists public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  fb_comment_id text not null unique,
  post_id text,
  comment_text text,
  replied_at timestamptz not null default now()
);

create index if not exists comment_replies_page_idx on public.comment_replies (page_id);

alter table public.comment_replies enable row level security;

drop policy if exists "comment_replies_owner_all" on public.comment_replies;
create policy "comment_replies_owner_all" on public.comment_replies
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- decrement_stock: atomic stock check + decrement (used by the bot)
-- Returns true when stock was decremented, false when out of stock.
-- ------------------------------------------------------------
create or replace function public.decrement_stock(p_product_id uuid, p_qty int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  if p_qty is null or p_qty <= 0 then
    return false;
  end if;

  update public.products
     set stock = stock - p_qty
   where id = p_product_id
     and is_active
     and stock >= p_qty
  returning stock into remaining;

  return found;
end;
$$;

-- ------------------------------------------------------------
-- Storage bucket for product images (uploads go through the
-- server API route using the service-role key)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

-- ------------------------------------------------------------
-- Supabase Realtime — dashboard live conversations/messages
-- ------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null; end;
end $$;
