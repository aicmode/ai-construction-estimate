import type { Metadata } from "next";

import { Database } from "lucide-react";

export const metadata: Metadata = { title: "セットアップが必要です" };

const REQUIRED_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

/**
 * Shown when the deployment has no Supabase credentials. Rendering this page
 * instead of throwing keeps `npm run build` and a fresh deployment from failing
 * with an opaque runtime error.
 */
export default function SetupRequiredPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-steel-950 px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-steel-700 bg-steel-900 p-8 text-steel-100">
        <span
          aria-hidden
          className="mb-4 flex size-11 items-center justify-center rounded-md bg-amber-accent text-white"
        >
          <Database className="size-5" />
        </span>
        <h1 className="text-xl font-semibold text-white">セットアップが必要です</h1>
        <p className="mt-2 text-sm leading-relaxed text-steel-300">
          データベース（Supabase）への接続情報が設定されていないため、アプリケーションを起動できません。
          <code className="mx-1 rounded bg-steel-800 px-1.5 py-0.5 text-xs">.env.local</code>
          に以下の環境変数を設定してから再起動してください。
        </p>
        <ul className="mt-4 space-y-2">
          {REQUIRED_VARS.map((name) => (
            <li
              key={name}
              className="rounded border border-steel-700 bg-steel-950 px-3 py-2 font-mono text-xs text-amber-300"
            >
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-steel-400">
          設定手順は README の「セットアップ」を参照してください。値は Supabase の Project Settings
          から取得できます。
        </p>
      </div>
    </main>
  );
}
