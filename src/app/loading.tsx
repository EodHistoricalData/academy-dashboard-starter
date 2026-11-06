import { Nav } from "@/components/Nav";

/**
 * Shown while the page waits on the API.
 *
 * The page is force-dynamic, so every visit spends a few hundred milliseconds on a live
 * request before anything can render. Without this file the browser sits on the previous
 * page, or on nothing, for that whole time and the tool reads as broken rather than busy.
 *
 * A skeleton in the shape of the real table, not a spinner: it holds the space the rows
 * will occupy, so nothing jumps when they land. The row count matches the default
 * watchlist; being one row off costs nothing, being a different SHAPE is what causes the
 * jump.
 *
 * Deliberately not animated. A shimmer would be motion for its own sake on a page that
 * has none, and this is on screen for a few hundred milliseconds.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans dark:bg-zinc-950 sm:py-14">
      <main
        className="mx-auto flex w-full max-w-2xl flex-col gap-10"
        aria-busy="true"
      >
        <header className="flex flex-col gap-1">
          <Nav here="/" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Before the open
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading your tickers.
          </p>
        </header>

        <div>
          <div className="h-8 border-b border-zinc-200 dark:border-zinc-800" />
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-zinc-100 py-3.5 last:border-0 dark:border-zinc-900"
            >
              <Bar className="w-24" />
              <Bar className="w-16" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <div
      className={`h-3 rounded-sm bg-zinc-200 dark:bg-zinc-800 ${className}`}
      aria-hidden="true"
    />
  );
}
