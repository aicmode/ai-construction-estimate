import "server-only";

import type { ProjectRow } from "@/lib/database.types";
import type { ProjectStatus, WorkType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { escapeLikePattern } from "@/server/queries/util";

export type Project = ProjectRow;

export interface ProjectListItem extends Project {
  customerName: string;
  estimateCount: number;
}

export interface ProjectWithCustomer extends Project {
  customerName: string;
  customerCompanyName: string;
}

export async function listProjects(
  organizationId: string,
  options: { q?: string; status?: ProjectStatus; workType?: WorkType; customerId?: string } = {},
): Promise<ProjectListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("*, customers(name), estimates(count)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (options.status) query = query.eq("status", options.status);
  if (options.workType) query = query.eq("work_type", options.workType);
  if (options.customerId) query = query.eq("customer_id", options.customerId);

  const keyword = options.q?.trim();
  if (keyword) {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    query = query.or(`name.ilike.${pattern},site_address.ilike.${pattern},manager_name.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`工事案件を取得できませんでした: ${error.message}`);

  return (data ?? []).map((row) => {
    const { customers, estimates, ...project } = row;
    return {
      ...project,
      customerName: customers?.name ?? "（顧客未設定）",
      estimateCount: estimates?.[0]?.count ?? 0,
    };
  });
}

export async function getProject(
  organizationId: string,
  projectId: string,
): Promise<ProjectWithCustomer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, customers(name, company_name)")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`工事案件を取得できませんでした: ${error.message}`);
  if (!data) return null;

  const { customers, ...project } = data;
  return {
    ...project,
    customerName: customers?.name ?? "",
    customerCompanyName: customers?.company_name ?? "",
  };
}

export interface ProjectOption {
  id: string;
  name: string;
  customerId: string;
  workType: WorkType;
  siteAddress: string;
}

export async function listProjectOptions(organizationId: string): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, customer_id, work_type, site_address")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`工事案件を取得できませんでした: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    customerId: row.customer_id,
    workType: row.work_type,
    siteAddress: row.site_address,
  }));
}
