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
 * Every ticker here costs the same single API call as one: the quotes are fetched in one
 * multi-symbol request. Length is not what burns your quota — how often you reload is.
 */
export const WATCHLIST: string[] = [
  "AAPL.US",
  "MSFT.US",
  "NVDA.US",
  "SPY.US",
  "BTC-USD.CC",
];
