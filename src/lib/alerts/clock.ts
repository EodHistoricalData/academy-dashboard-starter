/**
 * The job's calendar is New York's. At 20:30 there the UTC date is already tomorrow, so the
 * ISO date of the instant (toISOString, first ten characters) would expect a bar that
 * cannot exist yet.
 *
 * Every function here takes the instant as an argument. Nothing in src/lib/alerts reads the
 * clock: scripts/alert.ts reads it once and passes it down, and a test passes its own.
 */
const NEW_YORK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

function parts(now: Date): Record<string, string> {
  return Object.fromEntries(NEW_YORK.formatToParts(now).map((x) => [x.type, x.value]));
}

/** New York's date at this instant, YYYY-MM-DD, whatever the day of the week. */
export function newYorkDate(now: Date): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** New York's date on a weekday, null on a weekend: there is no bar to ask for then. */
export function tradingDate(now: Date): string | null {
  const p = parts(now);
  return p.weekday === "Sat" || p.weekday === "Sun" ? null : `${p.year}-${p.month}-${p.day}`;
}
