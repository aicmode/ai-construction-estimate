-- ===========================================================================
-- AI Construction Estimate :: 0003 RPC functions
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- create_organization
-- Bootstraps an organization for the calling user. SECURITY DEFINER because a
-- brand new user has no membership yet and therefore cannot satisfy the RLS
-- policies on `organizations` / `organization_members`.
-- ---------------------------------------------------------------------------
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
-- next_estimate_number
-- Atomically allocates the next human readable estimate number for an
-- organization/year pair, e.g. EST-2026-0001. The UPSERT takes a row lock so
-- concurrent callers can never receive the same number; `estimates` also has a
-- UNIQUE (organization_id, estimate_number) constraint as a hard backstop.
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

-- ---------------------------------------------------------------------------
-- Helper grants
-- ---------------------------------------------------------------------------
revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke all on function public.shares_org_with(uuid) from public, anon;
grant execute on function public.shares_org_with(uuid) to authenticated;
