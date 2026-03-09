-- ── Cash Register Sessions ──────────────────────────────────────────────────
-- Each session represents an open/close cycle of the cash drawer.

create table if not exists cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  initial_balance decimal(10,2) not null default 0,
  final_balance   decimal(10,2),
  status          text not null default 'open' check (status in ('open','closed')),
  notes           text,
  created_at      timestamptz default now()
);

-- ── Cash Manual Entries (Sangria / Suprimento) ────────────────────────────────
-- Manual cash movements that don't come from orders.

create table if not exists cash_entries (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references cash_sessions(id) on delete cascade,
  type           text not null check (type in ('sangria','suprimento')),
  amount         decimal(10,2) not null,
  description    text,
  payment_method text default 'cash',
  created_at     timestamptz default now()
);

-- Indexes for performance
create index if not exists cash_sessions_status_idx on cash_sessions(status);
create index if not exists cash_entries_session_idx on cash_entries(session_id);
create index if not exists cash_entries_created_idx on cash_entries(created_at desc);

-- RLS: admin-only (disable RLS entirely for service-role access)
alter table cash_sessions enable row level security;
alter table cash_entries  enable row level security;

-- Service role bypasses RLS automatically, so no additional policies needed
-- for server-side API routes using the service role key.
