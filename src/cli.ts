#!/usr/bin/env node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Command } from "commander";
import { fetchCs2CapForItem } from "./adapters/cs2cap.js";
import { fetchSteamOverviewForItem } from "./adapters/steam.js";
import { parseItems } from "./config/items.js";
import { normalizeWindow } from "./utils/dates.js";
import { normalizeRawData } from "./data/normalize.js";
import { readJson, writeJson, writeText } from "./utils/fs.js";
import { manifestEntryForArtifact, saveRawRunManifest } from "./data/rawArtifacts.js";
import { buildHumanBenchmark } from "./benchmark/humanBenchmark.js";
import {
  AGENT_BENCHMARK_JSON_PATH,
  AGENT_BENCHMARK_MD_PATH,
  AGENT_CACHE_DIR,
  AGENT_MATRIX_JSON_PATH,
  AGENT_MATRIX_MD_PATH,
  WEB_SNAPSHOT_PATH,
  BENCHMARK_JSON_PATH,
  BENCHMARK_MD_PATH,
  LATEST_RAW_RUN_PATH,
  NORMALIZED_CANDLES_PATH
} from "./paths.js";
import type { HumanBenchmarkReport, NormalizedMarketData, RawArtifact, RawRunManifest } from "./types.js";
import { renderTerminalReport, renderIssueSummary } from "./reports/terminal.js";
import { renderMarkdownReport } from "./reports/markdown.js";
import { resolveGeminiConfig } from "./agent/config.js";
import { createGeminiDecisionProvider } from "./agent/gemini.js";
import { runPaperTradingBenchmark } from "./agent/paperTrading.js";
import { createCachedDecisionProvider } from "./agent/cache.js";
import { runAgentModelMatrix } from "./agent/matrix.js";
import { renderAgentMarkdownReport, renderAgentTerminalReport } from "./reports/agentMarkdown.js";
import {
  renderAgentMatrixMarkdownReport,
  renderAgentMatrixTerminalReport
} from "./reports/agentMatrixMarkdown.js";
import { agentRunHistoryPath, exportWebSnapshot } from "./web/snapshot.js";

const program = new Command();

const DEFAULT_MATRIX_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

program
  .name("dropscout")
  .description("CLI data and human benchmark layer for CS2 digital-goods market timing.")
  .version("0.1.0");

program
  .command("fetch")
  .description("Fetch raw CS2Cap historical data and Steam live sanity data.")
  .option("--start <date>", "Start date, inclusive. Paid CS2Cap tiers only when paired with --end.")
  .option("--end <date>", "End date, inclusive. Paid CS2Cap tiers only when paired with --start.")
  .option("--lookback <lookback>", "Lookback window for free-tier-compatible CS2Cap candles", "30d")
  .option("--items <items>", "Comma-separated item names, or 'cases' for the default basket", "cases")
  .option("--currency <currency>", "Quote currency", "USD")
  .option("--interval <interval>", "CS2Cap candle interval: 1d, 1h, or 5m", "1d")
  .option("--fill", "Request forward-filled CS2Cap candles. Paid tiers only; default is sparse free-tier-compatible data.", false)
  .action(async (options) => {
    const items = parseItems(options.items);
    const window =
      options.start || options.end
        ? normalizeWindow(requireOption(options.start, "--start"), requireOption(options.end, "--end"))
        : undefined;
    const lookback = window ? undefined : String(options.lookback);
    const apiKey = process.env.CS2CAP_API_KEY;
    const baseUrl = process.env.CS2CAP_BASE_URL;
    const interval = validateInterval(options.interval);

    console.log(
      window
        ? `Fetching ${items.length} item(s) from ${window.start} to ${window.end}`
        : `Fetching ${items.length} item(s) with lookback=${lookback}`
    );
    if (!apiKey) {
      console.log("CS2CAP_API_KEY is missing. Historical fetches will be saved as explicit blocker artifacts.");
    }

    const written: string[] = [];
    for (const item of items) {
      console.log(`- ${item}`);
      written.push(
        ...(await fetchCs2CapForItem({
          item,
          window,
          lookback,
          currency: options.currency,
          interval,
          fill: Boolean(options.fill),
          apiKey,
          baseUrl
        }))
      );
      written.push(await fetchSteamOverviewForItem(item));
    }

    const manifest = await buildRawRunManifest({
      paths: written,
      items,
      window,
      lookback,
      currency: options.currency,
      interval,
      fill: Boolean(options.fill)
    });
    const manifestPath = await saveRawRunManifest(manifest);

    console.log(`Wrote ${written.length} raw artifact(s).`);
    console.log(`Wrote raw run manifest ${manifestPath}`);
  });

