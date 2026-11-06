"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BacktestPanel } from "@/components/panels/BacktestPanel";
import { QuotePanel } from "@/components/panels/QuotePanel";
import { ScreenPanel } from "@/components/panels/ScreenPanel";
import { WatchlistPanel } from "@/components/panels/WatchlistPanel";
import { PanelFrame } from "@/components/PanelFrame";
import type { Bar } from "@/lib/backtest/bars";
import type { Layout, Panel } from "@/lib/layout";
import {
  createMarketStore,
  createRequestCache,
  type Fetched,
} from "@/lib/market-store";
import type { Notes } from "@/lib/notes";
import type { Needs, PanelData, PanelDef } from "@/lib/panels";
import { unionNeeds } from "@/lib/panels";
import {
  eodViaProxy,
  quotesViaProxy,
  screenKey,
  screenViaProxy,
} from "@/lib/proxy-fetch";
import { toTicker } from "@/lib/added";
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

type Loaded = {
  quotes: Map<string, Fetched>;
  screens: Map<string, { value: ScreenRow[]; fetchedAt: number }>;
  bars: Map<string, { value: Bar[]; fetchedAt: number }>;
};

const EMPTY: Loaded = { quotes: new Map(), screens: new Map(), bars: new Map() };

/**
 * The cockpit: it owns fetching for every panel. It collects what each panel needs, unions
 * the symbols so two panels wanting the same one ask once, asks the market store (which
 * goes through /api/proxy) and hands each panel its part. Panels only draw.
 */
export function Cockpit({ layout, notes }: { layout: Layout; notes: Notes }) {
  const [stores] = useState(() => ({
    quotes: createMarketStore(quotesViaProxy, Date.now, 60_000),
    screens: createRequestCache(screenViaProxy, Date.now, 5 * 60_000),
    bars: createRequestCache(eodViaProxy, Date.now, 60 * 60_000),
  }));
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (addressed !== null) select(addressed, "address");
  }, [searchParams, showing, select]);

  useEffect(() => {
    const needs = needsByPanel.flatMap((n) => (n ? [n] : []));
    const symbols = unionNeeds(needs);
    const screens = [...new Set(needs.flatMap((n) => (n.screen ? [screenKey(n.screen)] : [])))];
    const histories = [...new Set(needs.flatMap((n) => (n.eod ? [n.eod] : [])))];

    let live = true;
    (async () => {
      const [quotes, screenAnswers, barAnswers] = await Promise.all([
        stores.quotes.quotes(symbols),
        Promise.all(screens.map((k) => stores.screens.get(k))),
        Promise.all(histories.map((s) => stores.bars.get(s))),
      ]);
      if (!live) return;
      setLoaded({
        quotes: new Map(quotes.map((q) => [q.row.code, q])),
        screens: new Map(screens.map((k, i) => [k, screenAnswers[i]])),
        bars: new Map(histories.map((s, i) => [s, barAnswers[i]])),
      });
    })().catch(() => {
      // Unit 2's last lesson gives each panel its own failure state.
    });
    return () => {
      live = false;
    };
  }, [needsByPanel, stores]);

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

  return (
    <div className="grid auto-rows-[minmax(8rem,auto)] grid-cols-1 gap-4 sm:grid-cols-4">
      {layout.panels.map((panel, i) => {
        const def = defOf(panel);
        const needs = needsByPanel[i];
        if (!def || !needs) return <PanelFrame key={panel.id} panel={panel} />;
        const { Component } = def;
        return (
          <PanelFrame key={panel.id} panel={panel}>
            <Component
              config={effectiveConfig(panel, selection) as never}
              data={dataFor(needs)}
              onSelect={(symbol) => select(symbol, panel.id)}
              onConfigChange={() => {}}
            />
          </PanelFrame>
        );
      })}
    </div>
  );
}
