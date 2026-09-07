import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">データが見つかりません</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        指定されたデータは存在しないか、所属している組織からはアクセスできません。
      </p>
      <div className="mt-6 flex justify-center">
        <LinkButton href="/dashboard" variant="secondary">
          ダッシュボードへ戻る
        </LinkButton>
      </div>
    </div>
  );
}
