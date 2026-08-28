-- ===========================================================================
-- Verified Buyer & Delivery Pre-Payment System
-- Run in Supabase SQL Editor (or as a migration). Idempotent.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. users: verified-buyer counters
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists successful_order_count integer not null default 0;
alter table public.users
  add column if not exists is_verified_buyer boolean not null default false;
alter table public.users
  add column if not exists verified_at timestamptz;

create index if not exists users_is_verified_buyer_idx
  on public.users (is_verified_buyer);

-- ---------------------------------------------------------------------------
-- 2. delivery_payments: delivery-charge pre-payments of unverified buyers
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_payments (
  id                serial primary key,
  user_id           integer not null references public.users(id) on delete cascade,
  order_id          integer not null references public.orders(id) on delete cascade,
  payment_method    text not null,                       -- bkash | nagad | rocket
  transaction_id    text not null,
  delivery_charge   numeric not null default 0,
  payment_amount    numeric not null default 0,
  payment_status    text not null default 'pending',     -- pending | verified | failed | refunded
  verification_method text,                              -- manual | auto
  admin_note        text,
  verified_by       integer,
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- SECURITY: one transaction ID can ever be linked to exactly one payment.
-- This unique index is the database-level final guard against replayed or
-- fabricated TxnIDs (application-level check runs first for a nicer message).
create unique index if not exists delivery_payments_transaction_id_idx
  on public.delivery_payments (transaction_id);

create index if not exists delivery_payments_user_idx
  on public.delivery_payments (user_id);
create index if not exists delivery_payments_order_idx
  on public.delivery_payments (order_id);
create index if not exists delivery_payments_status_idx
  on public.delivery_payments (payment_status);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--    Markora does NOT use Supabase Auth: sessions are app-managed (bcrypt +
--    httpOnly cookie) and users.id is an app serial integer, so auth.uid()
--    (uuid) cannot be matched against it. All database access goes through
--    the Next.js server, which connects as the table owner (bypasses RLS)
--    and enforces admin/ownership checks in application code (requireAdmin,
--    user.id scoping).
--    Therefore: enable RLS and create NO permissive policies — direct client
--    access (anon/authenticated) through the Supabase API is fully denied
--    for these tables.
-- ---------------------------------------------------------------------------
alter table public.delivery_payments enable row level security;
alter table public.users enable row level security;

drop policy if exists "Buyers read own delivery payments" on public.delivery_payments;
drop policy if exists "Users read own profile" on public.users;
