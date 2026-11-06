import type { Quote } from "@/lib/quotes";

// Copy first: Array.prototype.sort reorders in place. The sort is stable,
// so equal moves keep their watchlist order.
export function sortByMove(rows: Quote[]): Quote[] {
  return [...rows].sort((a, b) => Math.abs(b.change_p) - Math.abs(a.change_p));
}
