/** Minimal class name joiner — falsy values are dropped. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
