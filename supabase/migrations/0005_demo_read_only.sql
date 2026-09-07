-- ===========================================================================
-- AI Construction Estimate :: 0005 demo read-only accounts
--
-- The portfolio demo is a *shared* account: anyone who clicks「デモ環境を見る」
-- signs into the same organization. Without this migration a visitor could
-- edit or delete the seeded data and break the demo for the next visitor.
--
-- The account is marked in the database (`profiles.is_demo`) rather than by
-- comparing e-mail addresses in application code, so the restriction holds for
-- requests that never touch the Next.js server at all — a raw PostgREST call
-- made with the anon key and a demo session token is refused by PostgreSQL
-- itself.
--
-- Three independent layers, in order of the request path:
--   1. RLS      — the INSERT/UPDATE/DELETE policies stop matching for a demo
--                 user, which covers every direct REST write.
--   2. Triggers — statement-level BEFORE triggers reject the write even when it
--                 arrives through a SECURITY DEFINER function, which is exactly
--                 where RLS does not apply.
--   3. RPC      — the writable functions check the flag themselves so a direct
--                 RPC call fails with a clear error instead of a policy error.
--
-- Enabling the demo account (run once, after seeding, in the SQL editor):
--
--     update public.profiles set is_demo = true where email = '<demo address>';
--
-- Seed with a normal account and flip the flag afterwards: the seeder writes
-- through RLS as the user it signs in as, so a demo-flagged account cannot
-- seed. Turning the demo back into a writable account is the same statement
-- with `false`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Demo identification
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'Shared read-only portfolio demo account. Writes are refused by RLS, by the '
  'deny_demo_write() triggers and by the writable RPCs.';

-- SECURITY DEFINER so the lookup does not depend on the policies of the very
-- table it reads, and STABLE so PostgreSQL evaluates it once per statement
-- instead of once per row.
--
-- Returns false when there is no authenticated user: the service role, the
-- `handle_new_user` signup trigger and psql/SQL-editor maintenance all run
-- without `auth.uid()` and must keep working.
create or replace function public.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_demo from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_demo_user() from public, anon;
grant execute on function public.is_demo_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Table triggers (the layer that also covers SECURITY DEFINER functions)
--
-- Statement-level: one flag lookup per statement rather than per row, and it
-- fires even when the statement ends up matching zero rows.
-- ---------------------------------------------------------------------------
create or replace function public.deny_demo_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_demo_user() then
    -- 42501 = insufficient_privilege. The application maps this to a friendly
    -- Japanese message; the text below is never shown to a visitor.
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'organization_members', 'company_settings',
    'customers', 'projects', 'estimates', 'estimate_items', 'ai_reviews',
    'estimate_number_counters'
  ]
  loop
    execute format('drop trigger if exists trg_deny_demo_write on public.%I', t);
    execute format(
      'create trigger trg_deny_demo_write before insert or update or delete on public.%I '
      'for each statement execute function public.deny_demo_write()',
      t);
  end loop;
end $$;

-- The flag must not be editable by the account it restricts. The statement
-- trigger above already refuses every profile write from a demo user; this row
-- trigger additionally stops *any* signed-in user from moving the flag, so the
-- only way to grant or revoke demo status is an out-of-band SQL statement.
create or replace function public.protect_is_demo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_demo is distinct from old.is_demo and auth.uid() is not null then
    raise exception 'is_demo cannot be changed by an application request'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_is_demo on public.profiles;
create trigger trg_profiles_protect_is_demo
  before update on public.profiles
  for each row execute function public.protect_is_demo();

-- ---------------------------------------------------------------------------
-- 3. RLS write policies
--
-- Only the INSERT/UPDATE/DELETE policies are redefined, and only to add the
-- `not public.is_demo_user()` conjunct. Every SELECT policy from 0002 is left
-- untouched, so the demo keeps full read access.
-- ---------------------------------------------------------------------------

-- profiles: a demo visitor must not rename the shared account.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and not public.is_demo_user())
  with check (id = auth.uid() and not public.is_demo_user());

-- organizations: renaming the demo organization is a write like any other.
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_member(id) and not public.is_demo_user())
  with check (public.is_org_member(id) and not public.is_demo_user());

-- organization_members has no write policy at all (0002), so membership
-- changes were already impossible from a client session and stay that way.

drop policy if exists company_settings_insert on public.company_settings;
create policy company_settings_insert on public.company_settings
  for insert to authenticated
  with check (public.is_org_member(organization_id) and not public.is_demo_user());

drop policy if exists company_settings_update on public.company_settings;
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.is_org_member(organization_id) and not public.is_demo_user())
  with check (public.is_org_member(organization_id) and not public.is_demo_user());

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'projects', 'estimates', 'estimate_items', 'ai_reviews']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check (public.is_org_member(organization_id) and not public.is_demo_user())',
      t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (public.is_org_member(organization_id) and not public.is_demo_user()) '
      'with check (public.is_org_member(organization_id) and not public.is_demo_user())',
      t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using (public.is_org_member(organization_id) and not public.is_demo_user())',
      t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Writable RPCs
