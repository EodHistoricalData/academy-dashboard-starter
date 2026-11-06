// Lesson 1 of "Pair With Your Agent": the first script the agent writes, made in an empty
// scratch folder of its own. It is kept here as the reference answer, outside the app.
//
// It calls EODHD directly with `demo`, the public token EODHD APIs publish for trying the
// API. It covers a handful of symbols, these three among them, and spends nothing from any
// account. The app never does this: its requests go through the server-side proxy, with
// your own key read on the server (AGENTS.md, rule 1).
//
//   node first-win/quotes.mjs

const url =
  "https://eodhd.com/api/real-time/AAPL.US?s=MSFT.US,TSLA.US&fmt=json&api_token=demo";

const res = await fetch(url);

if (!res.ok) {
  // A symbol the demo token does not cover (add NVDA.US to `s`) fails the whole request
  // with 403 and a plain-text body. Say what came back rather than crash parsing it as
  // JSON. exitCode, not exit(): exiting with the connection still open can abort Node on
  // Windows instead of returning 1.
  console.error(`Request failed: HTTP ${res.status}`);
  console.error(await res.text());
  process.exitCode = 1;
} else {
  const body = await res.json();
  // One symbol comes back as a bare object, several as an array.
  const rows = Array.isArray(body) ? body : [body];
  console.table(
    rows.map((q) => ({
      ticker: q.code,
      price: q.close,
      "change %": q.change_p,
      "time (UTC)": new Date(q.timestamp * 1000).toISOString().slice(11, 16),
    })),
  );
}
