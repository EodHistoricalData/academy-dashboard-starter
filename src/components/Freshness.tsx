/**
 * How old the numbers above are, and what that means for what this tool can be asked to do.
 *
 * Driven entirely by the measured age of the quote, never by the plan name. The plan name
 * is a claim; the timestamp the API returned is evidence, and evidence does not go stale
 * when a plan is renamed or a market is shut.
 *
 * Deliberately not a pitch. It states what the number in front of you is and what it is
 * not, and lets the reader decide whether that matters for the tool they are building.
 * The moment this reads as a sales panel, the learner stops trusting the timestamps too.
 */
export function Freshness({
  ageMinutes,
  asOf,
}: {
  ageMinutes: number | null;
  asOf: number | null;
}) {
  if (ageMinutes === null || asOf === null) {
    return null;
  }

  const band = classify(ageMinutes);

  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Data age
      </h2>
      <p className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
        {describeAge(ageMinutes)}
        <span className="text-zinc-500 dark:text-zinc-400">
          {" · "}
          {new Date(asOf * 1000).toISOString().slice(11, 16)} UTC
        </span>
      </p>
      <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
        {band}
      </p>
    </section>
  );
}

function describeAge(minutes: number): string {
  if (minutes < 1) return "Live";
  if (minutes < 60) return `${minutes} min old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h old`;
  return `${Math.round(hours / 24)} days old`;
}

/**
 * What an age of this size does and does not support.
 *
 * Every band states the MEASURED age rather than asserting a standard delay. The first
 * draft said "delayed by about a quarter of an hour" for anything under twenty minutes,
 * which sat directly under the words "1 min old" and contradicted them. A panel whose
 * whole argument is "trust the timestamp, not the plan name" cannot afford to round the
 * timestamp into a claim.
 *
 * The thresholds are about what the tool can be asked to do, not about plan tiers: a
 * minute of lag is scheduling noise; past a day the number is an end-of-day close wearing
 * a quote's clothes.
 *
 * The band in between states the lag and its consequence and stops there. An earlier
 * draft added "which is the usual delayed feed", which is true of fifteen minutes and
 * false of two, and the panel rendered it under the words "2 min old".
 */
function classify(minutes: number): string {
  if (minutes < 2) {
    return "Effectively live. Anything that has to act the moment a price moves (an alert, a live board) can be built on this.";
  }
  if (minutes < 25) {
    return `Behind by ${minutes} minutes. Fine for watching, checking and reporting. An alert built on this fires ${minutes} minutes late, so do not build one that assumes otherwise.`;
  }
  if (minutes < 60 * 20) {
    return "Hours behind. This is a snapshot, not a quote. It answers where something closed and cannot answer where it is now.";
  }
  return "More than a day behind, so this is an end-of-day close. Useful for history and for anything measured in days; useless for anything measured in minutes. If your tool needs today, this is the limit you have just met.";
}
