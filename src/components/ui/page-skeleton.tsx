import { Card, CardBody } from "@/components/ui/card";
import { SkeletonRows } from "@/components/ui/states";

/** Route-level loading placeholder shared by the list screens. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="読み込み中">
      <div className="mb-6">
        <div className="h-7 w-48 animate-pulse rounded bg-steel-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-steel-100" />
      </div>
      <Card>
        <CardBody className="p-0">
          <SkeletonRows rows={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
