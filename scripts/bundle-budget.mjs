#!/usr/bin/env node
/**
 * Bundle budget check — run after `vite build`.
 *
 * Route-level code splitting means "the bundle" is no longer one number, so
 * this reports the four figures that actually decide how fast the app feels:
 *
 *   initial Js    what the browser must parse before the first screen paints
 *                 (the entry chunk plus everything index.html preloads)
 *   initial Css   render-blocking stylesheet(s)
 *   largest chunk the single biggest parse the main thread can be asked to do
 *   total Js      what a full tour of the app costs (all lazy chunks)
 *
 * Sizes are gzip, because that is what crosses the wire. Fails the process when
 * a budget is exceeded so CI (or a pre-push hook) catches bloat at the source
 * instead of after a client complains the app is slow.
 *
 * Usage: node scripts/bundle-budget.mjs [--update]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
const BUDGET_FILE = "bundle-budgets.json";

const kb = (bytes) => bytes / 1024;
const fmt = (bytes) => `${kb(bytes).toFixed(1)} kB`;

function budget() {
  return JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
}

function gzipSize(path) {
  return gzipSync(readFileSync(path), { level: 9 }).length;
}

/** Assets referenced directly by index.html — the critical path. */
function initialAssets(html) {
  const refs = new Set();
  const patterns = [
    /<script[^>]+src="([^"]+)"/g,
    /<link[^>]+href="([^"]+\.(?:js|css))"/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const href = match[1];
      if (href.startsWith("/assets/")) refs.add(href.slice(1));
    }
  }
  return [...refs];
}

function measure() {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const assets = readdirSync(join(DIST, "assets"));

  const initial = initialAssets(html);
  const initialJs = initial.filter((f) => f.endsWith(".js"));
  const initialCss = initial.filter((f) => f.endsWith(".css"));

  const jsFiles = assets.filter((f) => f.endsWith(".js"));
  const sizes = jsFiles.map((f) => ({ file: f, gzip: gzipSize(join(DIST, "assets", f)) }));

  const sum = (files) => files.reduce((total, f) => total + gzipSize(join(DIST, f)), 0);
  const largest = sizes.reduce((max, entry) => (entry.gzip > max.gzip ? entry : max), sizes[0]);

  return {
    initialJs: sum(initialJs),
    initialCss: sum(initialCss),
    largestChunk: largest?.gzip ?? 0,
    largestFile: largest?.file ?? "—",
    totalJs: sizes.reduce((total, entry) => total + entry.gzip, 0),
    initialFiles: initial,
    chunkCount: sizes.length,
  };
}

const measured = measure();
const limits = budget();
const rows = [
  { key: "initialJs", label: "initial JS", actual: measured.initialJs, budget: limits.initialJs },
  { key: "initialCss", label: "initial CSS", actual: measured.initialCss, budget: limits.initialCss },
  { key: "largestChunk", label: "largest chunk", actual: measured.largestChunk, budget: limits.largestChunk },
  { key: "totalJs", label: "total JS", actual: measured.totalJs, budget: limits.totalJs },
];

console.log(`\nBundle budget — ${measured.chunkCount} JS chunks in ${DIST}/assets\n`);
console.log(`${"metric".padEnd(16)}${"actual".padStart(11)}${"budget".padStart(11)}${"headroom".padStart(11)}  status`);
for (const row of rows) {
  const budgetBytes = row.budget * 1024;
  const headroom = ((budgetBytes - row.actual) / budgetBytes) * 100;
  const ok = row.actual <= budgetBytes;
  console.log(
    `${row.label.padEnd(16)}${fmt(row.actual).padStart(11)}${`${row.budget} kB`.padStart(11)}${`${headroom.toFixed(0)}%`.padStart(11)}  ${ok ? "ok" : "OVER"}`,
  );
}
console.log(`\ninitial assets: ${measured.initialFiles.join(", ")}`);
console.log(`largest chunk:  ${measured.largestFile}\n`);

const failures = rows.filter((row) => row.actual > row.budget * 1024);
if (failures.length > 0) {
  console.error(`✗ ${failures.length} budget(s) exceeded.`);
  console.error("  If the growth is intended, raise the number in bundle-budgets.json in this same commit.");
  process.exit(1);
}
console.log("✓ All bundle budgets met.");
