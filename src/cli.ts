#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { fetchCs2CapForItem } from "./adapters/cs2cap.js";
import { fetchSteamOverviewForItem } from "./adapters/steam.js";
import { parseItems } from "./config/items.js";
import { normalizeWindow } from "./utils/dates.js";
import { normalizeRawData } from "./data/normalize.js";
import { readJson, writeJson, writeText } from "./utils/fs.js";
import { buildHumanBenchmark } from "./benchmark/humanBenchmark.js";
import { BENCHMARK_JSON_PATH, BENCHMARK_MD_PATH, NORMALIZED_CANDLES_PATH } from "./paths.js";
import type { HumanBenchmarkReport, NormalizedMarketData } from "./types.js";
import { renderTerminalReport, renderIssueSummary } from "./reports/terminal.js";
import { renderMarkdownReport } from "./reports/markdown.js";

const program = new Command();

program
  .name("dropscout")
  .description("CLI data and human benchmark layer for CS2 digital-goods market timing.")
  .version("0.1.0");

program
  .command("fetch")
  .description("Fetch raw CS2Cap historical data and Steam live sanity data.")
  .option("--start <date>", "Start date, inclusive", "2026-04-19")
  .option("--end <date>", "End date, inclusive", "2026-05-18")
  .option("--items <items>", "Comma-separated item names, or 'cases' for the default basket", "cases")
  .option("--currency <currency>", "Quote currency", "USD")
  .option("--interval <interval>", "CS2Cap candle interval: 1d, 1h, or 5m", "1d")
  .action(async (options) => {
    const items = parseItems(options.items);
    const window = normalizeWindow(options.start, options.end);
    const apiKey = process.env.CS2CAP_API_KEY;
    const baseUrl = process.env.CS2CAP_BASE_URL;
    const interval = validateInterval(options.interval);

    console.log(`Fetching ${items.length} item(s) from ${window.start} to ${window.end}`);
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
          currency: options.currency,
          interval,
          apiKey,
          baseUrl
        }))
      );
      written.push(await fetchSteamOverviewForItem(item));
    }

    console.log(`Wrote ${written.length} raw artifact(s).`);
  });

program
  .command("normalize")
  .description("Normalize raw CS2Cap candle payloads into a common OHLCV schema.")
  .option("--price-scale <scale>", "CS2Cap money scale: minor or raw", "minor")
  .action(async (options) => {
    const priceScale = validatePriceScale(options.priceScale);
    const normalized = await normalizeRawData({ priceScale });
    console.log(`Normalized ${normalized.candles.length} candle(s) into ${NORMALIZED_CANDLES_PATH}`);
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
