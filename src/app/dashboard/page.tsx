import { Nav } from "@/components/Nav";
import { PanelFrame } from "@/components/PanelFrame";
import { DEFAULT_LAYOUT } from "@/lib/layout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Market tool starter" };

/**
 * The cockpit's first draw: the layout document as a grid of titled panels. Nothing is
 * fetched yet; who fetches for a panel is the panel contract's job.
 */
export default function DashboardPage() {
  const layout = DEFAULT_LAYOUT;
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Nav here="/dashboard" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">{layout.name}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            One page for the watchlist, a screen and the backtest, drawn from a
            layout document.
          </p>
        </header>
        <div className="grid auto-rows-[minmax(8rem,auto)] grid-cols-1 gap-4 sm:grid-cols-4">
          {layout.panels.map((panel) => (
            <PanelFrame key={panel.id} panel={panel} />
          ))}
        </div>
      </main>
    </div>
  );
}
