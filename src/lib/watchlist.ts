/**
 * Your watchlist.
 *
 * This is the file to edit first. Put in the tickers you actually care about — the whole
 * point of building your own tool is that it watches your things, not a demo's things.
 *
 * Format is EODHD's: SYMBOL.EXCHANGE. A few to copy:
 *   AAPL.US   MSFT.US   NVDA.US        US equities
 *   VOD.LSE   HSBA.LSE                 London (quoted in PENCE, not pounds)
 *   SAP.XETRA                          Germany
 *   BTC-USD.CC                         crypto
 *   EURUSD.FOREX                       FX
 *
 * The quotes are fetched in one multi-symbol request, but EODHD bills that request one API
 * call PER TICKER: five tickers are five calls on every page load. On the free plan's 20
 * calls a day, length and reloads both count. The page shows what one load costs.
 */
// In the order I read them at 7am: the market, what I hold, then the rest. VOD.LSE is in
// pence; nothing on the page adds prices together, so a mixed list is safe to show.
// 005930.KO (Samsung, Seoul) is here to find out whether my plan covers it: if its row
// comes back unavailable, that is the answer.
export const WATCHLIST: string[] = [
  "SPY.US",
  "AAPL.US",
  "MSFT.US",
  "NVDA.US",
  "VOD.LSE",
  "BTC-USD.CC",
  "005930.KO",
];
