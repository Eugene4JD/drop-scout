import { basename, join } from "node:path";
import type { AgentBenchmarkReport, AgentTrade } from "../agent/types.js";
import {
  AGENT_BENCHMARK_JSON_PATH,
  AGENT_RUNS_DIR,
  BENCHMARK_JSON_PATH,
  NORMALIZED_CANDLES_PATH,
  WEB_SNAPSHOT_PATH
} from "../paths.js";
import type { HumanBenchmarkReport, ItemBenchmark, MarketCandle, NormalizedMarketData } from "../types.js";
import { listJsonFiles, readJson, slugify, writeJson } from "../utils/fs.js";

export type WebModelVendor = "google" | "openai" | "anthropic" | "xai" | "meta" | "mistral" | "unknown";
export type WebModelStatus = "complete" | "incomplete" | "queued";

export interface WebSnapshot {
  generatedAt: string;
  schemaVersion: 1;
  source: "dropscout_cli_export";
  items: WebSnapshotItem[];
  models: WebSnapshotModel[];
  summary: {
    window: {
      start: string;
      end: string;
    } | null;
    humanTotal: number | null;
    perfectHindsightTotal: number | null;
    maxSavingsPct: number | null;
    issueCount: number;
    caveats: string[];
  };
}

export interface WebSnapshotItem {
  id: string;
  name: string;
  ticker: string;
  tone: string;
  status: ItemBenchmark["status"];
  currency: string;
  candleCount: number;
  window: ItemBenchmark["window"];
  humanMarketPrice: number | null;
  bestHistoricalPrice: number | null;
  worstHistoricalPrice: number | null;
  candles: WebSnapshotCandle[];
  issues: string[];
}

export interface WebSnapshotCandle {
  timestamp: string;
  close: number;
  volume: number;
}

export interface WebSnapshotModel {
  slug: string;
  vendor: WebModelVendor;
  status: WebModelStatus;
  rankable: boolean;
  generatedAt: string | null;
  costUsd: number | null;
  totalSpend: number | null;
  savingsPct: number | null;
  efficiencyPct: number | null;
  decisions: WebSnapshotDecision[];
  issues: string[];
  runCommand: string;
}

export interface WebSnapshotDecision {
  itemId: string;
  itemName: string;
  action: AgentTrade["action"] | "missing_data";
  price: number | null;
  executedAt: string | null;
  dayIndex: number | null;
  deltaPct: number | null;
  confidence: number | null;
  rationale: string | null;
  evidence: string[];
  riskFlags: string[];
  issues: string[];
}

export interface BuildWebSnapshotInput {
  humanReport: HumanBenchmarkReport;
  normalized: NormalizedMarketData;
  agentReports: AgentBenchmarkReport[];
  generatedAt?: string;
}

export interface ExportWebSnapshotOptions {
  outPath?: string;
  humanReportPath?: string;
  normalizedPath?: string;
  latestAgentReportPath?: string;
  agentRunsDir?: string;
}

const ITEM_META: Record<string, { ticker: string; tone: string }> = {
  "Kilowatt Case": { ticker: "KWT", tone: "#3b7a8a" },
  "Revolution Case": { ticker: "RVT", tone: "#a85a2a" },
  "Recoil Case": { ticker: "RCL", tone: "#7a6b9a" },
  "Fever Case": { ticker: "FVR", tone: "#b94a6a" },
  "Fracture Case": { ticker: "FRC", tone: "#4f8a55" },
  "Dreams & Nightmares Case": { ticker: "DNC", tone: "#56579a" }
};

const MODEL_CANDIDATES = [
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-pro",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash"
] as const;

export function buildWebSnapshot(input: BuildWebSnapshotInput): WebSnapshot {
  const items = input.humanReport.items.map((item) => itemToSnapshot(item, input.normalized.candles));
  const completeItems = items.filter(
    (item) => item.status === "complete" && item.humanMarketPrice !== null && item.bestHistoricalPrice !== null
  );
  const humanTotal = completeItems.length > 0 ? sum(completeItems.map((item) => item.humanMarketPrice)) : null;
  const perfectHindsightTotal =
    completeItems.length > 0 ? sum(completeItems.map((item) => item.bestHistoricalPrice)) : null;
  const maxSavingsPct =
    humanTotal !== null && perfectHindsightTotal !== null && humanTotal > 0
      ? ((humanTotal - perfectHindsightTotal) / humanTotal) * 100
      : null;
  const reportsByModel = latestReportByModel(input.agentReports);
  const modelSlugs = unique([...MODEL_CANDIDATES, ...reportsByModel.keys()]);
  const models = modelSlugs
    .map((slug) =>
      reportToModel({
        slug,
        report: reportsByModel.get(slug),
        items,
        humanTotal,
        perfectHindsightTotal
      })
    )
    .sort(compareModels);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    schemaVersion: 1,
    source: "dropscout_cli_export",
    items,
    models,
    summary: {
      window: resolveWindow(items, input.normalized.window),
      humanTotal,
      perfectHindsightTotal,
      maxSavingsPct,
      issueCount: countIssues(items, input.agentReports),
      caveats: unique([...input.humanReport.caveats, ...input.agentReports.flatMap((report) => report.caveats)])
    }
  };
}

