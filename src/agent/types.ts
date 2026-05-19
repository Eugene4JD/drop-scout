import type { MarketCandle, NormalizationIssue } from "../types.js";

export type AgentAction = "buy" | "sell" | "hold" | "skip";

export interface AgentDecision {
  action: AgentAction;
  targetPositionPct: number;
  confidence: number;
  rationale: string;
  evidence: string[];
  riskFlags: string[];
}

export interface AgentPortfolioState {
  cashUsd: number;
  units: number;
  valueUsd: number;
}

export interface AgentDecisionInput {
  item: string;
  model: string;
  step: number;
  contextCandles: MarketCandle[];
  portfolio: AgentPortfolioState;
  dataIssues: NormalizationIssue[];
}

export type AgentDecisionProvider = (input: AgentDecisionInput) => Promise<AgentDecision>;

export interface PaperTradingOptions {
  budgetUsd: number;
  contextDays: number;
  feePct: number;
  model: string;
  costUsd?: number | null;
  limitItems?: number;
  callDelayMs?: number;
}

export interface AgentTrade {
  item: string;
  executedAt: string;
  price: number;
  action: AgentAction;
  targetPositionPct: number;
  units: number;
  cashUsd: number;
  portfolioValueUsd: number;
  confidence: number;
  rationale: string;
  evidence: string[];
  riskFlags: string[];
}

export interface AgentBenchmarkItem {
  item: string;
  status: "complete" | "missing_data" | "skipped";
  model: string;
  currency: string;
  startingBudgetUsd: number;
  finalPortfolioValue: number;
  returnPct: number;
  tradeCount: number;
  trades: AgentTrade[];
  baselineValues: {
    windowStartHoldValue: number;
    latestCashValue: number;
  };
  issues?: string[];
}

export interface AgentBenchmarkReport {
  generatedAt: string;
  source: "normalized_market_candles";
  model: string;
  costUsd?: number | null;
  budgetUsd: number;
  contextDays: number;
  feePct: number;
  items: AgentBenchmarkItem[];
  summary: {
    itemsComplete: number;
    itemsMissingData: number;
    bestAgentReturn?: {
      item: string;
      returnPct: number;
    };
    strongestOutperformance?: {
      item: string;
      outperformanceUsd: number;
    };
  };
  caveats: string[];
}

export interface AgentModelMatrixOptions {
  models: string[];
  budgetUsd: number;
  contextDays: number;
  feePct: number;
  costUsdByModel?: Record<string, number | null>;
  maxConcurrency: number;
  limitItems?: number;
  callDelayMs?: number;
}

export interface AgentModelMatrixResult {
  model: string;
  status: "complete" | "failed";
  report?: AgentBenchmarkReport;
  error?: string;
}

export interface AgentModelMatrixReport {
  generatedAt: string;
  source: "normalized_market_candles";
  budgetUsd: number;
  contextDays: number;
  feePct: number;
  maxConcurrency: number;
  models: string[];
  results: AgentModelMatrixResult[];
  summary: {
    modelsComplete: number;
    modelsFailed: number;
    bestModel?: {
      model: string;
      averageReturnPct: number;
    };
  };
  caveats: string[];
}
