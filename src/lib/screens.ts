import { marketGet } from "@/lib/market";
import {
  type Screen,
  type ScreenResult,
  screenErrors,
  screenRequest,
  toScreenRows,
} from "@/lib/screen-query";

export * from "@/lib/screen-query";

/**
 * Run a screen on the server, through eodhdFetch like every other request.
 *
 * Two things set /screener apart from the rest of the API. Its rows are wrapped in `data`,
 * so mapping the response object finds nothing and throws nothing. And a filter it does
 * not accept comes back as `{"errors":{"filters.0.field":[...]}}`, keyed by the path into
 * the request: that path is the most useful error in the API, so it is kept and shown.
 */
export async function screen(s: Screen): Promise<ScreenResult> {
  const req = screenRequest(s);
  const result = await marketGet(req.path, req.params, toScreenRows);
  if (result.ok) return { rows: result.value };

  // A status we have a name for (no key, rejected, quota, busy) wins. Anything else is
  // worth reading for the screener's own errors envelope before calling it unreachable.
  if (result.failure.kind === "unreachable" && result.failure.status !== null) {
    const messages = screenErrors(result.body);
    if (messages.length > 0) return { invalid: messages };
  }
  return { failure: result.failure };
}
