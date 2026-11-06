import { loadCandles } from "@/lib/backtest/candles";
import { STATED_ON, SYMBOL } from "@/lib/backtest/config";
import { paramsFrom } from "@/lib/backtest/params";
import { buildReport } from "@/lib/backtest/report";
import { paramSetsTried, readRuns } from "@/lib/backtest/runlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The backtest report as a Markdown file, generated from the run it describes. Same
 * parameters as the page (`?fast=&slow=&costBps=&slippageBps=&fill=`), same cached history:
 * downloading it costs no API calls once the page has loaded the history once.
 */
export async function GET(req: Request) {
  const params = paramsFrom(Object.fromEntries(new URL(req.url).searchParams));
  const candles = await loadCandles(SYMBOL);
  if (!("bars" in candles)) {
    const error =
      "notFound" in candles ? candles.notFound : `No history: ${candles.failure.kind}`;
    return Response.json({ error }, { status: 502, headers: { "cache-control": "no-store" } });
  }
  const report = buildReport({
    symbol: SYMBOL,
    bars: candles.bars,
    params,
    pulledAt: candles.pulledAt,
    paramSetsTried: paramSetsTried(await readRuns(), SYMBOL),
    statedOn: STATED_ON,
  });
  return new Response(report, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="backtest-${SYMBOL}.md"`,
      "cache-control": "no-store",
    },
  });
}
