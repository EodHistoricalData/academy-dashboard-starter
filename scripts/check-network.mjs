#!/usr/bin/env node
// After a deploy: does anything the browser loads talk to EODHD directly?
//
//   node scripts/check-network.mjs https://your-app.vercel.app https://your-app.vercel.app/screen
//
// Loads each page, then every script it pulls in from the same site, and fails if any of
// them contains an EODHD API address or an `api_token` parameter. A request from the
// browser to eodhd.com needs that address in code the browser runs, so finding none means
// every market request goes through your own /api/proxy.
//
// This replaces the network-tab check you did by hand, without adding a browser to the
// project's dependencies. What it cannot see: an address assembled at runtime from pieces
// ("eodhd" + ".com"), or a request made only after a click. If you ever write either, open
// the network tab once more.
//
// Spends no API calls of its own beyond one load of the page: the page's own fetches, on
// the server, as any visit does.

import { pathToFileURL } from "node:url";

const DIRECT = [/https?:\/\/(?:[a-z0-9-]+\.)*eodhd\.com\/api/gi, /[?&]api_token=/gi];

/** Every direct-call marker in a piece of HTML or JavaScript. */
export function findDirectCalls(text) {
  return DIRECT.flatMap((pattern) => text.match(pattern) ?? []);
}

/** Absolute URLs of the scripts a page loads from its own origin. */
export function scriptUrls(html, pageUrl) {
  const origin = new URL(pageUrl).origin;
  const urls = [];
  for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
    const url = new URL(src.replaceAll("&amp;", "&"), pageUrl);
    if (url.origin === origin) urls.push(url.href);
  }
  return [...new Set(urls)];
}

async function main(pageUrls) {
  const found = [];
  const check = (where, text) => {
    for (const hit of findDirectCalls(text)) found.push(`${where}: ${hit}`);
  };

  const scripts = new Set();
  for (const pageUrl of pageUrls) {
    const page = await fetch(pageUrl);
    if (!page.ok) throw new Error(`${pageUrl} answered ${page.status}`);
    const html = await page.text();
    check(pageUrl, html);
    for (const url of scriptUrls(html, pageUrl)) scripts.add(url);
  }
  for (const url of scripts) {
    const res = await fetch(url);
    if (res.ok) check(url, await res.text());
  }

  if (found.length > 0) {
    console.error(
      `Direct EODHD access in what the browser loads:\n  ${found.join("\n  ")}\n` +
        "Something fetches EODHD from the browser. Move it behind /api/proxy and rotate the key if it shipped.",
    );
    process.exit(1);
  }
  console.log(
    `Clean: ${pageUrls.length} pages and ${scripts.size} scripts carry no direct EODHD call.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("Usage: node scripts/check-network.mjs <page URL> [<page URL> ...]");
    process.exit(2);
  }
  main(urls).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
