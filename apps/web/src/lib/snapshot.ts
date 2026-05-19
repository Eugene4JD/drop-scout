export type WebModelVendor = "google" | "openai" | "anthropic" | "xai" | "meta" | "mistral" | "unknown";
export type WebModelStatus = "complete" | "incomplete" | "queued";
export type Metric = "savings" | "efficiency" | "cost" | "matrix";

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
  status: "complete" | "missing_data";
  currency: string;
  candleCount: number;
  window: {
    start: string;
    end: string;
  } | null;
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
  action: "buy" | "sell" | "hold" | "skip" | "missing_data";
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

export function formatUsd(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `$${value.toFixed(digits)}`;
}

export function formatPct(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value.toFixed(digits)}%`;
}

export function formatDate(value: string | null): string {
  if (!value) return "not run";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function metricValue(model: WebSnapshotModel, metric: Exclude<Metric, "matrix">): number | null {
  if (metric === "savings") return model.savingsPct;
  if (metric === "efficiency") return model.efficiencyPct;
  return model.costUsd;
}

export function metricLabel(metric: Metric): string {
  if (metric === "savings") return "Savings";
  if (metric === "efficiency") return "Efficiency";
  if (metric === "cost") return "Cost";
  return "Matrix";
}

export function metricInfo(snapshot: WebSnapshot, metric: Metric): string {
  if (metric === "savings") {
    return `human market ${formatUsd(snapshot.summary.humanTotal)} · ${snapshot.models.filter((model) => model.rankable).length} models`;
  }
  if (metric === "efficiency") {
    return `oracle ceiling ${formatPct(snapshot.summary.maxSavingsPct)} · 0 = human`;
  }
  if (metric === "cost") {
    return "USD per run · lower is better · n/a stays unranked";
  }
  return "savings vs cost · top-left is elite";
}

export function sortModels(models: WebSnapshotModel[], metric: Exclude<Metric, "matrix">): WebSnapshotModel[] {
  return [...models].sort((a, b) => {
    const av = metricValue(a, metric);
    const bv = metricValue(b, metric);
    const aRanked = a.rankable && av !== null;
    const bRanked = b.rankable && bv !== null;
    if (aRanked && bRanked) {
      return metric === "cost" ? av - bv : bv - av;
    }
    if (aRanked !== bRanked) return aRanked ? -1 : 1;
    if (a.status !== b.status) return statusOrder(a.status) - statusOrder(b.status);
    return a.slug.localeCompare(b.slug);
  });
}

function statusOrder(status: WebModelStatus): number {
  if (status === "complete") return 0;
  if (status === "incomplete") return 1;
  return 2;
}
