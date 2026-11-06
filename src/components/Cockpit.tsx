"use client";

import { useEffect, useState } from "react";
import { BacktestPanel } from "@/components/panels/BacktestPanel";
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
import type { ScreenRow } from "@/lib/screen-query";

/** Which definition draws which panel type. The container knows them all; they know none. */
const PANELS: Record<string, PanelDef<never>> = {
  watchlist: WatchlistPanel as PanelDef<never>,
  screen: ScreenPanel as PanelDef<never>,
  backtest: BacktestPanel as PanelDef<never>,
};

function defOf(panel: Panel): PanelDef<unknown> | null {
  return (PANELS[panel.type] as PanelDef<unknown> | undefined) ?? null;
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

  useEffect(() => {
    const needs = layout.panels.flatMap((p): Needs[] => {
      const def = defOf(p);
      return def ? [def.dataNeeds(p.config as never)] : [];
    });
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
  }, [layout, stores]);

  function dataFor(needs: Needs): PanelData {
    const screen = needs.screen ? loaded.screens.get(screenKey(needs.screen)) : undefined;
    const bars = needs.eod ? loaded.bars.get(needs.eod) : undefined;
    return {
      quotes: needs.quotes.flatMap((s) => loaded.quotes.get(s) ?? []),
      screen: screen ? { rows: screen.value, fetchedAt: screen.fetchedAt } : null,
      bars: bars ? { rows: bars.value, fetchedAt: bars.fetchedAt } : null,
      notes,
    };
  }

  return (
    <div className="grid auto-rows-[minmax(8rem,auto)] grid-cols-1 gap-4 sm:grid-cols-4">
      {layout.panels.map((panel) => {
        const def = defOf(panel);
        if (!def) return <PanelFrame key={panel.id} panel={panel} />;
        const config = panel.config as never;
        const { Component } = def;
        return (
          <PanelFrame key={panel.id} panel={panel}>
            <Component
              config={config}
              data={dataFor(def.dataNeeds(config))}
              onSelect={() => {}}
              onConfigChange={() => {}}
            />
          </PanelFrame>
        );
      })}
    </div>
  );
}
