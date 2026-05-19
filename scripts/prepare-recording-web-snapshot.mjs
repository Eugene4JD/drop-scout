#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const snapshotPath = resolve(root, "apps/web/src/data/dropscout-snapshot.json");
const visualizationPath = resolve(root, "apps/web/src/data/benchmark-visualization-data.json");
const snapshot = readJson("apps/web/src/data/dropscout-snapshot.json");
const visualization = readJson("apps/web/src/data/benchmark-visualization-data.json");

const modelSpecs = [
  ["gemini-3.1-pro-preview", "google", 12.4, 0.038],
  ["gemini-3-flash-preview", "google", 8.1, 0.009],
  ["gemini-2.5-pro", "google", 5.6, 0.021],
  ["gemini-2.5-flash", "google", 2.8, 0.006],
  ["gemini-2.5-flash-lite", "google", 0.0, 0.003]
];

const generatedAt = new Date().toISOString();
const humanTotal = snapshot.summary.humanTotal ?? 3.04;
const maxSavingsPct = snapshot.summary.maxSavingsPct ?? 20.48;
const completeItems = snapshot.items.filter((item) => item.status === "complete");

snapshot.generatedAt = generatedAt;
snapshot.summary.issueCount = snapshot.summary.issueCount ?? 0;
snapshot.summary.caveats = [
  "RECORDING DEMO SNAPSHOT: model matrix values are mocked for video capture; benchmark baselines and item candles come from local artifacts.",
  ...snapshot.summary.caveats.filter((caveat) => !String(caveat).startsWith("RECORDING DEMO SNAPSHOT"))
];

snapshot.models = [
  ...modelSpecs.map(([slug, vendor, savingsPct, costUsd], index) => {
    const totalSpend = humanTotal * (1 - Number(savingsPct) / 100);
    return {
      slug,
      vendor,
      status: "complete",
      rankable: true,
      generatedAt,
      costUsd,
      totalSpend,
      savingsPct,
      efficiencyPct: maxSavingsPct > 0 ? (Number(savingsPct) / maxSavingsPct) * 100 : null,
      decisions: completeItems.map((item, itemIndex) => decisionFor(item, itemIndex, Number(savingsPct))),
      issues: index === modelSpecs.length - 1 ? ["Recording demo row: evidence-gated hold/skip behavior retained."] : [],
      runCommand: `node scripts/recording-cli-demo.mjs # visual mock for ${slug}`
    };
  }),
  {
    slug: "claude-4.5-sonnet",
    vendor: "anthropic",
    status: "queued",
    rankable: false,
    generatedAt: null,
    costUsd: null,
    totalSpend: null,
    savingsPct: null,
    efficiencyPct: null,
    decisions: [],
    issues: [],
    runCommand: "node scripts/recording-cli-demo.mjs # queued demo row"
  },
  {
    slug: "gpt-5.2",
    vendor: "openai",
    status: "queued",
    rankable: false,
    generatedAt: null,
    costUsd: null,
    totalSpend: null,
    savingsPct: null,
    efficiencyPct: null,
    decisions: [],
    issues: [],
    runCommand: "node scripts/recording-cli-demo.mjs # queued demo row"
  }
];

writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
visualization.generatedAt = generatedAt;
visualization.caveats = [
  "RECORDING NOTE: terminal model-run animation is mocked for video capture; this page shows the current local benchmark visualization data.",
  ...visualization.caveats.filter((caveat) => !String(caveat).startsWith("RECORDING NOTE:"))
];

writeFileSync(visualizationPath, `${JSON.stringify(visualization, null, 2)}\n`);
console.log(`Prepared recording demo snapshot with ${snapshot.models.length} model rows.`);
console.log(`Wrote ${snapshotPath}`);
console.log(`Prepared website recording note for the active visualization page.`);
console.log(`Wrote ${visualizationPath}`);

function decisionFor(item, index, savingsPct) {
  const human = item.humanMarketPrice ?? 1;
  const best = item.bestHistoricalPrice ?? human;
  const latest = item.candles.at(-1);
  const blend = Math.max(0, Math.min(1, savingsPct / 15));
  const price = human - (human - best) * blend * (0.72 + index * 0.035);
  const dayIndex = Math.min(item.candles.length - 1, Math.max(0, 8 + index * 3));
  return {
    itemId: item.id,
    itemName: item.name,
    action: savingsPct <= 0 && index > 1 ? "skip" : "buy",
    price: savingsPct <= 0 && index > 1 ? null : round(price),
    executedAt: item.candles[dayIndex]?.timestamp ?? latest?.timestamp ?? null,
    dayIndex,
    deltaPct: savingsPct <= 0 && index > 1 ? null : roundPct(((human - price) / human) * 100),
    confidence: savingsPct <= 0 && index > 1 ? 0.42 : round(0.62 + Math.min(0.25, savingsPct / 60)),
    rationale:
      savingsPct <= 0 && index > 1
        ? "Recording demo: model refuses when evidence quality is insufficient."
        : "Recording demo: model buys after baseline comparison and past-only candle context.",
    evidence: [
      "same benchmark candle window",
      "human market baseline already established",
      "hindsight price kept as ceiling, not visible decision input"
    ],
    riskFlags: item.issues.length > 0 ? ["provider_issues_visible"] : []
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function roundPct(value) {
  return Math.round(value * 10) / 10;
}
