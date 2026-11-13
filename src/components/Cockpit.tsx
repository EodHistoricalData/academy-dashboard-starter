"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LayoutSwitcher } from "@/components/LayoutSwitcher";
import { PanelBoundary } from "@/components/PanelBoundary";
import { PanelFrame } from "@/components/PanelFrame";
import { BacktestPanel } from "@/components/panels/BacktestPanel";
import { HeatmapPanel } from "@/components/panels/HeatmapPanel";
import { QuotePanel } from "@/components/panels/QuotePanel";
import { ScreenPanel } from "@/components/panels/ScreenPanel";
import { WatchlistPanel } from "@/components/panels/WatchlistPanel";
import { toTicker } from "@/lib/added";
import { ageSeconds, describeAge } from "@/lib/age";
import type { Bar } from "@/lib/backtest/bars";
import {
  callsPerMinute,
  exhaustsAt,
  marketOpen,
  pausedLine,
  REFRESH,
  REFRESH_EVERY_MS,
  type Refresh,
  refreshCost,
  shouldRefresh,
} from "@/lib/budget";
import { putDocViaRoute } from "@/lib/doc-client";
import { type Failure, failureSentence } from "@/lib/failure";
import type { Layout, Panel } from "@/lib/layout";
import {
  exportLayout,
  layoutsFrom,
  resolveLayout,
  type SavedLayouts,
  viewQuery,
} from "@/lib/layouts";
import {
  createMarketStore,
  createRequestCache,
  type Fetched,
  oldestTimestamp,
} from "@/lib/market-store";
import type { Notes } from "@/lib/notes";
import { panelState } from "@/lib/panel-state";
import { type Needs, neededBy, type PanelData, type PanelDef, unionNeeds } from "@/lib/panels";
import { type Checked, checkAll, digest, nextRules } from "@/lib/check-all";
import { isAvailable } from "@/lib/rows";
import { type Rule, ruleSentence } from "@/lib/rules";
import {
  eodViaProxy,
  failureOf,
  type FetchPlan,
  fetchPlan,
  quotesViaProxy,
  requestsOf,
  screenKey,
  screenViaProxy,
  without,
} from "@/lib/proxy-fetch";
import type { ScreenRow } from "@/lib/screen-query";
import {
  fromAddress,
  nextSelection,
  NO_SELECTION,
  type Selection,
  shownSymbol,
} from "@/lib/selection";

/**
 * A clock for ages, read again every 15 seconds, so "2 min old" keeps counting between
 * fetches. Outside React, because reading the time while rendering is not pure.
 */
let clockNow = Date.now();
function subscribeClock(onChange: () => void) {
  clockNow = Date.now();
  const id = setInterval(() => {
    clockNow = Date.now();
    onChange();
  }, 15_000);
  return () => clearInterval(id);
}
const readClock = () => clockNow;

/** Which definition draws which panel type. The container knows them all; they know none. */
const PANELS: Record<string, PanelDef<never>> = {
  watchlist: WatchlistPanel as PanelDef<never>,
  screen: ScreenPanel as PanelDef<never>,
  backtest: BacktestPanel as PanelDef<never>,
  quote: QuotePanel as PanelDef<never>,
  heatmap: HeatmapPanel as PanelDef<never>,
};

function defOf(panel: Panel): PanelDef<unknown> | null {
  return (PANELS[panel.type] as PanelDef<unknown> | undefined) ?? null;
}

/**
 * The config a panel is drawn with: its own, except that a following panel with a symbol
 * shows the selection. The container decides this; the panel never sees the selection.
 */
function effectiveConfig(panel: Panel, selection: Selection): unknown {
  if (panel.type !== "quote" && panel.type !== "backtest") return panel.config;
  const symbol = shownSymbol(panel, selection) ?? panel.config.symbol;
  return symbol === panel.config.symbol ? panel.config : { ...panel.config, symbol };
}

/** The requests a panel's needs come to, by the key the container tracks them under. */
function keysOf(needs: Needs): string[] {
  return [
    ...(needs.quotes.length > 0 ? ["quotes"] : []),
    ...(needs.screen ? [`screen:${screenKey(needs.screen)}`] : []),
    ...(needs.eod ? [`eod:${needs.eod}`] : []),
  ];
}

