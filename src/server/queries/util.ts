import "server-only";

/**
 * Escapes the wildcard characters of a PostgREST `ilike` pattern and the comma
 * used as the `or()` filter separator, so a search box can never be used to
 * inject additional filter expressions.
 */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/[\\%_]/gu, (match) => `\\${match}`)
    .replace(/[,().]/gu, " ")
    .trim();
}

/** First and last day of the month containing `date`, as ISO date strings. */
export function monthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toIso(start), end: toIso(end) };
}

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
