import { ArrowLeft, Eye } from "lucide-react";

import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

/**
 * Explains why the create/edit/delete controls are missing for a visitor
 * browsing the shared portfolio demo.
 *
 * This is signage, not a security boundary — every write is refused by
 * PostgreSQL regardless of what the interface renders.
 */
export function ReadOnlyNotice({
  description = "このデモ環境では編集・削除はできません。閲覧のみご利用いただけます。",
  className,
}: {
  description?: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-3",
        className,
      )}
    >
      <Eye aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
      <p className="text-sm leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">デモ閲覧モード</span>
        <span className="mx-1.5 text-steel-400">／</span>
        {description}
      </p>
    </div>
  );
}

/**
 * Stands in for a create/edit form when a demo visitor reaches one by typing
 * the URL directly. The form is not rendered at all, which keeps a pointless
 * submit-then-fail round trip out of the demo.
 */
export function ReadOnlyFormPlaceholder({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  // Rendered as an empty state rather than a second notice banner: the shell
  // already shows `ReadOnlyNotice` above every screen, and repeating the same
  // sentence in the same blue box twice reads as noise.
  return (
    <Card>
      <EmptyState
        icon={Eye}
        title="この画面はデモ環境では利用できません"
        description="データの作成・編集はできません。閲覧のみご利用いただけます。"
        action={
          <LinkButton href={backHref} variant="secondary">
            <ArrowLeft aria-hidden className="size-4" />
            {backLabel}
          </LinkButton>
        }
      />
    </Card>
  );
}