program
  .command("normalize")
  .description("Normalize raw CS2Cap candle payloads into a common OHLCV schema.")
  .option("--price-scale <scale>", "CS2Cap money scale: minor or raw", "minor")
  .option("--manifest <path>", "Raw run manifest path. Defaults to latest fetch manifest.")
  .option("--all-raw", "Explicitly normalize all legacy raw artifacts instead of a manifest-selected run.", false)
  .action(async (options) => {
    const priceScale = validatePriceScale(options.priceScale);
    const normalized = await normalizeRawData({
      priceScale,
      manifestPath: options.manifest,
      allowAllRaw: Boolean(options.allRaw)
    });
    console.log(`Normalized ${normalized.candles.length} candle(s) into ${NORMALIZED_CANDLES_PATH}`);
    if (normalized.sourceManifest) {
      console.log(`Source manifest: ${normalized.sourceManifest.path}`);
    } else if (options.allRaw) {
      console.log("Source manifest: none (--all-raw legacy mode)");
    } else {
      console.log(`Source manifest: ${LATEST_RAW_RUN_PATH}`);
    }
    if (normalized.issues.length > 0) {
      console.log(`Recorded ${normalized.issues.length} data issue(s).`);
    }
  });

program
  .command("benchmark")
  .description("Build human-market benchmark baselines from normalized candles.")
  .option("--budget <amount>", "Budget in USD for budget-based unit counts", "5")
  .action(async (options) => {
    const budgetUsd = Number(options.budget);
    if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
      throw new Error("--budget must be a positive number.");
    }

    const normalized = await readJson<NormalizedMarketData>(NORMALIZED_CANDLES_PATH);
    const report = buildHumanBenchmark(normalized, { budgetUsd });
    await writeJson(BENCHMARK_JSON_PATH, report);
    console.log(renderTerminalReport(report));

    const issueSummary = renderIssueSummary(report.items);
    if (issueSummary) {
      console.log(issueSummary);
    }

    console.log(`Wrote ${BENCHMARK_JSON_PATH}`);
  });

program
  .command("agent-benchmark")
  .description("Run Gemini-powered paper-trading decisions against normalized market candles.")
  .option("--budget <amount>", "Starting paper-trading budget in USD", "5")
  .option("--context-days <days>", "Number of prior candles visible to Gemini at each step", "7")
  .option("--fee-pct <pct>", "Paper-trading fee percentage applied to simulated notional", "0")
  .option("--model <name>", "Gemini model name. Overrides DROPSCOUT_GEMINI_MODEL.")
  .option("--temperature <value>", "Gemini sampling temperature", "0.1")
  .option("--cost-usd <amount>", "Optional public USD cost metadata for this benchmark run")
  .option("--call-delay-ms <ms>", "Delay between Gemini calls to stay below free-tier rate limits", "0")
  .option("--limit-items <count>", "Limit number of items for smoke runs")
  .action(async (options) => {
    const budgetUsd = positiveNumber(options.budget, "--budget");
    const contextDays = positiveInteger(options.contextDays, "--context-days");
    const feePct = nonNegativeNumber(options.feePct, "--fee-pct");
    const temperature = nonNegativeNumber(options.temperature, "--temperature");
    const costUsd = options.costUsd === undefined ? null : nonNegativeNumber(options.costUsd, "--cost-usd");
    const callDelayMs = nonNegativeInteger(options.callDelayMs, "--call-delay-ms");
    const limitItems = options.limitItems ? positiveInteger(options.limitItems, "--limit-items") : undefined;
    const gemini = resolveGeminiConfig({
      cliModel: options.model,
      temperature
    });

    const normalized = await readJson<NormalizedMarketData>(NORMALIZED_CANDLES_PATH);
    const provider = createGeminiDecisionProvider(gemini);
    const report = await runPaperTradingBenchmark(
      normalized,
      {
        budgetUsd,
        contextDays,
        feePct,
        model: gemini.model,
        costUsd,
        callDelayMs,
        limitItems
      },
      provider
    );

    await writeJson(AGENT_BENCHMARK_JSON_PATH, report);
    const historyPath = agentRunHistoryPath(report);
    await writeJson(historyPath, report);
    await writeText(AGENT_BENCHMARK_MD_PATH, renderAgentMarkdownReport(report));
    console.log(renderAgentTerminalReport(report));
    console.log(`Wrote ${AGENT_BENCHMARK_JSON_PATH}`);
    console.log(`Wrote ${historyPath}`);
    console.log(`Wrote ${AGENT_BENCHMARK_MD_PATH}`);
  });

