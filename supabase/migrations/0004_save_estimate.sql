-- ===========================================================================
-- AI Construction Estimate :: 0004 atomic estimate write
--
-- supabase-js cannot open a transaction, so writing an estimate and replacing
-- its line items through separate REST calls could leave a header without
-- details if the second call failed. This function performs the whole write in
-- a single transaction.
--
-- It runs as SECURITY INVOKER on purpose: Row Level Security still applies to
-- every statement inside, so the function can never be used to reach another
-- organization's data. The explicit membership/ownership checks below turn a
-- silently-empty RLS result into a clear error.
-- ===========================================================================

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
