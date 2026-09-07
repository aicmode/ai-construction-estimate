import "server-only";

import type { AiReviewRow, EstimateItemRow, EstimateRow } from "@/lib/database.types";
import type { EstimateStatus } from "@/lib/domain";
import type { ReviewFinding, ReviewMetrics } from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";
import type { EstimateListFilter } from "@/lib/validation/estimate";
import { escapeLikePattern } from "@/server/queries/util";

export type Estimate = EstimateRow;
export type EstimateItem = EstimateItemRow;

export interface EstimateListItem extends Estimate {
  customerName: string;
  projectName: string | null;
}

export interface EstimateDetail extends Estimate {
  items: EstimateItem[];
  customer: {
    id: string;
    name: string;
    companyName: string;
    contactName: string;
    postalCode: string;
    address: string;
    phone: string;
    email: string;
  };
  project: {
    id: string;
    name: string;
    siteAddress: string;
    workType: string;
  } | null;
}

const LIST_SELECT = "*, customers(name), projects(name)";

export async function listEstimates(
  organizationId: string,
  filter: EstimateListFilter = {},
): Promise<EstimateListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("estimates")
    .select(LIST_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.customerId) query = query.eq("customer_id", filter.customerId);
  if (filter.from) query = query.gte("issue_date", filter.from);
  if (filter.to) query = query.lte("issue_date", filter.to);

  const keyword = filter.q?.trim();
  if (keyword) {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    query = query.or(`title.ilike.${pattern},estimate_number.ilike.${pattern},notes.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`見積一覧を取得できませんでした: ${error.message}`);

  return (data ?? []).map(toListItem);
}

function toListItem(row: EstimateRow & {
  customers: { name: string } | null;
  projects: { name: string } | null;
}): EstimateListItem {
  const { customers, projects, ...estimate } = row;
  return {
    ...estimate,
    customerName: customers?.name ?? "（顧客未設定）",
    projectName: projects?.name ?? null,
  };
}

export async function getEstimateDetail(
  organizationId: string,
  estimateId: string,
): Promise<EstimateDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("estimates")
    .select(
      "*, customers(id, name, company_name, contact_name, postal_code, address, phone, email), projects(id, name, site_address, work_type)",
    )
    .eq("organization_id", organizationId)
    .eq("id", estimateId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`見積を取得できませんでした: ${error.message}`);
  if (!data) return null;

  const { customers, projects, ...estimate } = data;

  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });

  if (itemsError) throw new Error(`見積明細を取得できませんでした: ${itemsError.message}`);

  return {
    ...estimate,
    items: items ?? [],
    customer: {
      id: customers?.id ?? "",
      name: customers?.name ?? "",
      companyName: customers?.company_name ?? "",
      contactName: customers?.contact_name ?? "",
      postalCode: customers?.postal_code ?? "",
      address: customers?.address ?? "",
      phone: customers?.phone ?? "",
      email: customers?.email ?? "",
    },
    project: projects
      ? {
          id: projects.id,
          name: projects.name,
          siteAddress: projects.site_address,
          workType: projects.work_type,
        }
      : null,
  };
}

export interface StoredReview {
  id: string;
  source: AiReviewRow["source"];
  model: string;
  summary: string;
  findings: ReviewFinding[];
  metrics: ReviewMetrics | null;
  aiError: string | null;
  createdAt: string;
}

/** Most recent stored review for an estimate, or `null` if never reviewed. */
export async function getLatestReview(
  organizationId: string,
  estimateId: string,
): Promise<StoredReview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_reviews")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`AIレビュー履歴を取得できませんでした: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    source: data.source,
    model: data.model,
    summary: data.summary,
    findings: Array.isArray(data.findings) ? (data.findings as ReviewFinding[]) : [],
    metrics:
      data.metrics && typeof data.metrics === "object" && !Array.isArray(data.metrics)
        ? (data.metrics as ReviewMetrics)
        : null,
    aiError: data.ai_error,
    createdAt: data.created_at,
  };
}

export async function countEstimatesByStatus(
  organizationId: string,
): Promise<Record<EstimateStatus, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) throw new Error(`ステータス集計を取得できませんでした: ${error.message}`);

  const counts = {
    DRAFT: 0,
    REVIEW: 0,
    SUBMITTED: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    EXPIRED: 0,
  } satisfies Record<EstimateStatus, number>;

  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}