program
  .command("agent-matrix")
  .description("Run a paid-tier Gemini paper-trading benchmark matrix across multiple models.")
  .option("--models <models>", "Comma-separated Gemini model names", DEFAULT_MATRIX_MODELS.join(","))
  .option("--budget <amount>", "Starting paper-trading budget in USD", "5")
  .option("--context-days <days>", "Number of prior candles visible to Gemini at each step", "7")
  .option("--fee-pct <pct>", "Paper-trading fee percentage applied to simulated notional", "0")
  .option("--temperature <value>", "Gemini sampling temperature", "0.1")
  .option("--max-concurrency <count>", "Number of models to run in parallel", "2")
  .option("--call-delay-ms <ms>", "Delay between calls inside each model run", "0")
  .option("--limit-items <count>", "Limit number of items for smoke runs")
  .option("--cache-dir <path>", "Decision cache directory", AGENT_CACHE_DIR)
  .action(async (options) => {
    const models = parseModelList(options.models);
    const budgetUsd = positiveNumber(options.budget, "--budget");
    const contextDays = positiveInteger(options.contextDays, "--context-days");
    const feePct = nonNegativeNumber(options.feePct, "--fee-pct");
    const temperature = nonNegativeNumber(options.temperature, "--temperature");
    const maxConcurrency = positiveInteger(options.maxConcurrency, "--max-concurrency");
    const callDelayMs = nonNegativeInteger(options.callDelayMs, "--call-delay-ms");
    const limitItems = options.limitItems ? positiveInteger(options.limitItems, "--limit-items") : undefined;
    const gemini = resolveGeminiConfig({ temperature });
    const normalized = await readJson<NormalizedMarketData>(NORMALIZED_CANDLES_PATH);

    console.log(
      `Running ${models.length} model(s) with maxConcurrency=${maxConcurrency}, contextDays=${contextDays}, budget=${budgetUsd}`
    );

    const report = await runAgentModelMatrix(
      normalized,
      {
        models,
        budgetUsd,
        contextDays,
        feePct,
        maxConcurrency,
        callDelayMs,
        limitItems
      },
      (model) =>
        createCachedDecisionProvider(
          createGeminiDecisionProvider({
            apiKey: gemini.apiKey,
            model,
            temperature: gemini.temperature
          }),
          {
            cacheDir: options.cacheDir,
            model
          }
        )
    );

    await writeJson(AGENT_MATRIX_JSON_PATH, report);
    await writeText(AGENT_MATRIX_MD_PATH, renderAgentMatrixMarkdownReport(report));
    console.log(renderAgentMatrixTerminalReport(report));
    console.log(`Wrote ${AGENT_MATRIX_JSON_PATH}`);
    console.log(`Wrote ${AGENT_MATRIX_MD_PATH}`);
  });

program
  .command("report")
  .description("Generate Markdown report from the latest human benchmark JSON.")
  .action(async () => {
    const report = await readJson<HumanBenchmarkReport>(BENCHMARK_JSON_PATH);
    const markdown = renderMarkdownReport(report);
    await writeJson(BENCHMARK_JSON_PATH, report);
    await writeText(BENCHMARK_MD_PATH, markdown);
    console.log(renderTerminalReport(report));
    console.log(`Wrote ${BENCHMARK_MD_PATH}`);
  });

program
  .command("web-export")
  .description("Export a reduced public JSON snapshot for the Vercel benchmark UI.")
  .option("--out <path>", "Output path", WEB_SNAPSHOT_PATH)
  .action(async (options) => {
    const snapshot = await exportWebSnapshot({ outPath: options.out });
    console.log(`Exported ${snapshot.items.length} item(s) and ${snapshot.models.length} model row(s).`);
    console.log(`Wrote ${options.out}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function validateInterval(value: string): "1d" | "1h" | "5m" {
  if (value === "1d" || value === "1h" || value === "5m") {
    return value;
  }

  throw new Error("--interval must be one of: 1d, 1h, 5m");
}

function validatePriceScale(value: string): "minor" | "raw" {
  if (value === "minor" || value === "raw") {
    return value;
  }

  throw new Error("--price-scale must be one of: minor, raw");
}

function requireOption(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required when either --start or --end is provided.`);
  }

  return value;
}

async function buildRawRunManifest(options: {
  paths: string[];
  items: string[];
  window?: RawRunManifest["request"]["window"];
  lookback?: string;
  currency: string;
  interval: RawRunManifest["request"]["interval"];
  fill: boolean;
}): Promise<RawRunManifest> {
  const artifacts = [];
  for (const path of options.paths) {
    const artifact = await readJson<RawArtifact>(path);
    artifacts.push(manifestEntryForArtifact(path, artifact));
  }

  return {
    runId: `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
    fetchedAt: new Date().toISOString(),
    request: {
      items: options.items,
      window: options.window,
      lookback: options.lookback,
      currency: options.currency,
      interval: options.interval,
      fill: options.fill
    },
    artifacts
  };
}

function positiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

function nonNegativeNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function parseModelList(value: string): string[] {
  const models = value
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  if (models.length === 0) {
    throw new Error("--models must contain at least one model name.");
  }

  return [...new Set(models)];
}
