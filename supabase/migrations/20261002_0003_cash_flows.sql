-- Vectes Journal · deposits, withdrawals and credit
--
-- MT4 records balance operations (deposits, withdrawals, bonuses) as history rows with
-- their own ticket. Keeping them lets the Journal separate trading results from money
-- moved in or out, so equity, return and drawdown are measured correctly.

create table public.cash_flows (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  account_id  uuid not null references public.trading_accounts on delete cascade,
  ticket      text not null,
  kind        text not null check (kind in ('balance', 'credit')),
  amount      numeric not null,                    -- positive in, negative out
  time        timestamptz not null,
  comment     text,
  source      text not null check (source in ('ea', 'statement', 'demo')),
  created_at  timestamptz not null default now(),
  unique (account_id, ticket)
);

create index cash_flows_account_idx on public.cash_flows (account_id, time);

alter table public.cash_flows enable row level security;

create policy "Own cash flows" on public.cash_flows
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

revoke all on public.cash_flows from anon;
grant select, insert, update, delete on public.cash_flows to authenticated;
