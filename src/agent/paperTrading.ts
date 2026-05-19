import type { MarketCandle, NormalizedMarketData, NormalizationIssue } from "../types.js";
import { pctChange } from "../benchmark/math.js";
import { parseAgentDecision } from "./decision.js";
import type {
  AgentBenchmarkItem,
  AgentBenchmarkReport,
  AgentDecisionProvider,
  AgentPortfolioState,
  AgentTrade,
  PaperTradingOptions
} from "./types.js";

export async function runPaperTradingBenchmark(
  normalized: NormalizedMarketData,
  options: PaperTradingOptions,
  provider: AgentDecisionProvider
): Promise<AgentBenchmarkReport> {
  validatePaperTradingOptions(options);

  const itemNames = [...new Set(normalized.candles.map((candle) => candle.item))]
    .sort()
    .slice(0, options.limitItems ?? Number.POSITIVE_INFINITY);
  const items: AgentBenchmarkItem[] = [];

  for (const item of itemNames) {
    items.push(
      await runItemBenchmark(
        item,
        normalized.candles.filter((candle) => candle.item === item),
        normalized.issues.filter((issue) => issue.item === item),
        options,
        provider
      )
    );
  }

  for (const issue of normalized.issues) {
    if (items.some((item) => item.item === issue.item) || options.limitItems !== undefined) {
      continue;
    }

    items.push({
      item: issue.item,
      status: "missing_data",
      model: options.model,
      currency: "USD",
      startingBudgetUsd: options.budgetUsd,
      finalPortfolioValue: options.budgetUsd,
      returnPct: 0,
      tradeCount: 0,
      trades: [],
      baselineValues: {
        windowStartHoldValue: options.budgetUsd,
        latestCashValue: options.budgetUsd
      },
      issues: [`${issue.code}: ${issue.message}`]
    });
  }

  const complete = items.filter((item) => item.status === "complete");
  const bestAgentReturn = complete.sort((a, b) => b.returnPct - a.returnPct)[0];
  const strongestOutperformance = complete
    .map((item) => ({
      item: item.item,
      outperformanceUsd: item.finalPortfolioValue - item.baselineValues.windowStartHoldValue
    }))
    .sort((a, b) => b.outperformanceUsd - a.outperformanceUsd)[0];

  return {
    generatedAt: new Date().toISOString(),
    source: "normalized_market_candles",
    model: options.model,
    costUsd: options.costUsd ?? null,
    budgetUsd: options.budgetUsd,
    contextDays: options.contextDays,
    feePct: options.feePct,
    items,
    summary: {
      itemsComplete: complete.length,
      itemsMissingData: items.length - complete.length,
      bestAgentReturn: bestAgentReturn
        ? {
            item: bestAgentReturn.item,
            returnPct: bestAgentReturn.returnPct
          }
        : undefined,
      strongestOutperformance
    },
    caveats: [
      "This is paper trading only. It does not execute real Steam, marketplace, custody, or account actions.",
      "The agent sees only prior context candles. The simulator applies decisions to the next available candle.",
      "Fee percentage is an explicit simulation parameter and defaults to zero for pure timing comparison."
    ]
  };
}