--
-- `next_estimate_number` and `create_organization` are SECURITY DEFINER: RLS
-- does not apply to the statements inside them, so each needs its own check.
-- The bodies are otherwise identical to 0003 / 0004.
-- ---------------------------------------------------------------------------
create or replace function public.next_estimate_number(p_org uuid, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

  if not public.is_org_member(p_org) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;

  if p_year is null or p_year < 2000 or p_year > 2999 then
    raise exception 'invalid year' using errcode = '22023';
  end if;

  insert into public.estimate_number_counters (organization_id, year, last_number)
  values (p_org, p_year, 1)
  on conflict (organization_id, year)
  do update set last_number = public.estimate_number_counters.last_number + 1,
                updated_at  = now()
  returning last_number into v_next;

  return 'EST-' || p_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.next_estimate_number(uuid, integer) from public, anon;
grant execute on function public.next_estimate_number(uuid, integer) to authenticated;

create or replace function public.create_organization(p_name text, p_company_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'organization name must be 1-120 characters' using errcode = '22023';
  end if;

  insert into public.organizations (name) values (v_name) returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_uid, 'owner');

  insert into public.company_settings (organization_id, company_name)
  values (v_org, btrim(coalesce(p_company_name, v_name)))
  on conflict (organization_id) do nothing;

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- `save_estimate` is SECURITY INVOKER, so the policies above and the triggers
-- already refuse it for a demo account. Redefined here only to add the explicit
-- check, which turns the RLS outcome (an UPDATE that silently matches no rows,
-- reported as "estimate not found") into an unambiguous refusal. The rest of
-- the body is unchanged from 0004.
-- ---------------------------------------------------------------------------
create or replace function public.save_estimate(
  p_org               uuid,
  p_estimate_id       uuid,
  p_customer_id       uuid,
  p_project_id        uuid,
  p_estimate_number   text,
  p_title             text,
  p_issue_date        date,
  p_valid_until       date,
  p_status            public.estimate_status,
  p_payment_terms     text,
  p_notes             text,
  p_tax_rate          numeric,
  p_discount_amount   bigint,
  p_items_subtotal    bigint,
  p_subtotal_amount   bigint,
  p_tax_amount        bigint,
  p_total_amount      bigint,
  p_cost_amount       bigint,
  p_gross_profit      bigint,
  p_gross_margin_rate numeric,
  p_items             jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_estimate  uuid := p_estimate_id;
  v_item      jsonb;
  v_index     integer := 0;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_org_member(p_org) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;

  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

  -- The customer must belong to the same organization. Without this check a
  -- crafted request could attach an estimate to a customer id from elsewhere.
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.organization_id = p_org
  ) then
    raise exception 'customer not found in organization' using errcode = '23503';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects pr
    where pr.id = p_project_id and pr.organization_id = p_org
  ) then
    raise exception 'project not found in organization' using errcode = '23503';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a json array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'items must contain between 1 and 200 rows' using errcode = '22023';
  end if;

  if v_estimate is null then
    insert into public.estimates (
      organization_id, customer_id, project_id, estimate_number, title,
      issue_date, valid_until, status, payment_terms, notes, tax_rate,
      discount_amount, items_subtotal, subtotal_amount, tax_amount, total_amount,
      cost_amount, gross_profit, gross_margin_rate, created_by
    ) values (
      p_org, p_customer_id, p_project_id, p_estimate_number, p_title,
      p_issue_date, p_valid_until, p_status, p_payment_terms, p_notes, p_tax_rate,
      p_discount_amount, p_items_subtotal, p_subtotal_amount, p_tax_amount, p_total_amount,
      p_cost_amount, p_gross_profit, p_gross_margin_rate, v_uid
    )
    returning id into v_estimate;
  else
    update public.estimates set
      customer_id       = p_customer_id,
      project_id        = p_project_id,
      title             = p_title,
      issue_date        = p_issue_date,
      valid_until       = p_valid_until,
      status            = p_status,
      payment_terms     = p_payment_terms,
      notes             = p_notes,
      tax_rate          = p_tax_rate,
      discount_amount   = p_discount_amount,
      items_subtotal    = p_items_subtotal,
      subtotal_amount   = p_subtotal_amount,
      tax_amount        = p_tax_amount,
      total_amount      = p_total_amount,
      cost_amount       = p_cost_amount,
      gross_profit      = p_gross_profit,
      gross_margin_rate = p_gross_margin_rate
    where id = v_estimate
      and organization_id = p_org
      and deleted_at is null;

    if not found then
      raise exception 'estimate not found' using errcode = 'P0002';
    end if;

    delete from public.estimate_items
    where estimate_id = v_estimate and organization_id = p_org;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.estimate_items (
      organization_id, estimate_id, name, category, description,
      quantity, unit, unit_price, unit_cost, amount, cost_amount, sort_order
    ) values (
      p_org,
      v_estimate,
      v_item ->> 'name',
      (v_item ->> 'category')::public.item_category,
      coalesce(v_item ->> 'description', ''),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unit')::public.unit_type,
      (v_item ->> 'unit_price')::bigint,
      (v_item ->> 'unit_cost')::bigint,
      (v_item ->> 'amount')::bigint,
      (v_item ->> 'cost_amount')::bigint,
      v_index
    );
    v_index := v_index + 1;
  end loop;

  return v_estimate;
end;
$$;

revoke all on function public.save_estimate(
  uuid, uuid, uuid, uuid, text, text, date, date, public.estimate_status,
  text, text, numeric, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  numeric, jsonb
) from public, anon;

grant execute on function public.save_estimate(
  uuid, uuid, uuid, uuid, text, text, date, date, public.estimate_status,
  text, text, numeric, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  numeric, jsonb
) to authenticated;
