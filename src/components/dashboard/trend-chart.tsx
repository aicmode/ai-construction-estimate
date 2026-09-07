import * as React from "react";

import { formatYen } from "@/lib/money";
import type { TrendPoint } from "@/server/queries/dashboard";

/**
 * A hand-rolled SVG-free column chart.
 *
 * A charting library would add a large dependency for one chart; this stays
 * dependency-free, renders on the server, and exposes the underlying numbers as
 * a real table for screen readers instead of an unreadable graphic.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(
    1,
    ...data.map((point) => Math.max(point.estimatedAmount, point.acceptedAmount)),
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-steel-400" />
          見積総額（税込）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-amber-accent" />
          受注金額（税込）
        </span>
      </div>

      <div aria-hidden className="flex h-44 items-stretch gap-2 sm:gap-4">
        {data.map((point) => {
          const estimatedHeight = Math.round((point.estimatedAmount / max) * 100);
          const acceptedHeight = Math.round((point.acceptedAmount / max) * 100);
          return (
            <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {/* `flex-1` + `min-h-0` gives this row a definite height inside the
                  h-44 column, which is what the bars' percentage heights resolve
                  against. With `h-full` here the column was not stretched and every
                  bar collapsed to zero. */}
              <div className="flex w-full min-h-0 flex-1 items-end justify-center gap-1">
                <div
                  className="w-1/2 max-w-7 rounded-t-sm bg-steel-400"
                  style={{ height: `${Math.max(estimatedHeight, point.estimatedAmount > 0 ? 3 : 0)}%` }}
                />
                <div
                  className="w-1/2 max-w-7 rounded-t-sm bg-amber-accent"
                  style={{ height: `${Math.max(acceptedHeight, point.acceptedAmount > 0 ? 3 : 0)}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-muted">{point.label}</span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>月別の見積総額と受注金額</caption>
        <thead>
          <tr>
            <th scope="col">月</th>
            <th scope="col">見積総額</th>
            <th scope="col">受注金額</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.month}>
              <th scope="row">{point.month}</th>
              <td>{formatYen(point.estimatedAmount)}</td>
              <td>{formatYen(point.acceptedAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
