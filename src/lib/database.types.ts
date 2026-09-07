/**
 * Hand-maintained mirror of `supabase/migrations`. Keeping it in the repository
 * (instead of relying on generated output) means `npm run typecheck` and
 * `npm run build` never need a live database connection.
 */
import type {
  EstimateStatus,
  ItemCategory,
  MemberRole,
  ProjectStatus,
  ReviewSource,
  UnitType,
  WorkType,
} from "@/lib/domain";

/** Line item payload accepted by the `save_estimate` RPC. */
export type SaveEstimateItem = {
  name: string;
  category: ItemCategory;
  description: string;
  quantity: number;
  unit: UnitType;
  unit_price: number;
  unit_cost: number;
  amount: number;
  cost_amount: number;
};

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type ProfileRow = Timestamps & {
  id: string;
  email: string;
  display_name: string;
  /**
   * Shared read-only portfolio demo account. Enforced in PostgreSQL (RLS
   * policies, deny_demo_write() triggers and the writable RPCs), not here.
   */
  is_demo: boolean;
};

export type OrganizationRow = Timestamps & {
  id: string;
  name: string;
};

export type OrganizationMemberRow = Timestamps & {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
};

export type CompanySettingsRow = Timestamps & {
  id: string;
  organization_id: string;
  company_name: string;
  postal_code: string;
  address: string;
  phone: string;
  email: string;
  contact_name: string;
  invoice_registration_number: string;
  bank_account: string;
  default_tax_rate: number;
  default_validity_days: number;
  default_payment_terms: string;
};

export type CustomerRow = Timestamps & {
  id: string;
  organization_id: string;
  name: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  postal_code: string;
  address: string;
  notes: string;
  created_by: string | null;
};

export type ProjectRow = Timestamps & {
  id: string;
  organization_id: string;
  customer_id: string;
  name: string;
  work_type: WorkType;
  site_address: string;
  description: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  manager_name: string;
  status: ProjectStatus;
  notes: string;
  created_by: string | null;
};

export type EstimateRow = Timestamps & {
  id: string;
  organization_id: string;
  customer_id: string;
  project_id: string | null;
  estimate_number: string;
  title: string;
  issue_date: string;
  valid_until: string | null;
  status: EstimateStatus;
  payment_terms: string;
  notes: string;
  tax_rate: number;
  discount_amount: number;
  items_subtotal: number;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  cost_amount: number;
  gross_profit: number;
  gross_margin_rate: number;
  deleted_at: string | null;
  created_by: string | null;
};

export type EstimateItemRow = Timestamps & {
  id: string;
  organization_id: string;
  estimate_id: string;
  name: string;
  category: ItemCategory;
  description: string;
  quantity: number;
  unit: UnitType;
  unit_price: number;
  unit_cost: number;
  amount: number;
  cost_amount: number;
  sort_order: number;
};

export type AiReviewRow = {
  id: string;
  organization_id: string;
  estimate_id: string;
  source: ReviewSource;
  model: string;
  summary: string;
  findings: unknown;
  metrics: unknown;
  ai_error: string | null;
  created_by: string | null;
  created_at: string;
};

/**
 * PostgREST resolves embedded resources through foreign keys; supabase-js needs
 * the same information at the type level to infer the shape of a nested
 * `select()`. Names match PostgreSQL's default `<table>_<column>_fkey` pattern
 * produced by the inline REFERENCES clauses in migration 0001.
 */
type Relationship<Name extends string, Column extends string, Referenced extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Referenced;
  referencedColumns: ["id"];
};

type OrganizationMemberRelationships = [
  Relationship<"organization_members_organization_id_fkey", "organization_id", "organizations">,
  Relationship<"organization_members_user_id_fkey", "user_id", "profiles">,
];

type ProjectRelationships = [
  Relationship<"projects_customer_id_fkey", "customer_id", "customers">,
];

type EstimateRelationships = [
  Relationship<"estimates_customer_id_fkey", "customer_id", "customers">,
  Relationship<"estimates_project_id_fkey", "project_id", "projects">,
];

type EstimateItemRelationships = [
  Relationship<"estimate_items_estimate_id_fkey", "estimate_id", "estimates">,
];

type AiReviewRelationships = [
  Relationship<"ai_reviews_estimate_id_fkey", "estimate_id", "estimates">,
];

type TableDef<Row, Insert, Update, Rels extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Rels;
};

type Writable<Row, Required extends keyof Row> = Partial<Omit<Row, "created_at" | "updated_at">> &
  Pick<Row, Required>;

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Writable<ProfileRow, "id" | "email">,
        Partial<ProfileRow>
      >;
      organizations: TableDef<
        OrganizationRow,
        Writable<OrganizationRow, "name">,
        Partial<OrganizationRow>
      >;
      organization_members: TableDef<
        OrganizationMemberRow,
        Writable<OrganizationMemberRow, "organization_id" | "user_id">,
        Partial<OrganizationMemberRow>,
        OrganizationMemberRelationships
      >;
      company_settings: TableDef<
        CompanySettingsRow,
        Writable<CompanySettingsRow, "organization_id">,
        Partial<CompanySettingsRow>
      >;
      customers: TableDef<
        CustomerRow,
        Writable<CustomerRow, "organization_id" | "name">,
        Partial<CustomerRow>
      >;
      projects: TableDef<
        ProjectRow,
        Writable<ProjectRow, "organization_id" | "customer_id" | "name">,
        Partial<ProjectRow>,
        ProjectRelationships
      >;
      estimates: TableDef<
        EstimateRow,
        Writable<EstimateRow, "organization_id" | "customer_id" | "estimate_number" | "title">,
        Partial<EstimateRow>,
        EstimateRelationships
      >;
      estimate_items: TableDef<
        EstimateItemRow,
        Writable<EstimateItemRow, "organization_id" | "estimate_id" | "name">,
        Partial<EstimateItemRow>,
        EstimateItemRelationships
      >;
      ai_reviews: TableDef<
        AiReviewRow,
        Writable<AiReviewRow, "organization_id" | "estimate_id">,
        Partial<AiReviewRow>,
        AiReviewRelationships
      >;
    };
    Views: Record<string, never>;
    Functions: {
      /** True when the DB will refuse every write from the current session. */
      is_demo_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      create_organization: {
        Args: { p_name: string; p_company_name?: string | null };
        Returns: string;
      };
      next_estimate_number: {
        Args: { p_org: string; p_year: number };
        Returns: string;
      };
      save_estimate: {
        Args: {
          p_org: string;
          p_estimate_id: string | null;
          p_customer_id: string;
          p_project_id: string | null;
          p_estimate_number: string;
          p_title: string;
          p_issue_date: string;
          p_valid_until: string | null;
          p_status: EstimateStatus;
          p_payment_terms: string;
          p_notes: string;
          p_tax_rate: number;
          p_discount_amount: number;
          p_items_subtotal: number;
          p_subtotal_amount: number;
          p_tax_amount: number;
          p_total_amount: number;
          p_cost_amount: number;
          p_gross_profit: number;
          p_gross_margin_rate: number;
          p_items: SaveEstimateItem[];
        };
        Returns: string;
      };
    };
    Enums: {
      member_role: MemberRole;
      work_type: WorkType;
      project_status: ProjectStatus;
      estimate_status: EstimateStatus;
      item_category: ItemCategory;
      unit_type: UnitType;
      review_source: ReviewSource;
    };
    CompositeTypes: Record<string, never>;
  };
}