export async function exportWebSnapshot(options: ExportWebSnapshotOptions = {}): Promise<WebSnapshot> {
  const humanReport = await readJson<HumanBenchmarkReport>(options.humanReportPath ?? BENCHMARK_JSON_PATH);
  const normalized = await readJson<NormalizedMarketData>(options.normalizedPath ?? NORMALIZED_CANDLES_PATH);
  const agentReports = await readAgentReports(
    options.latestAgentReportPath ?? AGENT_BENCHMARK_JSON_PATH,
    options.agentRunsDir ?? AGENT_RUNS_DIR
  );
  const snapshot = buildWebSnapshot({ humanReport, normalized, agentReports });
  await writeJson(options.outPath ?? WEB_SNAPSHOT_PATH, snapshot);
  return snapshot;
}

export function agentRunHistoryPath(report: AgentBenchmarkReport): string {
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  return join(AGENT_RUNS_DIR, `${timestamp}-${slugify(report.model)}.json`);
}

function itemToSnapshot(item: ItemBenchmark, candles: MarketCandle[]): WebSnapshotItem {
  const meta = ITEM_META[item.item] ?? fallbackItemMeta(item.item);
  return {
    id: slugify(item.item),
    name: item.item,
    ticker: meta.ticker,
    tone: meta.tone,
    status: item.status,
    currency: item.currency,
    candleCount: item.candleCount,
    window: item.window,
    humanMarketPrice: item.averageHumanMarket?.price ?? null,
    bestHistoricalPrice: item.bestHistorical?.price ?? null,
    worstHistoricalPrice: item.worstHistorical?.price ?? null,
    candles: candles
      .filter((candle) => candle.item === item.item && Number.isFinite(candle.close))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((candle) => ({
        timestamp: candle.timestamp,
        close: candle.close,
        volume: candle.volume
      })),
    issues: item.issues ?? []
  };
}

function reportToModel(options: {
  slug: string;
  report: AgentBenchmarkReport | undefined;
  items: WebSnapshotItem[];
  humanTotal: number | null;
  perfectHindsightTotal: number | null;
}): WebSnapshotModel {
  const runCommand = `npm run dev -- agent-benchmark --model ${options.slug} && npm run web:export`;
  if (!options.report) {
    return {
      slug: options.slug,
      vendor: vendorForModel(options.slug),
      status: "queued",
      rankable: false,
      generatedAt: null,
      costUsd: null,
      totalSpend: null,
      savingsPct: null,
      efficiencyPct: null,
      decisions: [],
      issues: [],
      runCommand
    };
  }

  const modelIssues: string[] = [];
  const decisions = options.items
    .filter((item) => item.status === "complete")
    .map((item) => decisionForItem(item, options.report!, modelIssues));
  const rankable =
    decisions.length > 0 &&
    decisions.every((decision) => decision.action === "buy" && decision.price !== null) &&
    options.humanTotal !== null &&
    options.perfectHindsightTotal !== null &&
    options.humanTotal > options.perfectHindsightTotal;
  const totalSpend = rankable ? sum(decisions.map((decision) => decision.price)) : null;
  const savingsPct = rankable && totalSpend !== null ? ((options.humanTotal! - totalSpend) / options.humanTotal!) * 100 : null;
  const efficiencyPct =
    rankable && totalSpend !== null
      ? ((options.humanTotal! - totalSpend) / (options.humanTotal! - options.perfectHindsightTotal!)) * 100
      : null;

  return {
    slug: options.report.model,
    vendor: vendorForModel(options.report.model),
    status: rankable ? "complete" : "incomplete",
    rankable,
    generatedAt: options.report.generatedAt,
    costUsd: Number.isFinite(options.report.costUsd ?? Number.NaN) ? options.report.costUsd! : null,
    totalSpend,
    savingsPct,
    efficiencyPct,
    decisions,
    issues: unique([...modelIssues, ...options.report.items.flatMap((item) => item.issues ?? [])]),
    runCommand
  };
}

