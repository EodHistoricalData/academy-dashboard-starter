import { describe, expect, it } from "vitest";
import { findDirectCalls, scriptUrls } from "../scripts/check-network.mjs";

describe("findDirectCalls", () => {
  it("finds a browser fetch that goes straight to EODHD with a key", () => {
    const chunk =
      'fetch(`https://eodhd.com/api/real-time/${t}?fmt=json&api_token=${k}`)';
    expect(findDirectCalls(chunk)).toEqual([
      "https://eodhd.com/api",
      "&api_token=",
    ]);
  });

  it("leaves a page that only links to the EODHD site alone", () => {
    const html =
      '<a href="https://eodhd.com">eodhd.com</a> <p>Market data by EODHD.</p>' +
      'fetch("/api/proxy/real-time/AAPL.US?s=MSFT.US")';
    expect(findDirectCalls(html)).toEqual([]);
  });
});

describe("scriptUrls", () => {
  it("keeps the page's own scripts and skips other sites", () => {
    const html =
      '<script src="/_next/static/chunks/a.js" async=""></script>' +
      '<script src="https://cdn.example.com/x.js"></script>' +
      '<script src="/_next/static/chunks/a.js"></script>';
    expect(scriptUrls(html, "https://me.vercel.app/")).toEqual([
      "https://me.vercel.app/_next/static/chunks/a.js",
    ]);
  });
});
