import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-steel-950 px-4 py-20">
      <div className="text-center">
        <p className="text-sm font-medium tracking-widest text-amber-400">404</p>
        <h1 className="mt-2 text-xl font-semibold text-white">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-steel-400">
          URLが変更されたか、削除された可能性があります。
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center rounded-md bg-amber-accent px-5 font-medium text-white hover:bg-amber-accent-strong"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </main>
  );
}