type Loaded = {
  quotes: Map<string, Fetched>;
  screens: Map<string, { value: ScreenRow[]; fetchedAt: number }>;
  bars: Map<string, { value: Bar[]; fetchedAt: number }>;
};

const EMPTY: Loaded = { quotes: new Map(), screens: new Map(), bars: new Map() };

/** Today's count and limit from /api/usage, which costs nothing. */
type Usage = { used: number | null; limit: number | null; mock: boolean };

/** What the loop sends for a panel that is due: only the parts whose market is open. */
function openPart(needs: Needs, now: number): Needs | null {
  const quotes = needs.quotes.filter((s) => marketOpen(s, now));
  const screen = needs.screen && marketOpen("SCREEN.US", now) ? needs.screen : undefined; // the screen is of US stocks
  const eod = needs.eod && marketOpen(needs.eod, now) ? needs.eod : undefined;
  return quotes.length > 0 || screen || eod ? { quotes, screen, eod } : null;
}

/**
 * The cockpit: it owns fetching for every panel. It collects what each panel needs, unions
 * the symbols so two panels wanting the same one ask once, asks the market store (which
 * goes through /api/proxy) and hands each panel its part. Panels only draw; their state
 * (loading, refreshing, ready, empty, failed) is worked out here, one panel at a time.
 */
