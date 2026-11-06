import Link from "next/link";

type Route = "/" | "/screen" | "/backtest" | "/login";

/** A link per tool. A tool used by one person needs not to be a dead end, not a menu. */
export function Nav({ here }: { here: Route }) {
  const link = (href: Route, label: string) =>
    href === here ? (
      <span aria-current="page" className="text-zinc-900 dark:text-zinc-100">
        {label}
      </span>
    ) : (
      <Link href={href} className="underline underline-offset-2">
        {label}
      </Link>
    );
  return (
    <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
      {link("/", "Watchlist")}
      {link("/screen", "Screen")}
      {link("/backtest", "Backtest")}
    </nav>
  );
}
