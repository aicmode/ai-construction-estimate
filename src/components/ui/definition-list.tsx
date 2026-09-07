import * as React from "react";

/** Label/value pairs used on the detail screens. */
export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-ink-muted">{label}</dt>
          <dd className="mt-0.5 break-words text-[0.95rem] text-ink">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
