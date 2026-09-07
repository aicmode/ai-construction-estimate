/**
 * Domain vocabulary shared by the database (PostgreSQL enums), the Zod
 * schemas, the UI and the PDF renderer. Keeping the tuples `as const` means a
 * new enum value has to be added in exactly one place per concept.
 */

export const WORK_TYPES = [
  "reform",
  "interior",
  "exterior",
  "painting",
  "plumbing",
  "electrical",
  "equipment",
  "demolition",
  "new_build",
  "other",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  reform: "リフォーム",
  interior: "内装",
  exterior: "外装",
  painting: "塗装",
  plumbing: "水回り",
  electrical: "電気",
  equipment: "設備",
  demolition: "解体",
  new_build: "新築",
  other: "その他",
};

export const PROJECT_STATUSES = [
  "planning",
  "estimating",
  "contracted",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "計画中",
  estimating: "見積中",
  contracted: "受注",
  in_progress: "施工中",
  completed: "完了",
  cancelled: "中止",
};

export const ESTIMATE_STATUSES = [
  "DRAFT",
  "REVIEW",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: "下書き",
  REVIEW: "確認中",
  SUBMITTED: "提出済み",
  ACCEPTED: "受注",
  REJECTED: "失注",
  EXPIRED: "期限切れ",
};

/** Statuses that count towards the "expected order value" pipeline. */
export const PIPELINE_STATUSES: readonly EstimateStatus[] = ["REVIEW", "SUBMITTED"];

export const ITEM_CATEGORIES = [
  "demolition",
  "carpentry",
  "interior_finish",
  "exterior_finish",
  "painting",
  "plumbing",
  "electrical",
  "equipment",
  "waterproofing",
  "scaffolding",
  "waste_disposal",
  "temporary_works",
  "design",
  "management",
  "other",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  demolition: "解体・撤去",
  carpentry: "木工事",
  interior_finish: "内装仕上",
  exterior_finish: "外装仕上",
  painting: "塗装",
  plumbing: "給排水・衛生",
  electrical: "電気",
  equipment: "設備機器",
  waterproofing: "防水",
  scaffolding: "仮設足場",
  waste_disposal: "廃材処分",
  temporary_works: "仮設工事",
  design: "設計・申請",
  management: "現場管理費",
  other: "その他",
};

export const UNIT_TYPES = [
  "set",
  "sqm",
  "m",
  "piece",
  "unit",
  "person",
  "day",
  "hour",
  "kit",
  "cbm",
  "kg",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_LABELS: Record<UnitType, string> = {
  set: "式",
  sqm: "㎡",
  m: "m",
  piece: "個",
  unit: "台",
  person: "人",
  day: "日",
  hour: "時間",
  kit: "セット",
  cbm: "㎥",
  kg: "kg",
};

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
};

export const REVIEW_SOURCES = ["rule", "ai", "hybrid"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** Severity ladder used by both the rule engine and the AI layer. */
export const FINDING_SEVERITIES = ["danger", "warning", "info", "good"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  danger: "危険",
  warning: "注意",
  info: "確認",
  good: "良好",
};

export const FINDING_CATEGORIES = [
  "profitability",
  "pricing",
  "data_quality",
  "composition",
  "compliance",
  "schedule",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  profitability: "収益性",
  pricing: "価格設定",
  data_quality: "入力内容",
  composition: "構成バランス",
  compliance: "契約・条件",
  schedule: "日程",
};

/** Options helper for `<select>` elements. */
export function toOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}
