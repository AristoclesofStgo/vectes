-- Vectes Journal · MT4 Expert Advisor ingest
--
-- Each user can create personal tokens for the Vectes EA. Only a SHA-256 hash is
-- stored; the raw token is shown once in the browser. The mt4-ingest Edge Function
-- looks the hash up with the service role, so tokens never need a Supabase session.

create table public.ingest_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  label        text not null default 'MT4' check (char_length(label) between 1 and 60),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 4 and 16),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index ingest_tokens_user_idx on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;

create policy "Own tokens" on public.ingest_tokens
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.has_access()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));

-- Browsers may create, list, rename and revoke tokens, never rewrite the hash or usage
revoke all on public.ingest_tokens from anon, authenticated;
grant select, delete on public.ingest_tokens to authenticated;
grant insert (label, token_hash, token_prefix) on public.ingest_tokens to authenticated;
grant update (label, revoked_at) on public.ingest_tokens to authenticated;

-- Live account figures reported by the EA on every sync
alter table public.trading_accounts
  add column balance      numeric,
  add column equity       numeric,
  add column last_sync_at timestamptz;
