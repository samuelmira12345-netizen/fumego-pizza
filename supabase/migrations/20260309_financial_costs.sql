-- ── Financial Costs (Custos Fixos e Impostos) ────────────────────────────────
-- Stores fixed monthly costs (rent, salaries, utilities) and
-- tax/variable cost rules (rate-based, calculated from revenue).

create table if not exists financial_costs (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('fixed', 'tax')),
  name        text not null,
  description text,
  amount      decimal(10,2),          -- monthly fixed amount (for type='fixed')
  rate        decimal(7,4),           -- percentage rate, e.g. 8.0 = 8% (for type='tax')
  base        text default 'gross' check (base in ('gross', 'net')),
  category    text,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists financial_costs_type_idx   on financial_costs(type);
create index if not exists financial_costs_active_idx on financial_costs(is_active);

alter table financial_costs enable row level security;
-- Service role bypasses RLS automatically.

-- Seed with common Brazilian restaurant costs
insert into financial_costs (type, name, description, amount, category) values
  ('fixed', 'Aluguel',           'Aluguel do espaço físico',   0.00, 'Imóvel'),
  ('fixed', 'Energia Elétrica',  'Conta de luz mensal',        0.00, 'Utilidades'),
  ('fixed', 'Água',              'Conta de água mensal',       0.00, 'Utilidades'),
  ('fixed', 'Internet',          'Plano de internet',          0.00, 'Utilidades'),
  ('fixed', 'Funcionários',      'Salários e encargos totais', 0.00, 'Pessoal')
on conflict do nothing;

insert into financial_costs (type, name, description, rate, base, category) values
  ('tax', 'Simples Nacional',  'Regime tributário Simples Nacional', 6.00, 'gross', 'Imposto'),
  ('tax', 'ISS',               'Imposto Sobre Serviços',            5.00, 'gross', 'Imposto'),
  ('tax', 'PIS/COFINS',        'PIS + COFINS cumulativo',           3.65, 'gross', 'Imposto')
on conflict do nothing;
