"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutSwitcher } from "@/components/LayoutSwitcher";
import { PanelBoundary } from "@/components/PanelBoundary";
import { PanelFrame } from "@/components/PanelFrame";
import { BacktestPanel } from "@/components/panels/BacktestPanel";
import { QuotePanel } from "@/components/panels/QuotePanel";
import { ScreenPanel } from "@/components/panels/ScreenPanel";
import { WatchlistPanel } from "@/components/panels/WatchlistPanel";
import { toTicker } from "@/lib/added";
import type { Bar } from "@/lib/backtest/bars";
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
import { type Needs, type PanelData, type PanelDef, unionNeeds } from "@/lib/panels";
import { type Checked, checkAll, digest, nextRules } from "@/lib/check-all";
import { isAvailable } from "@/lib/rows";
import { type Rule, ruleSentence } from "@/lib/rules";
import {
  eodViaProxy,
  failureOf,
  quotesViaProxy,
  screenKey,
  screenViaProxy,
} from "@/lib/proxy-fetch";
import type { ScreenRow } from "@/lib/screen-query";
import {
  fromAddress,
  nextSelection,
  NO_SELECTION,
  type Selection,
  shownSymbol,
} from "@/lib/selection";

/** Which definition draws which panel type. The container knows them all; they know none. */
const PANELS: Record<string, PanelDef<never>> = {
  watchlist: WatchlistPanel as PanelDef<never>,
  screen: ScreenPanel as PanelDef<never>,
  backtest: BacktestPanel as PanelDef<never>,
  quote: QuotePanel as PanelDef<never>,
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

  // The one way the selection changes. Selecting what is already selected returns the
  // same object, so nothing re-renders: remove that guard in nextSelection and the two
  // effects below chase each other through the address bar.
  const select = useCallback((symbol: string, source: string) => {
    setSelection((current) => nextSelection(current, symbol, source));
  }, []);

  const needsByPanel = useMemo(
    () =>
      layout.panels.map((p) => {
        const def = defOf(p);
        return def ? def.dataNeeds(effectiveConfig(p, selection) as never) : null;
      }),
    [layout, selection],
  );

  // Every symbol on the page: the only ones the address may select.
  const showing = useMemo(
    () => [
      ...new Set([
        ...unionNeeds(needsByPanel.flatMap((n) => (n ? [n] : []))),
        ...[...loaded.screens.values()].flatMap((s) => s.value.map(toTicker)),
      ]),
    ],
    [needsByPanel, loaded],
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

  const fetchFor = useCallback(
    async (needs: Needs[], force: boolean) => {
      const ruleSymbols = rulesNow.current.filter((r) => r.enabled).map((r) => r.ticker);
      const symbols = unionNeeds([...needs, { quotes: ruleSymbols }]);
      const screens = [...new Set(needs.flatMap((n) => (n.screen ? [screenKey(n.screen)] : [])))];
      const histories = [...new Set(needs.flatMap((n) => (n.eod ? [n.eod] : [])))];

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

  useEffect(() => {
    // Started after this render, so the effect itself sets no state.
    const started = Promise.resolve().then(() =>
      fetchFor(needsByPanel.flatMap((n) => (n ? [n] : [])), false),
    );
    void started;
  }, [needsByPanel, fetchFor]);

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

  /** What the panel has, for its state: null until the first answer for it arrives. */
  function rowsOf(needs: Needs, data: PanelData): unknown[] | null {
    if (needs.screen) return data.screen?.rows ?? null;
    if (needs.eod) return data.bars?.rows ?? null;
    return data.quotes.length === 0 && needs.quotes.length > 0 ? null : data.quotes;
  }

  return (
    <div className="flex flex-col gap-4">
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
          onClick={() => void fetchFor(needsByPanel.flatMap((n) => (n ? [n] : [])), true)}
          className="rounded border border-zinc-300 px-2.5 py-1 text-sm dark:border-zinc-700"
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
          if (!def || !needs) {
            return <PanelFrame key={panel.id} panel={panel} onRename={onRename} />;
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
              aside={asideFor(state.kind, needs, data)}
            >
              <PanelBoundary>
                {state.kind === "loading" ? (
                  <Skeleton />
                ) : state.kind === "failed" ? (
                  <div className="flex flex-col gap-3">
                    <Failed
                      failure={state.failure}
                      onRetry={() => void fetchFor([needs], true)}
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

/** The small text at the right of a panel's title: its state, and the age of what it shows. */
function asideFor(kind: string, needs: Needs, data: PanelData): string {
  const age = ageOf(needs, data);
  switch (kind) {
    case "loading":
      return "Loading…";
    case "refreshing":
      return age ? `${age} · refreshing…` : "Refreshing…";
    case "failed":
      return age ? `${age} · stale, refresh failed` : "Failed";
    default:
      return age ?? "";
  }
}

/** The age of the data itself, from its own dates, not from when it was fetched. */
function ageOf(needs: Needs, data: PanelData): string | null {
  if (needs.screen) {
    const date = data.screen?.rows[0]?.last_day_data_date;
    return date ? `session ${date}` : null;
  }
  if (needs.eod) {
    const last = data.bars?.rows.at(-1)?.date;
    return last ? `to ${last}` : null;
  }
  const oldest = oldestTimestamp(data.quotes.map((q) => q.row));
  if (oldest === null) return null;
  const minutes = Math.max(0, Math.round((data.quotes[0].fetchedAt / 1000 - oldest) / 60));
  if (minutes < 60) return `${minutes} min old`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h old` : `${Math.round(hours / 24)} days old`;
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

function Failed({ failure, onRetry }: { failure: Failure; onRetry(): void }) {
  const { what, next } = failureSentence(failure);
  // A spent day never retries: asking again before midnight only fails again.
  const retry = failure.kind !== "quota" && failure.kind !== "no-key";
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