function decisionForItem(
  item: WebSnapshotItem,
  report: AgentBenchmarkReport,
  modelIssues: string[]
): WebSnapshotDecision {
  const agentItem = report.items.find((candidate) => candidate.item === item.name);
  if (!agentItem || agentItem.status !== "complete") {
    const issue = `Missing complete agent result for ${item.name}.`;
    modelIssues.push(issue);
    return missingDecision(item, agentItem?.issues ?? [issue]);
  }

  const buy = firstBuyTrade(agentItem.trades);
  if (!buy) {
    const issue = `No real buy decision for ${item.name}.`;
    modelIssues.push(issue);
    return missingDecision(item, [...(agentItem.issues ?? []), issue]);
  }

  const dayIndex = item.candles.findIndex((candle) => candle.timestamp === buy.executedAt);
  return {
    itemId: item.id,
    itemName: item.name,
    action: "buy",
    price: buy.price,
    executedAt: buy.executedAt,
    dayIndex: dayIndex >= 0 ? dayIndex : null,
    deltaPct: item.humanMarketPrice && item.humanMarketPrice > 0 ? ((item.humanMarketPrice - buy.price) / item.humanMarketPrice) * 100 : null,
    confidence: buy.confidence,
    rationale: buy.rationale,
    evidence: buy.evidence,
    riskFlags: buy.riskFlags,
    issues: agentItem.issues ?? []
  };
}

function firstBuyTrade(trades: AgentTrade[]): AgentTrade | undefined {
  return trades.find((trade) => trade.action === "buy" && trade.targetPositionPct > 0 && trade.units > 0 && trade.price > 0);
}

function missingDecision(item: WebSnapshotItem, issues: string[]): WebSnapshotDecision {
  return {
    itemId: item.id,
    itemName: item.name,
    action: "missing_data",
    price: null,
    executedAt: null,
    dayIndex: null,
    deltaPct: null,
    confidence: null,
    rationale: null,
    evidence: [],
    riskFlags: [],
    issues
  };
}

async function readAgentReports(latestPath: string, runsDir: string): Promise<AgentBenchmarkReport[]> {
  const paths = unique([latestPath, ...(await listJsonFiles(runsDir))]);
  const reports: AgentBenchmarkReport[] = [];
  for (const path of paths) {
    try {
      reports.push(await readJson<AgentBenchmarkReport>(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && path === latestPath) {
        continue;
      }
      throw new Error(`Failed to read agent report ${basename(path)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return reports;
}

function latestReportByModel(reports: AgentBenchmarkReport[]): Map<string, AgentBenchmarkReport> {
  const result = new Map<string, AgentBenchmarkReport>();
  for (const report of reports) {
    const current = result.get(report.model);
    if (!current || report.generatedAt.localeCompare(current.generatedAt) > 0) {
      result.set(report.model, report);
    }
  }
  return result;
}

function resolveWindow(items: WebSnapshotItem[], normalizedWindow: NormalizedMarketData["window"]): WebSnapshot["summary"]["window"] {
  const windows = items
    .map((item) => item.window)
    .filter((window): window is NonNullable<ItemBenchmark["window"]> => Boolean(window));
  if (windows.length === 0) {
    return normalizedWindow;
  }
  return {
    start: windows.map((window) => window.start).sort()[0],
    end: windows.map((window) => window.end).sort().at(-1) ?? windows[0].end
  };
}

function compareModels(a: WebSnapshotModel, b: WebSnapshotModel): number {
  if (a.rankable && b.rankable) {
    return (b.savingsPct ?? Number.NEGATIVE_INFINITY) - (a.savingsPct ?? Number.NEGATIVE_INFINITY);
  }
  if (a.rankable !== b.rankable) {
    return a.rankable ? -1 : 1;
  }
  if (a.status !== b.status) {
    return statusOrder(a.status) - statusOrder(b.status);
  }
  return a.slug.localeCompare(b.slug);
}

function statusOrder(status: WebModelStatus): number {
  if (status === "complete") return 0;
  if (status === "incomplete") return 1;
  return 2;
}

function vendorForModel(slug: string): WebModelVendor {
  if (slug.includes("gemini")) return "google";
  if (slug.includes("gpt") || slug.includes("openai")) return "openai";
  if (slug.includes("claude") || slug.includes("anthropic")) return "anthropic";
  if (slug.includes("grok") || slug.includes("xai")) return "xai";
  if (slug.includes("llama") || slug.includes("meta")) return "meta";
  if (slug.includes("mistral")) return "mistral";
  return "unknown";
}

function fallbackItemMeta(name: string): { ticker: string; tone: string } {
  const id = slugify(name);
  const ticker = name
    .split(/\s+/)
    .filter((part) => /^[a-z0-9]/i.test(part))
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3)
    .padEnd(3, "X");
  const hue = [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  return {
    ticker,
    tone: `hsl(${hue} 38% 42%)`
  };
}

function countIssues(items: WebSnapshotItem[], reports: AgentBenchmarkReport[]): number {
  return (
    items.reduce((count, item) => count + item.issues.length, 0) +
    reports.reduce((count, report) => count + report.items.reduce((sum, item) => sum + (item.issues?.length ?? 0), 0), 0)
  );
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
