import "server-only";

import { ESTIMATE_STATUSES, type EstimateStatus, PIPELINE_STATUSES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { monthRange, toIso } from "@/server/queries/util";

/**
 * Aggregation is done in the application layer over a bounded window of rows
 * (see MAX_ROWS). For the SMB workload this product targets that is a single
 * indexed read; if an organization ever outgrows it the same numbers can be
 * moved into a PostgreSQL view without changing the page.
 */
const MAX_ROWS = 2000;
const TREND_MONTHS = 6;
const ATTENTION_MARGIN_RATE = 0.1;
const EXPIRY_SOON_DAYS = 7;

interface AggregateRow {
  id: string;
  status: EstimateStatus;
  issue_date: string;
  created_at: string;
  valid_until: string | null;
  total_amount: number;
  subtotal_amount: number;
  gross_profit: number;
  gross_margin_rate: number;
}

export interface TrendPoint {
  /** `YYYY-MM` */
  month: string;
  label: string;
  estimatedAmount: number;
  acceptedAmount: number;
}

export interface RecentEstimate {
  id: string;
  estimateNumber: string;
  title: string;
  customerName: string;
  status: EstimateStatus;
  totalAmount: number;
  grossMarginRate: number;
  updatedAt: string;
}

export interface DashboardData {
  monthLabel: string;
  monthlyCount: number;
  monthlyTotal: number;
  pipelineAmount: number;
  pipelineCount: number;
  acceptedYearAmount: number;
  acceptedYearCount: number;
  averageMarginRate: number;
  attentionCount: number;
  attentionEstimates: RecentEstimate[];
  statusCounts: Record<EstimateStatus, number>;
  trend: TrendPoint[];
  recent: RecentEstimate[];
  totalCount: number;
}

function emptyStatusCounts(): Record<EstimateStatus, number> {
  return ESTIMATE_STATUSES.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<EstimateStatus, number>,
  );
}

/** True when an estimate still open for negotiation carries a commercial risk. */
export function needsAttention(row: {
  status: EstimateStatus;
  gross_margin_rate: number;
  subtotal_amount: number;
  valid_until: string | null;
}, today: Date): boolean {
  if (row.status === "ACCEPTED" || row.status === "REJECTED") return false;

  if (row.subtotal_amount > 0 && row.gross_margin_rate < ATTENTION_MARGIN_RATE) return true;

  if (row.status === "EXPIRED") return true;

  if (row.valid_until) {
    const soon = new Date(today);
    soon.setDate(soon.getDate() + EXPIRY_SOON_DAYS);
    if (row.valid_until <= toIso(soon)) return true;
  }

  return false;
}

export async function getDashboardData(
  organizationId: string,
  today: Date = new Date(),
): Promise<DashboardData> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("estimates")
    .select(
      "id, status, issue_date, created_at, valid_until, total_amount, subtotal_amount, gross_profit, gross_margin_rate",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(MAX_ROWS);

  if (error) throw new Error(`ダッシュボードを集計できませんでした: ${error.message}`);

  const rows = (data ?? []) as AggregateRow[];
  const { start: monthStart, end: monthEnd } = monthRange(today);
  const yearPrefix = `${today.getFullYear()}-`;

  const statusCounts = emptyStatusCounts();
  let monthlyCount = 0;
  let monthlyTotal = 0;
  let pipelineAmount = 0;
  let pipelineCount = 0;
  let acceptedYearAmount = 0;
  let acceptedYearCount = 0;
  let marginRevenue = 0;
  let marginProfit = 0;
  const attentionIds: string[] = [];

  const trendBuckets = new Map<string, { estimatedAmount: number; acceptedAmount: number }>();
  for (let offset = TREND_MONTHS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    trendBuckets.set(monthKey(date), { estimatedAmount: 0, acceptedAmount: 0 });
  }

  for (const row of rows) {
    statusCounts[row.status] += 1;

    const createdDay = row.created_at.slice(0, 10);
    if (createdDay >= monthStart && createdDay <= monthEnd) {
      monthlyCount += 1;
      monthlyTotal += row.total_amount;
    }

    if (PIPELINE_STATUSES.includes(row.status)) {
      pipelineAmount += row.total_amount;
      pipelineCount += 1;
    }

    if (row.status === "ACCEPTED") {
      if (row.issue_date.startsWith(yearPrefix)) {
        acceptedYearAmount += row.total_amount;
        acceptedYearCount += 1;
      }
      marginRevenue += row.subtotal_amount;
      marginProfit += row.gross_profit;
    } else if (row.status !== "REJECTED") {
      marginRevenue += row.subtotal_amount;
      marginProfit += row.gross_profit;
    }

    const bucket = trendBuckets.get(row.issue_date.slice(0, 7));
    if (bucket) {
      bucket.estimatedAmount += row.total_amount;
      if (row.status === "ACCEPTED") bucket.acceptedAmount += row.total_amount;
    }

    if (needsAttention(row, today)) attentionIds.push(row.id);
  }

  const [recent, attentionEstimates] = await Promise.all([
    listRecentEstimates(organizationId, 6),
    attentionIds.length > 0 ? listEstimatesByIds(organizationId, attentionIds.slice(0, 5)) : Promise.resolve([]),
  ]);

  return {
    monthLabel: `${today.getFullYear()}年${today.getMonth() + 1}月`,
    monthlyCount,
    monthlyTotal,
    pipelineAmount,
    pipelineCount,
    acceptedYearAmount,
    acceptedYearCount,
    averageMarginRate: marginRevenue > 0 ? Math.round((marginProfit / marginRevenue) * 10_000) / 10_000 : 0,
    attentionCount: attentionIds.length,
    attentionEstimates,
    statusCounts,
    trend: [...trendBuckets.entries()].map(([month, value]) => ({
      month,
      label: `${Number(month.slice(5, 7))}月`,
      ...value,
    })),
    recent,
    totalCount: rows.length,
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

async function listRecentEstimates(
  organizationId: string,
  limit: number,
): Promise<RecentEstimate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("id, estimate_number, title, status, total_amount, gross_margin_rate, updated_at, customers(name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`最近の見積を取得できませんでした: ${error.message}`);
  return (data ?? []).map(mapRecent);
}

async function listEstimatesByIds(
  organizationId: string,
  ids: string[],
): Promise<RecentEstimate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("id, estimate_number, title, status, total_amount, gross_margin_rate, updated_at, customers(name)")
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (error) throw new Error(`要注意見積を取得できませんでした: ${error.message}`);
  return (data ?? []).map(mapRecent);
}

function mapRecent(row: {
  id: string;
  estimate_number: string;
  title: string;
  status: EstimateStatus;
  total_amount: number;
  gross_margin_rate: number;
  updated_at: string;
  customers: { name: string } | null;
}): RecentEstimate {
  return {
    id: row.id,
    estimateNumber: row.estimate_number,
    title: row.title,
    customerName: row.customers?.name ?? "（顧客未設定）",
    status: row.status,
    totalAmount: row.total_amount,
    grossMarginRate: row.gross_margin_rate,
    updatedAt: row.updated_at,
  };
}
