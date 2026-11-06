import { DEFAULT_LAYOUT, type Layout, parseLayout } from "@/lib/layout";

/**
 * Named layouts: one document, "layouts", a record of Layout by name. Names are the
 * questions the layouts answer ("Morning check", "Earnings week"), not "Layout 1".
 */
export type SavedLayouts = Record<string, Layout>;

/** The stored document, every layout parsed again: the store is not trusted either. */
export function layoutsFrom(raw: unknown): SavedLayouts {
  const out: SavedLayouts = {};
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [name, value] of Object.entries(raw)) {
      const layout = parseLayout(value);
      out[name] = { ...layout, name };
    }
  }
  return Object.keys(out).length > 0 ? out : { [DEFAULT_LAYOUT.name]: DEFAULT_LAYOUT };
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
