import "server-only";

import type { CustomerRow } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { escapeLikePattern } from "@/server/queries/util";

export type Customer = CustomerRow;

export interface CustomerListItem extends Customer {
  projectCount: number;
  estimateCount: number;
}

/**
 * Every query filters on `organization_id` in addition to the RLS policy. The
 * policy is the security boundary; the explicit filter keeps a user who belongs
 * to several organizations from seeing rows of the one they are not viewing.
 */
export async function listCustomers(
  organizationId: string,
  options: { q?: string } = {},
): Promise<CustomerListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*, projects(count), estimates(count)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);

  const keyword = options.q?.trim();
  if (keyword) {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    query = query.or(
      `name.ilike.${pattern},company_name.ilike.${pattern},contact_name.ilike.${pattern},address.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`顧客一覧を取得できませんでした: ${error.message}`);

  return (data ?? []).map((row) => {
    const { projects, estimates, ...customer } = row;
    return {
      ...customer,
      projectCount: projects?.[0]?.count ?? 0,
      estimateCount: estimates?.[0]?.count ?? 0,
    };
  });
}

export async function getCustomer(
  organizationId: string,
  customerId: string,
): Promise<Customer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error(`顧客を取得できませんでした: ${error.message}`);
  return data;
}

export interface CustomerOption {
  id: string;
  name: string;
  companyName: string;
}

export async function listCustomerOptions(organizationId: string): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, company_name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
    .limit(500);

  if (error) throw new Error(`顧客を取得できませんでした: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    companyName: row.company_name,
  }));
}
