import "server-only";

import type { CompanySettingsRow } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type CompanySettings = CompanySettingsRow;

export async function getCompanySettings(
  organizationId: string,
): Promise<CompanySettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(`会社設定を取得できませんでした: ${error.message}`);
  return data;
}
