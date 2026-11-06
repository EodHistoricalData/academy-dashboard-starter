#!/usr/bin/env node
// Builds the app with a made-up key in the environment, then fails if that value appears
// in any file under .next — client chunks, server chunks, caches, all of it.
//
//   npm run check:leak
//
// WHY A MADE-UP KEY. The point is to find out whether the build copies the key anywhere,
// and the only way to be sure a match is the key is to use a value nothing else could
// contain. A fresh random one per run also means an old build left in .next cannot pass
// or fail this run.
//
// The value goes in both EODHD_API_KEY and NEXT_PUBLIC_EODHD_API_KEY. The second is the
// classic mistake: anything prefixed NEXT_PUBLIC_ is written into the browser bundle by
// design, so code that reads it is caught here, before a deploy ships it to every visitor.
//
// No real key is needed or used. Your .env.local is not read for the key: a variable
// already set in the environment wins over the file.
//
// WHAT IS NOT SCANNED: .next/cache and .next/dev/cache. Since Next.js 16.3 Turbopack keeps
// a build cache there, and it records the value of every environment variable the code
// reads, so that it knows to rebuild when one changes. Measured on 16.3.3: the key is in
// the cache after every build, and an environment variable the code never reads is not.
// The cache is never served and is not part of what you deploy, but it is a copy of the
// key on disk: never commit .next (it is gitignored) and never copy the whole folder to a
// server.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const canary = `leakcheck${randomBytes(16).toString("hex")}`;
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

console.log("Leak check: building with a made-up key in the environment…\n");
const build = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    EODHD_API_KEY: canary,
    NEXT_PUBLIC_EODHD_API_KEY: canary,
  },
});
if (build.status !== 0) {
  console.error("\nLeak check could not run: the build failed. Fix the build first.");
  process.exit(build.status ?? 1);
}

const root = ".next";
const caches = new Set([path.join(root, "cache"), path.join(root, "dev", "cache")]);
const needle = Buffer.from(canary);
const leaks = [];
let scanned = 0;

for (const file of walk(root)) {
  scanned++;
  if (readFileSync(file).includes(needle)) leaks.push(file);
}

if (leaks.length > 0) {
  console.error(`\nLeak check FAILED: the key's value is in ${leaks.length} file(s) under ${root}:\n`);
  for (const file of leaks.slice(0, 20)) console.error(`  ${file}`);
  console.error(
    "\nSomething copies the key into the build. Usual causes: a NEXT_PUBLIC_ variable that " +
      "holds it, `env` in next.config, or reading process.env.EODHD_API_KEY in a file " +
      'marked "use client". The key belongs in src/lib/eodhd.ts and nowhere else.',
  );
  process.exit(1);
}

console.log(
  `\nLeak check clean: the key's value is in none of ${scanned} files under ${root} ` +
    "(build caches excluded, see the top of scripts/check-leak.mjs).",
);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && caches.has(full)) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}
