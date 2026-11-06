import { Cockpit } from "@/components/Cockpit";
import { Nav } from "@/components/Nav";
import { MockMode, UserLine } from "@/components/Notices";
import { isMock } from "@/lib/eodhd";
import { DEFAULT_LAYOUT } from "@/lib/layout";
import { notesFrom } from "@/lib/notes";
import { getDoc } from "@/lib/store";
import { currentUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Market tool starter" };

/**
 * The cockpit page. The server reads who you are and your notes; the container in the
 * browser fetches every panel's market data through /api/proxy, once per symbol.
 */
export default async function DashboardPage() {
  const layout = DEFAULT_LAYOUT;
  const user = await currentUser();
  const notes = notesFrom(user ? getDoc(user.id, "notes")?.payload : null);
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
        {isMock() && <MockMode />}
        <UserLine user={user} />
        <Cockpit layout={layout} notes={notes} />
      </main>
    </div>
  );
}
