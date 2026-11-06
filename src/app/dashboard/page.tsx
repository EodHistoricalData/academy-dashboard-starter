import { Cockpit } from "@/components/Cockpit";
import { Nav } from "@/components/Nav";
import { MockMode, UserLine } from "@/components/Notices";
import { isMock } from "@/lib/eodhd";
import { layoutsFrom, resolveLayout } from "@/lib/layouts";
import { notesFrom } from "@/lib/notes";
import { getDoc } from "@/lib/store";
import { currentUser } from "@/lib/user";
import { rulesFor } from "@/lib/user-rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Market tool starter" };

/**
 * The cockpit page. The server reads who you are, your layouts and your notes; the
 * container in the browser fetches every panel's market data through /api/proxy, once per
 * symbol. `?layout=` is a stranger's input: an unknown name opens the default.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const user = await currentUser();
  const stored = user ? getDoc(user.id, "layouts") : null;
  const layouts = layoutsFrom(stored?.payload ?? null);
  const asked = typeof query.layout === "string" ? query.layout : null;
  const notes = notesFrom(user ? getDoc(user.id, "notes")?.payload : null);
  const rules = rulesFor(user);
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Nav here="/dashboard" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The watchlist, a screen and the backtest on one page, each layout
            named after the question it answers.
          </p>
        </header>
        {isMock() && <MockMode />}
        <UserLine user={user} />
        <Cockpit
          initialLayouts={layouts}
          initialName={resolveLayout(layouts, asked).name}
          initialVersion={stored?.version ?? 0}
          signedIn={user !== null}
          notes={notes}
          initialRules={rules.rules}
        />
      </main>
    </div>
  );
}