export function Cockpit({
  initialLayouts,
  initialName,
  initialVersion,
  signedIn,
  notes,
  initialRules,
  rulesVersion,
}: {
  initialLayouts: SavedLayouts;
  /** The layout the address asked for, already resolved: unknown names open the default. */
  initialName: string;
  initialVersion: number;
  signedIn: boolean;
  notes: Notes;
  /** The "rules" document, or the seed until one is saved. */
  initialRules: Rule[];
  rulesVersion: number;
}) {
  // The rules and what they last saw. Checked after every quotes answer, while this page
  // is open, and only then.
  const [rules, setRules] = useState(initialRules);
  const rulesNow = useRef(initialRules);
  const rulesSaved = useRef(rulesVersion);
  const rulesSaving = useRef<Promise<void>>(Promise.resolve());
  const [checked, setChecked] = useState<Checked[]>([]);
  // Keys of firings already shown, so a check run twice on the same data fires once.
  const seen = useRef(new Set<string>());
  // Named layouts are one document, all of them here: switching is state, not a request.
  const [layouts, setLayouts] = useState<SavedLayouts>(initialLayouts);
  const [name, setName] = useState(initialName);
  const layout = resolveLayout(layouts, name);
  // The copy that was stored when this layout was opened: what "Revert to saved" restores.
  const [opened, setOpened] = useState<Layout>(layout);
  const [saveLine, setSaveLine] = useState<string | null>(null);
  const version = useRef(initialVersion);
  const saving = useRef<Promise<void>>(Promise.resolve());

  const [stores] = useState(() => ({
    quotes: createMarketStore(quotesViaProxy, Date.now, 60_000),
    screens: createRequestCache(screenViaProxy, Date.now, 5 * 60_000),
    bars: createRequestCache(eodViaProxy, Date.now, 60 * 60_000),
  }));
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  // What is being fetched, and what last failed, by request key ("quotes", "screen:…").
  const [fetching, setFetching] = useState<ReadonlySet<string>>(new Set());
  const [failures, setFailures] = useState<ReadonlyMap<string, Failure>>(new Map());
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const now = useSyncExternalStore(subscribeClock, readClock, readClock);
  const [usage, setUsage] = useState<Usage | null>(null);

  // The one way the selection changes. Selecting what is already selected returns the
  // same object, so nothing re-renders: remove that guard in nextSelection and the two
  // effects below chase each other through the address bar.
  const select = useCallback((symbol: string, source: string) => {
    setSelection((current) => nextSelection(current, symbol, source));
  }, []);

  // A collapsed panel needs nothing; see neededBy in src/lib/panels.ts.
  const needsByPanel = useMemo(
    () =>
      layout.panels.map((p) => {
        const def = defOf(p);
        return def ? def.dataNeeds(effectiveConfig(p, selection) as never) : null;
      }),
    [layout, selection],
  );
  const openNeeds = useMemo(
    () => neededBy(layout.panels, (p) => needsByPanel[layout.panels.indexOf(p)]),
    [layout, needsByPanel],
  );

  // Every symbol on the page: the only ones the address may select.
  const showing = useMemo(
    () => [
      ...new Set([
        ...unionNeeds(openNeeds),
        ...[...loaded.screens.values()].flatMap((s) => s.value.map(toTicker)),
      ]),
    ],
    [openNeeds, loaded],
  );

  // The selection goes into the address, so a view can be shared and survives a reload.
  useEffect(() => {
    if (selection.symbol === null) return;
    const query = new URLSearchParams(window.location.search);
    query.set("symbol", selection.symbol);
    window.history.replaceState(null, "", `?${query}`);
  }, [selection]);

  // ...and comes back from it, as a stranger's input: only a symbol the page shows. It runs
  // again whenever what the page shows changes (a screen arriving can make an addressed
  // symbol acceptable), and what the page shows includes the selected symbol. So every
  // selection that is a new object runs it once more: the no-op in nextSelection is what
  // ends that, and without it the two effects feed each other for ever.
  // The address is read where it is now, not as this render saw it: the effect above may
  // have just written a newer symbol, and the older one would undo the click.
  const searchParams = useSearchParams();
  useEffect(() => {
    const now = new URLSearchParams(window.location.search).get("symbol");
    const addressed = fromAddress(now, showing);
    // Setting state from an outside system, the address, is what this effect is for.
    if (addressed !== null) select(addressed, "address");
  }, [searchParams, showing, select]);

  /**
   * Fetch what the given needs ask for, each request on its own: one failing does not stop
   * the others, and rows already on screen stay there while newer ones are fetched.
   * `force` asks again even for answers younger than the cache's age: a refresh pressed.
   */
  const runChecks = useCallback(async () => {
    const current = rulesNow.current;
    const results = await checkAll(
      current,
      // The store already holds these: the rules' symbols are in every fetch's union.
      async (symbols) =>
        (await stores.quotes.quotes(symbols)).map((f) => f.row).filter(isAvailable),
      Date.now(),
      { seen: seen.current },
    );
    const next = nextRules(current, results);
    setChecked(results);
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    rulesNow.current = next;
    setRules(next);
    if (!signedIn) return;
    // What the rules last saw is stored, so the next check knows what "crossed" means.
    rulesSaving.current = rulesSaving.current.then(async () => {
      const outcome = await putDocViaRoute("rules", rulesSaved.current, next);
      if (outcome.kind === "saved") rulesSaved.current = outcome.version;
      if (outcome.kind === "conflict" && outcome.current) rulesSaved.current = outcome.current.version;
    });
  }, [stores, signedIn]);

  /**
   * `ruleSymbols` ride along, so the rules are checked on the answer: the loop sends those
   * whose market is open, a refresh by hand sends all, a retry of one panel none.
   */
  const fetchFor = useCallback(
    async (needs: Needs[], force: boolean, ruleSymbols: string[]) => {
      // The same plan the budget prices: see requestsOf in src/lib/proxy-fetch.ts.
      const { symbols, screens, histories } = fetchPlan(needs, ruleSymbols);

      const settle = async <T,>(key: string, job: () => Promise<T>, apply: (value: T) => void) => {
        setFetching((prev) => new Set(prev).add(key));
        try {
          apply(await job());
          setFailures((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        } catch (error) {
          setFailures((prev) => new Map(prev).set(key, failureOf(error)));
        } finally {
          setFetching((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      };

      await Promise.all([
        symbols.length > 0 &&
          settle("quotes", () => stores.quotes.quotes(symbols, force), (rows) => {
            setLoaded((l) => {
              const quotes = new Map(l.quotes);
              for (const q of rows) quotes.set(q.row.code, q);
              return { ...l, quotes };
            });
            void runChecks();
          }),
        ...screens.map((k) =>
          settle(`screen:${k}`, () => stores.screens.get(k, force), (v) =>
            setLoaded((l) => ({ ...l, screens: new Map(l.screens).set(k, v) })),
          ),
        ),
        ...histories.map((s) =>
          settle(`eod:${s}`, () => stores.bars.get(s, force), (v) =>
            setLoaded((l) => ({ ...l, bars: new Map(l.bars).set(s, v) })),
          ),
        ),
      ]);
    },
    [stores, runChecks],
  );

  // What the page shows and has never asked for: the first load, a symbol just selected, a
  // panel just expanded. Only that: data that is merely old is the loop's to refresh, so
  // renaming a panel or changing an interval spends nothing. Asked once, not until it
  // arrives: a symbol the answer leaves out, or a request that failed, is not asked again
  // by itself (Refresh and Retry are there for that).
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const ask = (key: string) => {
      if (asked.current.has(key)) return false;
      asked.current.add(key);
      return true;
    };
    const missing = openNeeds.flatMap((n) => {
      const part: Needs = {
        quotes: n.quotes.filter((s) => !loaded.quotes.has(s) && ask(`quote:${s}`)),
        screen:
          n.screen && !loaded.screens.has(screenKey(n.screen)) && ask(`screen:${screenKey(n.screen)}`)
            ? n.screen
            : undefined,
        eod: n.eod && !loaded.bars.has(n.eod) && ask(`eod:${n.eod}`) ? n.eod : undefined,
      };
      return part.quotes.length > 0 || part.screen || part.eod ? [part] : [];
    });
    const rulesMissing = rulesNow.current.flatMap((r) =>
      r.enabled && !loaded.quotes.has(r.ticker) && ask(`quote:${r.ticker}`) ? [r.ticker] : [],
    );
    if (missing.length === 0 && rulesMissing.length === 0) return;
    // Started after this render, so the effect itself sets no state. A request already in
    // flight for the same symbols is shared by the store, not sent twice.
    void Promise.resolve().then(() => fetchFor(missing, false, rulesMissing));
  }, [openNeeds, loaded, fetchFor]);

  // Calls used today and the limit, read again after every round: the meter is the truth,
  // and other tabs spend from the same allowance.
  const readUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) return;
      const u = (await res.json()) as { used: number | null; dailyLimit: number | null; mock: boolean };
      setUsage({ used: u.used, limit: u.dailyLimit, mock: u.mock });
    } catch {
      // No meter is not a reason to stop drawing; the budget line says it does not know.
    }
  }, []);

  // The price of a refresh by hand: every open panel, forced, with the rules' symbols.
  const ruleSymbols = useMemo(() => rules.filter((r) => r.enabled).map((r) => r.ticker), [rules]);
  const handPrice = refreshCost(requestsOf(fetchPlan(openNeeds, ruleSymbols)));

  // The loop's schedule: one round per interval, each symbol priced in the fastest round
  // that asks for it. The rules' symbols ride with the fastest.
  const rounds = useMemo(() => {
    let covered: FetchPlan = { symbols: [], screens: [], histories: [] };
    return REFRESH.flatMap((refresh) => {
      const everyMs = REFRESH_EVERY_MS[refresh];
      if (everyMs === null) return [];
      const needs = neededBy(
        layout.panels.filter((p) => p.refresh === refresh),
        (p) => needsByPanel[layout.panels.indexOf(p)],
      );
      if (needs.length === 0) return [];
      const first = covered.symbols.length + covered.screens.length + covered.histories.length === 0;
      const plan = without(fetchPlan(needs, first ? ruleSymbols : []), covered);
      covered = {
        symbols: [...covered.symbols, ...plan.symbols],
        screens: [...covered.screens, ...plan.screens],
        histories: [...covered.histories, ...plan.histories],
      };
      const cost = refreshCost(requestsOf(plan));
      return cost === null ? [] : [{ refresh, cost, everyMs }];
    });
  }, [layout, needsByPanel, ruleSymbols]);

  // The wall. A 402 means the day is spent: nothing more is sent until midnight UTC. Before
  // that, the meter decides: the loop keeps one refresh by hand in reserve, and a refresh by
  // hand may spend it. Without a meter or a price, nothing is held back on a guess.
  const meter =
    usage?.used != null && usage.limit != null ? { used: usage.used, limit: usage.limit } : null;
  const spent = [...failures.values()].some((f) => f.kind === "quota");
  const allows = (perRefresh: number | null, byHand: boolean) =>
    !spent &&
    (meter === null ||
      perRefresh === null ||
      shouldRefresh({ ...meter, perRefresh, reserve: handPrice ?? 0, byHand }));
  const byHandAllowed = allows(handPrice, true);
  const loopAllowed = allows(rounds[0]?.cost ?? 0, false);

  /**
   * One pass of the loop. Nothing while the tab is hidden or the wall is near; otherwise
   * every panel whose interval has passed since its data arrived, minus the symbols whose
   * market is closed, if what that costs leaves the reserve standing.
   */
  const tick = (at: number) => {
    if (document.visibilityState === "hidden" || spent) return;
    const due = layout.panels.flatMap((panel, i) => {
      const needs = needsByPanel[i];
      const every = REFRESH_EVERY_MS[panel.refresh];
      if (!needs || panel.collapsed || every === null) return [];
      const last = lastFetched(needs);
      if (last === null || at - last < every) return [];
      const open = openPart(needs, at);
      return open ? [open] : [];
    });
    if (due.length === 0) return;
    const rulesOpen = ruleSymbols.filter((s) => marketOpen(s, at));
    if (!allows(refreshCost(requestsOf(fetchPlan(due, rulesOpen))), false)) return;
    void fetchFor(due, false, rulesOpen).then(readUsage);
  };

  // Whether any open panel that refreshes by itself has a market open now.
  const anyOpen = layout.panels.some((panel, i) => {
    const needs = needsByPanel[i];
    return needs && !panel.collapsed && panel.refresh !== "manual" && openPart(needs, now) !== null;
  });
  const hasLoop = rounds.length > 0;
  const paused = !byHandAllowed;
  // After a 402 the meter can lag behind the answer; then the line does not quote it.
  const status = paused
    ? pausedLine(meter && (meter.used >= meter.limit || !spent) ? meter : null)
    : hasLoop && !loopAllowed
      ? `Automatic refresh is holding back: ${meter!.limit - meter!.used} calls are left today, and ${handPrice} of them are kept for one refresh by hand, which still works.`
      : hasLoop && !anyOpen
        ? "Automatic refresh is waiting: the markets on screen are closed, so there is nothing new to fetch."
        : null;
  const tickNow = useRef(tick);
  useEffect(() => {
    tickNow.current = tick;
  });
  useEffect(() => {
    const run = () => tickNow.current(Date.now());
    void Promise.resolve().then(readUsage);
    const every = setInterval(run, 15_000);
    // Coming back to the tab is when a person wants current data: one round, at once.
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      run();
      void readUsage();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      clearInterval(every);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [readUsage]);

  // Autosave: every change to a layout writes the whole document with the version read.
  // Writes go out one at a time; another tab's newer version is shown, not overwritten.
  function saveLayouts(next: SavedLayouts) {
    setLayouts(next);
    if (!signedIn) {
      setSaveLine("Not signed in: layout changes last until you leave this page.");
      return;
    }
    setSaveLine("Saving…");
    saving.current = saving.current.then(async () => {
      const outcome = await putDocViaRoute("layouts", version.current, next);
      if (outcome.kind === "saved") {
        version.current = outcome.version;
        setSaveLine("Saved.");
      } else if (outcome.kind === "conflict") {
        if (outcome.current) {
          version.current = outcome.current.version;
          setLayouts(layoutsFrom(outcome.current.payload)); // checked like any input
        }
        setSaveLine("Your other tab saved these layouts first; this now shows its version.");
      } else {
        // The store being down is not the cockpit being down: keep drawing, say so.
        setSaveLine(
          "The layout could not be saved: the store did not answer. Everything on screen still works.",
        );
      }
    });
  }

  function switchTo(next: string) {
    const target = resolveLayout(layouts, next);
    setName(target.name);
    setOpened(target);
    window.history.replaceState(null, "", viewQuery(target.name, selection.symbol));
  }

  function rename(panelId: string, title: string) {
    saveLayouts({
      ...layouts,
      [layout.name]: {
        ...layout,
        panels: layout.panels.map((p) => (p.id === panelId ? { ...p, title } : p)),
      },
    });
  }

  function setRefresh(panelId: string, refresh: Refresh) {
    saveLayouts({
      ...layouts,
      [layout.name]: {
        ...layout,
        panels: layout.panels.map((p) => (p.id === panelId ? { ...p, refresh } : p)),
      },
    });
  }

  function setCollapsed(panelId: string, collapsed: boolean) {
    saveLayouts({
      ...layouts,
      [layout.name]: {
        ...layout,
        panels: layout.panels.map((p) => (p.id === panelId ? { ...p, collapsed } : p)),
      },
    });
  }

  function newLayout(newName: string) {
    const copy = { ...layout, name: newName };
    saveLayouts({ ...layouts, [newName]: copy });
    setName(newName);
    setOpened(copy);
    window.history.replaceState(null, "", viewQuery(newName, selection.symbol));
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([exportLayout(layout)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${layout.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function dataFor(needs: Needs): PanelData {
    const screen = needs.screen ? loaded.screens.get(screenKey(needs.screen)) : undefined;
    const bars = needs.eod ? loaded.bars.get(needs.eod) : undefined;
    return {
      quotes: needs.quotes.flatMap((s) => loaded.quotes.get(s) ?? []),
      screen: screen ? { rows: screen.value, fetchedAt: screen.fetchedAt } : null,
      bars: bars ? { rows: bars.value, fetchedAt: bars.fetchedAt } : null,
      notes,
      selected: selection.symbol,
    };
  }

  /** When the oldest part of a panel's data arrived, or null before it has any. */
  function lastFetched(needs: Needs): number | null {
    const times = [
      ...needs.quotes.flatMap((s) => loaded.quotes.get(s)?.fetchedAt ?? []),
      ...(needs.screen ? [loaded.screens.get(screenKey(needs.screen))?.fetchedAt ?? null] : []),
      ...(needs.eod ? [loaded.bars.get(needs.eod)?.fetchedAt ?? null] : []),
    ];
    if (times.length === 0 || times.includes(null)) return null;
    return Math.min(...(times as number[]));
  }

  /** What the panel has, for its state: null until the first answer for it arrives. */
  function rowsOf(needs: Needs, data: PanelData): unknown[] | null {
    if (needs.screen) return data.screen?.rows ?? null;
    if (needs.eod) return data.bars?.rows ?? null;
    return data.quotes.length === 0 && needs.quotes.length > 0 ? null : data.quotes;
  }

  // Each open panel's age, from its own rows. The header shows the oldest live one.
  const ages = layout.panels.flatMap((panel, i) => {
    const needs = needsByPanel[i];
    if (!needs || panel.collapsed) return [];
    const age = ageOf(needs, dataFor(needs), now);
    return age ? [{ panel, age }] : [];
  });

  return (
    <div className="flex flex-col gap-4">
      <OldestLine ages={ages} />
      <BudgetLine usage={usage} handPrice={handPrice} perMinute={callsPerMinute(rounds)} now={now} />
      {status && (
        <p role="status" className="text-sm font-medium">
          {status}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <LayoutSwitcher
            names={Object.keys(layouts)}
            current={layout.name}
            status={saveLine}
            onSwitch={switchTo}
            onNew={newLayout}
            onRevert={() => saveLayouts({ ...layouts, [layout.name]: opened })}
            onExport={download}
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchFor(openNeeds, true, ruleSymbols).then(readUsage)}
          disabled={!byHandAllowed}
          title={status ?? undefined}
          className="rounded border border-zinc-300 px-2.5 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Refresh
        </button>
      </div>
      <RulesList rules={rules} checked={checked} />
      <div className="grid auto-rows-[minmax(8rem,auto)] grid-cols-1 gap-4 sm:grid-cols-4">
        {layout.panels.map((panel, i) => {
          const def = defOf(panel);
          const needs = needsByPanel[i];
          const onRename = (title: string) => rename(panel.id, title);
          const onCollapse = () => setCollapsed(panel.id, !panel.collapsed);
          // A backtest is manual and cannot be set otherwise, so it gets no choice.
          const onRefresh =
            panel.type === "backtest" ? undefined : (r: Refresh) => setRefresh(panel.id, r);
          if (!def || !needs || panel.collapsed) {
            return (
              <PanelFrame
                key={panel.id}
                panel={panel}
                onRename={onRename}
                onCollapse={onCollapse}
                onRefresh={onRefresh}
              />
            );
          }
          const keys = keysOf(needs);
          const data = dataFor(needs);
          const state = panelState({
            rows: rowsOf(needs, data),
            fetching: keys.some((k) => fetching.has(k)),
            failure: keys.map((k) => failures.get(k)).find(Boolean) ?? null,
          });
          const { Component } = def;
          const body = (
            <Component
              config={effectiveConfig(panel, selection) as never}
              data={data}
              onSelect={(symbol) => select(symbol, panel.id)}
              onConfigChange={() => {}}
            />
          );
          return (
            <PanelFrame
              key={panel.id}
              panel={panel}
              onRename={onRename}
              onCollapse={onCollapse}
              onRefresh={onRefresh}
              aside={asideFor(state.kind, ageOf(needs, data, now), paused)}
            >
              <PanelBoundary>
                {state.kind === "loading" ? (
                  <Skeleton />
                ) : state.kind === "failed" ? (
                  <div className="flex flex-col gap-3">
                    <Failed
                      failure={state.failure}
                      canRetry={allows(refreshCost(requestsOf(fetchPlan([needs]))), true)}
                      onRetry={() => void fetchFor([needs], true, []).then(readUsage)}
                    />
                    {state.rows !== null && body}
                  </div>
                ) : (
                  body
                )}
              </PanelBoundary>
            </PanelFrame>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Every rule, as the sentence of what it watches, with the value it last saw and how far
 * that is from the threshold: whether it is watching at all, without waiting for it to
 * fire. Firings from one check arrive as one message.
 */
function RulesList({ rules, checked }: { rules: Rule[]; checked: Checked[] }) {
  const message = digest(checked);
  return (
    <section className="flex flex-col gap-1 text-sm" aria-label="Rules">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Rules
      </h2>
      {rules.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No rules yet.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {rules.map((r) => (
            <li key={r.id}>
              {ruleSentence(r)}
              <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
                {" · "}
                {distanceLine(r)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <pre className="whitespace-pre-wrap font-sans font-medium tabular-nums">{message}</pre>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Rules are checked while this page is open.
      </p>
    </section>
  );
}

/** "now −0.67, 0.17 past the threshold": what the rule last saw, against what it waits for. */
function distanceLine(rule: Rule): string {
  if (rule.lastValue === null) return "not checked yet";
  const gap = rule.lastValue - rule.value;
  const past = rule.op === ">" || rule.op === "crosses_above" ? gap > 0 : gap < 0;
  const fmt = (n: number) =>
    `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const state = rule.armed ? "" : ", waiting to re-arm";
  return `now ${fmt(rule.lastValue)}, ${fmt(Math.abs(gap))} ${past ? "past" : "short of"} the threshold${state}`;
}

/**
 * How old a panel's data is, from the data's own clock. Quotes carry the time of their last
 * trade, so they get an age in seconds; a screen and a daily history carry a date, and are
 * labelled end of day with it rather than given an age they do not have.
 */
type Age =
  | { kind: "live"; seconds: number; symbol: string }
  | { kind: "daily"; date: string };

function ageOf(needs: Needs, data: PanelData, now: number): Age | null {
  if (needs.screen) {
    const date = data.screen?.rows[0]?.last_day_data_date;
    return date ? { kind: "daily", date } : null;
  }
  if (needs.eod) {
    const date = data.bars?.rows.at(-1)?.date;
    return date ? { kind: "daily", date } : null;
  }
  const oldest = oldestTimestamp(data.quotes.map((q) => q.row));
  if (oldest === null) return null;
  const symbol = data.quotes.find((q) => isAvailable(q.row) && q.row.timestamp === oldest)!.row.code;
  return { kind: "live", seconds: ageSeconds(oldest, now), symbol };
}

const ageText = (age: Age) =>
  age.kind === "live" ? describeAge(age.seconds) : `end of day, ${age.date}`;

/** The small text at the right of a panel's title: its state, and the age of what it shows. */
function asideFor(kind: string, age: Age | null, paused: boolean): string {
  const text = age ? ageText(age) : null;
  // At the wall the rows stay, labelled: stale, with their real age.
  if (paused && kind === "ready" && text) return `${text} · stale, refresh paused`;
  switch (kind) {
    case "loading":
      return "Loading…";
    case "refreshing":
      return text ? `${text} · refreshing…` : "Refreshing…";
    case "failed":
      return text ? `${text} · stale, refresh failed` : "Failed";
    default:
      return text ?? "";
  }
}

/**
 * The header: a cockpit has no single "as of", so it shows the oldest quote on screen, and
 * says separately that the daily panels are end of day.
 */
function OldestLine({ ages }: { ages: { panel: Panel; age: Age }[] }) {
  const live = ages.flatMap(({ panel, age }) => (age.kind === "live" ? [{ panel, age }] : []));
  const daily = ages.flatMap(({ age }) => (age.kind === "daily" ? [age.date] : []));
  if (live.length === 0 && daily.length === 0) return null;
  const oldest = live.reduce<(typeof live)[number] | null>(
    (worst, a) => (worst === null || a.age.seconds > worst.age.seconds ? a : worst),
    null,
  );
  const firstDay = [...daily].sort()[0];
  return (
    <p className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
      {oldest &&
        `Oldest quote on screen: ${oldest.age.symbol}, ${describeAge(oldest.age.seconds)} (${oldest.panel.title}).`}
      {oldest && firstDay && " "}
      {firstDay && `End-of-day panels: data to ${firstDay}.`}
    </p>
  );
}

/**
 * The budget, on screen: calls used today, the limit, what a refresh by hand costs, and when
 * the limit is reached at this schedule. The projection is what turns the count into a
 * decision; it moves when a panel's interval changes.
 */
function BudgetLine({
  usage,
  handPrice,
  perMinute,
  now,
}: {
  usage: Usage | null;
  handPrice: number | null;
  perMinute: number;
  now: number;
}) {
  const price = handPrice === null ? "an unknown number of" : String(handPrice);
  const meter =
    usage?.used != null && usage.limit != null
      ? `${usage.used} of ${usage.limit} calls used today`
      : "Calls used today: unknown";
  let projection: string;
  if (perMinute === 0) {
    projection = "nothing refreshes by itself at this schedule";
  } else if (usage?.used == null || usage.limit == null) {
    projection = `this schedule spends ${Math.round(perMinute * 60)} calls an hour while markets are open`;
  } else if (usage.used >= usage.limit) {
    projection = "the limit is reached";
  } else {
    const at = exhaustsAt(usage.limit - usage.used, perMinute, 60_000, now)!;
    projection = `at this schedule (${Math.round(perMinute * 60)} calls an hour while markets are open) the limit is reached at ${at.toISOString().slice(11, 16)} UTC`;
  }
  return (
    <p className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
      {meter}
      {usage?.mock ? " (fixtures, not your account)" : ""} · a refresh by hand costs {price} · {projection}.
    </p>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-3 w-full rounded-sm bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

function Failed({
  failure,
  canRetry,
  onRetry,
}: {
  failure: Failure;
  /** False at the wall: a retry is a refresh by hand, and the budget decides those. */
  canRetry: boolean;
  onRetry(): void;
}) {
  const { what, next } = failureSentence(failure);
  // A spent day never retries: asking again before midnight only fails again.
  const retry = canRetry && failure.kind !== "quota" && failure.kind !== "no-key";
  return (
    <div className="flex flex-col items-start gap-1.5 rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-medium">{what}</p>
      <p className="text-zinc-600 dark:text-zinc-400">{next}</p>
      {retry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-zinc-300 px-2.5 py-1 dark:border-zinc-700"
        >
          Retry this panel
        </button>
      )}
    </div>
  );
}
