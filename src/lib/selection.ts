/**
 * The selected instrument: shared state, owned by the container. One field for what, one
 * for which panel said so. Not persisted: a reload restores the layout, not what you were
 * looking at; the address is the one exception, and it is a stranger's input.
 */
export type Selection = { symbol: string | null; source: string };

export const NO_SELECTION: Selection = { symbol: null, source: "" };

/**
 * The container's update. Selecting the symbol already selected returns `current` itself,
 * not a copy, so React skips the render: that is what stops a panel that reports its own
 * click back, or an address read after a write, from looping.
 */
export function nextSelection(current: Selection, symbol: string, source: string): Selection {
  return current.symbol === symbol ? current : { symbol, source }; // same value: no-op
}

/**
 * What a panel shows: the container's decision, from config, not the panel's code. A pinned
 * panel shows its own symbol; a following one shows the selection, unless the selection
 * came from that very panel or nothing is selected yet.
 */
export function shownSymbol(
  panel: { id: string; config: { symbol?: string; follows: boolean } },
  selection: Selection,
): string | null {
  if (!panel.config.follows || selection.source === panel.id) {
    return panel.config.symbol ?? null;
  }
  return selection.symbol ?? panel.config.symbol ?? null;
}

// The address is a stranger's input: only a symbol already on the page is accepted.
export const fromAddress = (raw: string | null, showing: string[]) =>
  raw !== null && showing.includes(raw) ? raw : null;
