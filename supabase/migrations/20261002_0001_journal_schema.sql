-- Vectes Journal · schema, row-level security and demo expiry
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Every table is private to its owner through RLS. Demo visitors are Supabase
-- anonymous users: they get 7 days of access and are deleted the day after.

-- ── Profiles ──────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  is_demo      boolean not null default false,
  access_until timestamptz,                       -- null = no expiry
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile but never write it (that would let a demo extend itself)
create policy "Read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- One profile per new auth user; anonymous sign-ins are demo accounts
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, is_demo, access_until)
  values (
    new.id,
    coalesce(new.is_anonymous, false),
    case when coalesce(new.is_anonymous, false) then now() + interval '7 days' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True while the signed-in user's access is valid (always for real accounts)
create function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.access_until is null or p.access_until > now())
  );
$$;

-- ── Trading accounts (one per broker account) ─────────────
create table public.trading_accounts (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null default auth.uid() references auth.users on delete cascade,
  platform                  text not null default 'MT4' check (platform in ('MT4')),
  broker                    text not null,
  account_number            text not null,
  currency                  text not null default 'USD',
  server_utc_offset_minutes integer,               -- broker server time minus UTC
  label                     text,
  created_at                timestamptz not null default now(),
  unique (user_id, broker, account_number)
);

alter table public.trading_accounts enable row level security;

create policy "Own accounts" on public.trading_accounts
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.has_access()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));

-- ── Trades (closed positions, one canonical shape for every source) ──
create table public.trades (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  account_id  uuid not null references public.trading_accounts on delete cascade,
  ticket      text not null,
  symbol      text not null,                       -- as reported by the broker, e.g. xauusd
  asset_id    text,                                -- Vectes asset, e.g. XAU; null when unmapped
  side        text not null check (side in ('buy', 'sell')),
  volume      numeric(14, 2) not null check (volume > 0),
  open_time   timestamptz not null,
  open_price  numeric not null,
  close_time  timestamptz not null,
  close_price numeric not null,
  stop_loss   numeric,
  take_profit numeric,
  commission  numeric not null default 0,
  taxes       numeric not null default 0,
  swap        numeric not null default 0,
  profit      numeric not null,
  source      text not null check (source in ('ea', 'statement', 'demo')),
  notes       text,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (account_id, ticket),
  check (close_time >= open_time)
);

create index trades_user_close_idx on public.trades (user_id, close_time desc);
create index trades_account_idx on public.trades (account_id);

alter table public.trades enable row level security;

-- A trade must belong to the caller and point at one of the caller's accounts
create policy "Own trades" on public.trades
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.has_access()))
  with check (
    user_id = (select auth.uid())
    and (select public.has_access())
    and exists (
      select 1 from public.trading_accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trades_touch_updated_at
  before update on public.trades
  for each row execute function public.touch_updated_at();

-- ── API access: signed-in users only (RLS still decides which rows) ──
revoke all on public.profiles, public.trading_accounts, public.trades from anon;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.trading_accounts, public.trades to authenticated;
revoke execute on function public.has_access() from anon, public;
grant execute on function public.has_access() to authenticated;

-- ── Demo clean-up: delete expired anonymous users daily (cascades to their data) ──
create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-demos',
  '15 3 * * *',
  $$
    delete from auth.users u
    using public.profiles p
    where p.id = u.id
      and u.is_anonymous
      and p.is_demo
      and p.access_until < now() - interval '1 day'
  $$
);
