-- ===========================================================================
-- AI Construction Estimate :: 0001 schema
-- PostgreSQL (Supabase). Money is stored as BIGINT in whole JPY (円).
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.work_type as enum (
    'reform', 'interior', 'exterior', 'painting', 'plumbing',
    'electrical', 'equipment', 'demolition', 'new_build', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'planning', 'estimating', 'contracted', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estimate_status as enum (
    'DRAFT', 'REVIEW', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.item_category as enum (
    'demolition', 'carpentry', 'interior_finish', 'exterior_finish', 'painting',
    'plumbing', 'electrical', 'equipment', 'waterproofing', 'scaffolding',
    'waste_disposal', 'temporary_works', 'design', 'management', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.unit_type as enum (
    'set', 'sqm', 'm', 'piece', 'unit', 'person', 'day', 'hour', 'kit', 'cbm', 'kg'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_source as enum ('rule', 'ai', 'hybrid');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text        not null,
  display_name text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile row whenever a Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- organizations / membership
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            public.member_role not null default 'member',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_org_members_org on public.organization_members (organization_id);

drop trigger if exists trg_org_members_updated_at on public.organization_members;
create trigger trg_org_members_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER so that RLS policies can call it without recursing into the
-- policies defined on organization_members itself.
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members other
      on other.organization_id = me.organization_id
    where me.user_id = auth.uid()
      and other.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- company_settings (estimate issuer information, one row per organization)
-- ---------------------------------------------------------------------------
create table if not exists public.company_settings (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null unique references public.organizations (id) on delete cascade,
  company_name                text not null default '',
  postal_code                 text not null default '',
  address                     text not null default '',
  phone                       text not null default '',
  email                       text not null default '',
  contact_name                text not null default '',
  invoice_registration_number text not null default '',
  bank_account                text not null default '',
  default_tax_rate            numeric(5, 2) not null default 10.00
                                check (default_tax_rate >= 0 and default_tax_rate <= 100),
  default_validity_days       integer not null default 30
                                check (default_validity_days between 1 and 365),
  default_payment_terms       text not null default '',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  company_name    text not null default '',
  contact_name    text not null default '',
  phone           text not null default '',
  email           text not null default '',
  postal_code     text not null default '',
  address         text not null default '',
  notes           text not null default '',
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_customers_org on public.customers (organization_id);
create index if not exists idx_customers_org_created on public.customers (organization_id, created_at desc);
create index if not exists idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects (construction projects)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  -- Deleting a customer that still has projects must fail loudly rather than
  -- silently destroying project history.
  customer_id          uuid not null references public.customers (id) on delete restrict,
  name                 text not null check (char_length(btrim(name)) between 1 and 160),
  work_type            public.work_type not null default 'other',
  site_address         text not null default '',
  description          text not null default '',
  scheduled_start_date date,
  scheduled_end_date   date,
  manager_name         text not null default '',
  status               public.project_status not null default 'planning',
  notes                text not null default '',
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint projects_schedule_order check (
    scheduled_start_date is null
    or scheduled_end_date is null
    or scheduled_end_date >= scheduled_start_date
  )
);

create index if not exists idx_projects_org on public.projects (organization_id);
create index if not exists idx_projects_org_status on public.projects (organization_id, status);
create index if not exists idx_projects_customer on public.projects (customer_id);
create index if not exists idx_projects_name_trgm on public.projects using gin (name gin_trgm_ops);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- estimates
-- ---------------------------------------------------------------------------
create table if not exists public.estimates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  project_id       uuid references public.projects (id) on delete set null,
  estimate_number  text not null check (char_length(estimate_number) between 3 and 40),
  title            text not null check (char_length(btrim(title)) between 1 and 160),
  issue_date       date not null default current_date,
  valid_until      date,
  status           public.estimate_status not null default 'DRAFT',
  payment_terms    text not null default '',
  notes            text not null default '',
  tax_rate         numeric(5, 2) not null default 10.00 check (tax_rate >= 0 and tax_rate <= 100),
  -- All monetary columns are whole JPY.
  discount_amount  bigint not null default 0 check (discount_amount >= 0),
  items_subtotal   bigint not null default 0 check (items_subtotal >= 0),
  subtotal_amount  bigint not null default 0,
  tax_amount       bigint not null default 0,
  total_amount     bigint not null default 0,
  cost_amount      bigint not null default 0 check (cost_amount >= 0),
  gross_profit     bigint not null default 0,
  gross_margin_rate numeric(7, 4) not null default 0,
  deleted_at       timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint estimates_number_unique unique (organization_id, estimate_number),
  constraint estimates_validity_order check (valid_until is null or valid_until >= issue_date)
);

create index if not exists idx_estimates_org_status on public.estimates (organization_id, status);
create index if not exists idx_estimates_org_issue on public.estimates (organization_id, issue_date desc);
create index if not exists idx_estimates_org_updated on public.estimates (organization_id, updated_at desc);
create index if not exists idx_estimates_customer on public.estimates (customer_id);
create index if not exists idx_estimates_project on public.estimates (project_id);
create index if not exists idx_estimates_title_trgm on public.estimates using gin (title gin_trgm_ops);
create index if not exists idx_estimates_number_trgm on public.estimates using gin (estimate_number gin_trgm_ops);

drop trigger if exists trg_estimates_updated_at on public.estimates;
create trigger trg_estimates_updated_at
  before update on public.estimates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- estimate_items
-- ---------------------------------------------------------------------------
create table if not exists public.estimate_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  estimate_id     uuid not null references public.estimates (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 160),
  category        public.item_category not null default 'other',
  description     text not null default '',
  quantity        numeric(14, 3) not null default 0 check (quantity >= 0),
  unit            public.unit_type not null default 'set',
  unit_price      bigint not null default 0 check (unit_price >= 0),
  unit_cost       bigint not null default 0 check (unit_cost >= 0),
  amount          bigint not null default 0 check (amount >= 0),
  cost_amount     bigint not null default 0 check (cost_amount >= 0),
  sort_order      integer not null default 0 check (sort_order >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_estimate_items_estimate on public.estimate_items (estimate_id, sort_order);
create index if not exists idx_estimate_items_org on public.estimate_items (organization_id);

drop trigger if exists trg_estimate_items_updated_at on public.estimate_items;
create trigger trg_estimate_items_updated_at
  before update on public.estimate_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.ai_reviews (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  estimate_id      uuid not null references public.estimates (id) on delete cascade,
  source           public.review_source not null default 'rule',
  model            text not null default '',
  summary          text not null default '',
  findings         jsonb not null default '[]'::jsonb,
  metrics          jsonb not null default '{}'::jsonb,
  ai_error         text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_ai_reviews_estimate on public.ai_reviews (estimate_id, created_at desc);
create index if not exists idx_ai_reviews_org on public.ai_reviews (organization_id);

-- ---------------------------------------------------------------------------
-- estimate number counters (per organization / per year)
-- ---------------------------------------------------------------------------
create table if not exists public.estimate_number_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null check (year between 2000 and 2999),
  last_number     integer not null default 0 check (last_number >= 0),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, year)
);