async function runItemBenchmark(
  item: string,
  candles: MarketCandle[],
  issues: NormalizationIssue[],
  options: PaperTradingOptions,
  provider: AgentDecisionProvider
): Promise<AgentBenchmarkItem> {
  const sorted = candles
    .filter((candle) => candle.close > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (sorted.length <= options.contextDays) {
    return {
      item,
      status: "missing_data",
      model: options.model,
      currency: sorted[0]?.currency ?? "USD",
      startingBudgetUsd: options.budgetUsd,
      finalPortfolioValue: options.budgetUsd,
      returnPct: 0,
      tradeCount: 0,
      trades: [],
      baselineValues: {
        windowStartHoldValue: options.budgetUsd,
        latestCashValue: options.budgetUsd
      },
      issues: ["Not enough positive-price candles for the requested walk-forward context."]
    };
  }

  let portfolio: AgentPortfolioState = {
    cashUsd: options.budgetUsd,
    units: 0,
    valueUsd: options.budgetUsd
  };
  const trades: AgentTrade[] = [];

  for (let executionIndex = options.contextDays; executionIndex < sorted.length; executionIndex += 1) {
    const executionCandle = sorted[executionIndex];
    const contextCandles = sorted.slice(Math.max(0, executionIndex - options.contextDays), executionIndex);
    const decision = parseAgentDecision(
      await provider({
        item,
        model: options.model,
        step: executionIndex - options.contextDays + 1,
        contextCandles,
        portfolio,
        dataIssues: issues
      })
    );

    portfolio = applyDecision(portfolio, decision.targetPositionPct, executionCandle.close, options.feePct);
    trades.push({
      item,
      executedAt: executionCandle.timestamp,
      price: executionCandle.close,
      action: decision.action,
      targetPositionPct: decision.targetPositionPct,
      units: portfolio.units,
      cashUsd: portfolio.cashUsd,
      portfolioValueUsd: portfolio.valueUsd,
      confidence: decision.confidence,
      rationale: decision.rationale,
      evidence: decision.evidence,
      riskFlags: decision.riskFlags
    });

    if (options.callDelayMs && executionIndex < sorted.length - 1) {
      await sleep(options.callDelayMs);
    }
  }

  const latest = sorted[sorted.length - 1];
  const finalPortfolioValue = portfolio.cashUsd + portfolio.units * latest.close;
  const windowStartUnits = options.budgetUsd / sorted[0].close;
  const windowStartHoldValue = windowStartUnits * latest.close;

  return {
    item,
    status: "complete",
    model: options.model,
    currency: latest.currency,
    startingBudgetUsd: options.budgetUsd,
    finalPortfolioValue,
    returnPct: pctChange(options.budgetUsd, finalPortfolioValue),
    tradeCount: trades.length,
    trades,
    baselineValues: {
      windowStartHoldValue,
      latestCashValue: options.budgetUsd
    },
    issues: issues.length > 0 ? issues.map((issue) => `${issue.code}: ${issue.message}`) : undefined
  };
}

function applyDecision(
  portfolio: AgentPortfolioState,
  targetPositionPct: number,
  price: number,
  feePct: number
): AgentPortfolioState {
  const currentValue = portfolio.cashUsd + portfolio.units * price;
  const targetItemValue = currentValue * (targetPositionPct / 100);
  const targetUnits = targetItemValue / price;
  const unitDelta = targetUnits - portfolio.units;
  const tradeNotional = Math.abs(unitDelta) * price;
  const fee = tradeNotional * (feePct / 100);
  const cashUsd = currentValue - targetUnits * price - fee;
  const units = targetUnits;

  return {
    cashUsd,
    units,
    valueUsd: cashUsd + units * price
  };
}

function validatePaperTradingOptions(options: PaperTradingOptions): void {
  if (!Number.isFinite(options.budgetUsd) || options.budgetUsd <= 0) {
    throw new Error("Paper-trading budget must be a positive number.");
  }
  if (!Number.isInteger(options.contextDays) || options.contextDays < 1) {
    throw new Error("Paper-trading contextDays must be a positive integer.");
  }
  if (!Number.isFinite(options.feePct) || options.feePct < 0 || options.feePct >= 100) {
    throw new Error("Paper-trading feePct must be a finite percentage from 0 inclusive to 100 exclusive.");
  }
  if (options.model.trim() === "") {
    throw new Error("Paper-trading model must not be empty.");
  }
  if (
    options.callDelayMs !== undefined &&
    (!Number.isFinite(options.callDelayMs) || options.callDelayMs < 0 || !Number.isInteger(options.callDelayMs))
  ) {
    throw new Error("Paper-trading callDelayMs must be a non-negative integer.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
