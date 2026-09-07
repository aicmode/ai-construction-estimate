-- ===========================================================================
-- AI Construction Estimate :: 0002 Row Level Security
--
-- Model: every business row carries `organization_id`. A row is visible/
-- writable only to authenticated users who hold a membership row for that
-- organization. There is no policy path that lets a user reach another
-- organization's data, so tampering with an id in the URL yields "not found".
-- ===========================================================================

alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.company_settings      enable row level security;
alter table public.customers             enable row level security;
alter table public.projects              enable row level security;
alter table public.estimates             enable row level security;
alter table public.estimate_items        enable row level security;
alter table public.ai_reviews            enable row level security;
alter table public.estimate_number_counters enable row level security;

-- Force RLS also for the table owner role used by the SQL editor helpers.
alter table public.estimate_number_counters force row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

-- Organizations are created through public.create_organization() only.

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- company_settings
-- ---------------------------------------------------------------------------
drop policy if exists company_settings_select on public.company_settings;
create policy company_settings_select on public.company_settings
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists company_settings_insert on public.company_settings;
create policy company_settings_insert on public.company_settings
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists company_settings_update on public.company_settings;
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- customers / projects / estimates / estimate_items / ai_reviews
-- Same shape for every org-scoped business table.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['customers', 'projects', 'estimates', 'estimate_items', 'ai_reviews']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_org_member(organization_id))',
      t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',
      t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_org_member(organization_id))',
      t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- estimate_number_counters: no direct client access. Reached exclusively via
-- public.next_estimate_number() which is SECURITY DEFINER.
-- ---------------------------------------------------------------------------
revoke all on public.estimate_number_counters from anon, authenticated;
