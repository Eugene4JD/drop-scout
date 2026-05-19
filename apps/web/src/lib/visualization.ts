export interface BenchmarkVisualizationData {
  schemaVersion: 1;
  generatedAt: string;
  title: string;
  benchmarkWindow: {
    start: string;
    end: string;
    label: string;
  };
  setup: {
    budgetUsd: number;
    contextDays: number;
    feePct: number;
    itemsCount: number;
    tradingMode: string;
    noLookahead: boolean;
    executionRule: string;
  };
  headline: {
    measuredConclusion: string;
    bestCompletedModel: string;
    bestCompletedAverageReturnPct: number;
    proProjection: string;
  };
  completedLeaderboard: CompletedModelResult[];
  partialAndProEvidence: PartialModelResult[];
  projections: ProjectionResult[];
  humanMarketBaseline: HumanMarketBaseline;
  displayRules: string[];
  caveats: string[];
  sourceReports: Record<string, string>;
}

export interface CompletedModelResult {
  model: string;
  kind: "measured";
  benchmarkStatus: "complete";
  coverage: Coverage;
  averageReturnPct: number;
  averageDeltaVsWindowStartHoldUsd: number;
  bestItem: ItemResult;
  worstItem: ItemResult;
  items: ItemResult[];
}

export interface PartialModelResult {
  model: string;
  kind: "partial_measured";
  benchmarkStatus: "partial";
  coverage: Coverage;
  averageReturnPctOnCoveredItems: number;
  displayEligibility: string;
  items: PartialItemResult[];
}

export interface ProjectionResult {
  model: string;
  kind: "projection";
  benchmarkStatus: "projected_not_measured";
  coverage: Coverage;
  projectedAverageReturnPct: {
    low: number;
    base: number;
    high: number;
  };
  confidence: string;
  explanation: string;
}

export interface Coverage {
  executedDecisions: number;
  requiredDecisions: number;
  percent: number;
}

export interface ItemResult {
  item: string;
  status: "complete";
  decisions: {
    executed: number;
    required: number;
  };
  finalPortfolioValueUsd: number;
  returnPct: number;
  windowStartHoldValueUsd: number;
  deltaVsWindowStartHoldUsd: number;
  trades?: TradeDecision[];
}

export interface PartialItemResult {
  item: string;
  status: "complete" | "partial" | "not_started";
  decisions: {
    executed: number;
    required: number;
  };
  asOf: string | null;
  nextMissingDecisionAt: string | null;
  finalPortfolioValueUsd: number;
  returnPct: number;
  windowStartHoldValueUsd: number;
  deltaVsWindowStartHoldUsd: number;
}

export interface TradeDecision {
  executedAt: string;
  action: "buy" | "sell" | "hold" | "skip";
  targetPositionPct: number;
  priceUsd: number;
  portfolioValueUsd: number;
  confidence: number;
  rationale: string;
  evidence: string[];
  riskFlags: string[];
}

export interface HumanMarketBaseline {
  summary: {
    itemsComplete: number;
    itemsMissingData: number;
    strongestTimingOpportunity: {
      item: string;
      timingOpportunityPct: number;
    };
    highestLiquidity: {
      item: string;
      totalVolume: number;
    };
  };
  items: BaselineItem[];
}

export interface BaselineItem {
  item: string;
  status: "complete" | "missing_data";
  window: {
    start: string;
    end: string;
  };
  windowStartPriceUsd: number;
  averageHumanMarketPriceUsd: number;
  bestHindsightCloseUsd: number;
  worstHindsightCloseUsd: number;
  timingOpportunityPct: number;
  totalVolume: number;
  liquidityTier: string;
  issues: string[];
}

export type VisualView = "leaderboard" | "items" | "evidence" | "matrix";

export function formatPct(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "n/a" : `${value.toFixed(digits)}%`;
}

export function formatUsd(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "n/a" : `$${value.toFixed(digits)}`;
}

export function formatInt(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "n/a" : new Intl.NumberFormat("en").format(value);
}

export function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(new Date(value));
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function windowStartHoldAverageReturn(model: CompletedModelResult | undefined): number | null {
  if (!model) return null;
  return average(model.items.map((item) => ((item.windowStartHoldValueUsd - 5) / 5) * 100));
}

export function itemTicker(name: string): string {
  const overrides: Record<string, string> = {
    "Dreams & Nightmares Case": "DNC",
    "Fever Case": "FVR",
    "Fracture Case": "FRC",
    "Kilowatt Case": "KWT",
    "Recoil Case": "RCL",
    "Revolution Case": "RVT"
  };
  return overrides[name] ?? name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}
