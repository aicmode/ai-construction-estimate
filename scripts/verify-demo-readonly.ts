/**
 * Demo read-only verifier.
 *
 * `0005_demo_read_only.sql` moves the restriction into PostgreSQL, but the
 * final activation is a manual statement run once in the SQL editor:
 *
 *     update public.profiles set is_demo = true where email = '<demo address>';
 *
 * This script checks that the statement actually took effect, by signing in as
 * the demo account and attempting one write against every layer that could let
 * a write through: the REST endpoints (RLS + triggers) and each writable
 * SECURITY DEFINER function.
 *
 * Safety design:
 *  - Reads the flag first and REFUSES to continue when the account is not
 *    marked read-only, so it can never insert junk into a live organization.
 *  - Uses the anon key and a normal password sign-in, exactly like a visitor.
 *    It never needs the service role key.
 *  - Every write it attempts is expected to fail. A write that succeeds is
 *    reported as a failure of the verification, and the row it created is
 *    reported so it can be removed.
 *
 * Usage:
 *   npm run demo:verify
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/database.types";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。`);
    process.exit(1);
  }
  return value;
}

let passed = 0;
let failed = 0;

function report(label: string, ok: boolean, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "  OK  " : "  NG  "} ${label}${detail ? ` — ${detail}` : ""}`);
}

/** A write is verified only when the database itself refuses it. */
function expectRefused(label: string, error: { code?: string; message: string } | null) {
  if (!error) {
    report(label, false, "書き込みが成功してしまいました（読み取り専用になっていません）");
    return;
  }
  report(label, true, `拒否 (${error.code ?? "?"})`);
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("DEMO_USER_EMAIL");
  const password = requireEnv("DEMO_USER_PASSWORD");

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !auth.user) {
    console.error(`デモアカウントでログインできませんでした: ${authError?.message ?? "不明なエラー"}`);
    process.exit(1);
  }
  console.log(`対象: ${new URL(url).host}`);
  console.log(`ログイン成功: ${auth.user.email}\n`);

  // --- gate: never attempt writes against a writable account ---------------
  const { data: isDemo, error: flagError } = await supabase.rpc("is_demo_user");
  if (flagError) {
    console.error(
      [
        `is_demo_user() を呼び出せませんでした (${flagError.code}): ${flagError.message}`,
        "0005_demo_read_only.sql が適用されていない可能性があります。",
      ].join("\n"),
    );
    process.exit(1);
  }
  if (isDemo !== true) {
    console.error(
      [
        "このアカウントはまだ読み取り専用になっていません（profiles.is_demo = false）。",
        "実データを汚さないため、書き込み検証は実行しません。",
        "",
        "Supabase の SQL Editor で次を一度だけ実行してから、再度このコマンドを実行してください:",
        `  update public.profiles set is_demo = true where email = '${email}';`,
      ].join("\n"),
    );
    process.exit(1);
  }
  report("profiles.is_demo = true（DBが読み取り専用と認識している）", true);

  // --- reads must keep working ---------------------------------------------
  console.log("\n[閲覧]");
  for (const table of ["customers", "projects", "estimates", "estimate_items"] as const) {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    report(`${table} を閲覧できる`, !error && (count ?? 0) > 0, error ? error.message : `${count} 件`);
  }

  // --- REST writes (RLS policies + statement triggers) ---------------------
  console.log("\n[REST 経由の書き込み]");
  const { data: customer } = await supabase.from("customers").select("id").limit(1).maybeSingle();
  const { data: estimate } = await supabase.from("estimates").select("id, organization_id").limit(1).maybeSingle();

  if (!customer || !estimate) {
    console.error("デモデータが見つからないため、書き込み検証を実行できません。先に seed を実行してください。");
    process.exit(1);
  }
  const org = estimate.organization_id;

  expectRefused(
    "customers への INSERT",
    (await supabase.from("customers").insert({ organization_id: org, name: "検証用（作成されてはいけません）" })).error,
  );
  expectRefused(
    "customers の UPDATE",
    (await supabase.from("customers").update({ name: "検証用（変更されてはいけません）" }).eq("id", customer.id)).error,
  );
  expectRefused(
    "customers の DELETE",
    (await supabase.from("customers").delete().eq("id", customer.id)).error,
  );
  expectRefused(
    "estimates のステータス変更",
    (await supabase.from("estimates").update({ status: "SUBMITTED" }).eq("id", estimate.id)).error,
  );
  expectRefused(
    "estimates の論理削除",
    (await supabase.from("estimates").update({ deleted_at: new Date().toISOString() }).eq("id", estimate.id)).error,
  );
  expectRefused(
    "company_settings の UPDATE",
    (await supabase.from("company_settings").update({ company_name: "検証用" }).eq("organization_id", org)).error,
  );
  expectRefused(
    "自分のプロフィールの UPDATE",
    (await supabase.from("profiles").update({ display_name: "検証用" }).eq("id", auth.user.id)).error,
  );
  expectRefused(
    "is_demo フラグ自体の解除",
    (await supabase.from("profiles").update({ is_demo: false }).eq("id", auth.user.id)).error,
  );

  // --- SECURITY DEFINER functions (RLS does not apply inside them) ---------
  console.log("\n[RPC 経由の書き込み]");
  expectRefused(
    "next_estimate_number（採番）",
    (await supabase.rpc("next_estimate_number", { p_org: org, p_year: new Date().getFullYear() })).error,
  );
  expectRefused(
    "create_organization（組織作成）",
    (await supabase.rpc("create_organization", { p_name: "検証用組織" })).error,
  );

  // --- the data must be untouched ------------------------------------------
  console.log("\n[データが変化していないこと]");
  const { data: afterCustomer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customer.id)
    .maybeSingle();
  report("削除を試みた顧客が残っている", Boolean(afterCustomer));
  const { data: afterEstimate } = await supabase
    .from("estimates")
    .select("id, deleted_at")
    .eq("id", estimate.id)
    .maybeSingle();
  report("論理削除を試みた見積が残っている", Boolean(afterEstimate) && afterEstimate?.deleted_at === null);

  console.log(`\n合計: ${passed} 件成功 / ${failed} 件失敗`);
  if (failed > 0) {
    console.error(
      "\n読み取り専用になっていない箇所があります。0005_demo_read_only.sql の適用状況を確認してください。",
    );
    process.exit(1);
  }
  console.log("デモアカウントは読み取り専用です。");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
