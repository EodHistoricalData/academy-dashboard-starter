import { DEFAULT_LAYOUT, type Layout, MARKETS_LAYOUT, type Panel, parseLayout } from "@/lib/layout";

/**
 * Named layouts: one document, "layouts", a record of Layout by name. Names are the
 * questions the layouts answer ("Morning check", "Earnings week"), not "Layout 1".
 */
export type SavedLayouts = Record<string, Layout>;

/** The layouts that come with the code, offered to everyone. */
export const BUILT_IN_LAYOUTS: readonly Layout[] = [DEFAULT_LAYOUT, MARKETS_LAYOUT];

/**
 * The stored document, every layout parsed again: the store is not trusted either. Then
 * every built-in the document does not already have by name, so a new layout that ships
 * with the code reaches people who saved theirs before it existed. A saved layout of the
 * same name wins: it is the built-in as that person changed it.
 */
export function layoutsFrom(raw: unknown): SavedLayouts {
  const out: SavedLayouts = {};
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [name, value] of Object.entries(raw)) {
      const layout = parseLayout(value);
      out[name] = { ...layout, name };
    }
  }
  for (const layout of BUILT_IN_LAYOUTS) {
    if (!Object.hasOwn(out, layout.name)) out[layout.name] = layout;
  }
  return out;
}

/**
 * The layout with one panel's config replaced. The panel is found by identity, not by id:
 * a stored layout can hold two panels with the same id, and each keeps its own config.
 */
export function withPanelConfig(layout: Layout, panel: Panel, config: unknown): Layout {
  return {
    ...layout,
    panels: layout.panels.map((p) => (p === panel ? ({ ...p, config } as Panel) : p)),
  };
}

// A stranger's link opens the default, never an error.
export function resolveLayout(saved: SavedLayouts, name: string | null): Layout {
  return name !== null && Object.hasOwn(saved, name) ? saved[name] : DEFAULT_LAYOUT;
}

/** The address of a view: the layout's name and the selection, nothing else. */
export function viewQuery(layout: string, symbol: string | null): string {
  const q = new URLSearchParams({ layout });
  if (symbol) q.set("symbol", symbol);
  return `?${q}`;
}

/** One layout as a JSON file: its name, version and panels, in that order, and nothing else. */
export function exportLayout(layout: Layout): string {
  return JSON.stringify(
    {
      name: layout.name,
      version: layout.version,
      panels: layout.panels.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        config: p.config,
        position: p.position,
      })),
    },
    null,
    2,
  );
}
