import { describe, expect, it } from "vitest";
import { buildWebSnapshot } from "../src/web/snapshot.js";
import type { AgentBenchmarkReport } from "../src/agent/types.js";
import type { HumanBenchmarkReport, NormalizedMarketData } from "../src/types.js";

describe("buildWebSnapshot", () => {
  it("ranks only real model buy decisions against human and hindsight totals", () => {
    const snapshot = buildWebSnapshot({
      humanReport: humanBenchmark(),
      normalized: normalizedMarketData(),
      agentReports: [
        agentReport({
          model: "gemini-2.5-flash",
          costUsd: 0.02,
          entries: [
            ["Kilowatt Case", "complete", buyTrade("Kilowatt Case", 0.2, "2026-05-02T00:00:00.000Z")],
            ["Recoil Case", "complete", buyTrade("Recoil Case", 0.35, "2026-05-03T00:00:00.000Z")]
          ]
        })
      ],
      generatedAt: "2026-05-19T12:00:00.000Z"
    });

    const model = snapshot.models.find((candidate) => candidate.slug === "gemini-2.5-flash");
    expect(model?.status).toBe("complete");
    expect(model?.rankable).toBe(true);
    expect(model?.totalSpend).toBeCloseTo(0.55);
    expect(model?.savingsPct).toBeCloseTo(50);
    expect(model?.efficiencyPct).toBeCloseTo(68.75);
    expect(model?.costUsd).toBe(0.02);
    expect(model?.decisions.map((decision) => [decision.itemId, decision.action, decision.price])).toEqual([
      ["kilowatt-case", "buy", 0.2],
      ["recoil-case", "buy", 0.35]
    ]);
    expect(snapshot.summary.humanTotal).toBeCloseTo(1.1);
    expect(snapshot.summary.perfectHindsightTotal).toBeCloseTo(0.3);
    expect(snapshot.summary.maxSavingsPct).toBeCloseTo(72.7272727);
  });

  it("keeps skip-only model runs visible but unrankable", () => {
    const snapshot = buildWebSnapshot({
      humanReport: humanBenchmark(),
      normalized: normalizedMarketData(),
      agentReports: [
        agentReport({
          model: "gemini-2.5-flash-lite",
          entries: [
            ["Kilowatt Case", "complete", skipTrade("Kilowatt Case")],
            ["Recoil Case", "complete", skipTrade("Recoil Case")]
          ]
        })
      ],
      generatedAt: "2026-05-19T12:00:00.000Z"
    });

    const model = snapshot.models.find((candidate) => candidate.slug === "gemini-2.5-flash-lite");
    expect(model?.status).toBe("incomplete");
    expect(model?.rankable).toBe(false);
    expect(model?.totalSpend).toBeNull();
    expect(model?.savingsPct).toBeNull();
    expect(model?.issues).toContain("No real buy decision for Kilowatt Case.");
  });

  it("keeps missing human or agent data visible as issues", () => {
    const human = humanBenchmark();
    human.items[1] = {
      item: "Recoil Case",
      status: "missing_data",
      currency: "USD",
      candleCount: 0,
      window: null,
      issues: ["MISSING_CS2CAP_API_KEY: No key"]
    };

    const snapshot = buildWebSnapshot({
      humanReport: human,
      normalized: normalizedMarketData(),
      agentReports: [],
      generatedAt: "2026-05-19T12:00:00.000Z"
    });

    expect(snapshot.items.find((item) => item.id === "recoil-case")?.status).toBe("missing_data");
    expect(snapshot.items.find((item) => item.id === "recoil-case")?.issues).toContain("MISSING_CS2CAP_API_KEY: No key");
    expect(snapshot.summary.issueCount).toBeGreaterThan(0);
  });

  it("does not turn queued candidates into completed model results", () => {
    const snapshot = buildWebSnapshot({
      humanReport: humanBenchmark(),
      normalized: normalizedMarketData(),
      agentReports: [],
      generatedAt: "2026-05-19T12:00:00.000Z"
    });

    expect(snapshot.models).toContainEqual(
      expect.objectContaining({
        slug: "gemini-3-pro-preview",
        status: "queued",
        rankable: false,
        totalSpend: null
      })
    );
    expect(snapshot.models.filter((model) => model.status === "complete")).toHaveLength(0);
  });
});

function humanBenchmark(): HumanBenchmarkReport {
  return {
    generatedAt: "2026-05-19T00:00:00.000Z",
    source: "normalized_market_candles",
    dataMeaning: "Aggregate human market behavior.",
    budgetUsd: 5,
    items: [
      completeHumanItem("Kilowatt Case", 0.5, 0.1),
      completeHumanItem("Recoil Case", 0.6, 0.2)
    ],
    summary: {
      itemsComplete: 2,
      itemsMissingData: 0
    },
    caveats: ["Human benchmark caveat."]
  };
}

function completeHumanItem(item: string, humanPrice: number, bestPrice: number): HumanBenchmarkReport["items"][number] {
  return {
    item,
    status: "complete",
    currency: "USD",
    candleCount: 3,
    window: {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-03T00:00:00.000Z"
    },
    averageHumanMarket: {
      price: humanPrice,
      method: "ohlcv_vwap",
      label: "OHLCV-derived VWAP from aggregate human market volume"
    },
    bestHistorical: {
      price: bestPrice,
      timestamp: "2026-05-02T00:00:00.000Z",
      label: "hindsight_only"
    },
    worstHistorical: {
      price: humanPrice + 0.1,
      timestamp: "2026-05-01T00:00:00.000Z",
      label: "hindsight_only"
    }
  };
}

function normalizedMarketData(): NormalizedMarketData {
  return {
    generatedAt: "2026-05-19T00:00:00.000Z",
    window: {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-03T00:00:00.000Z"
    },
    priceScale: "raw",
    issues: [],
    candles: [
      candle("Kilowatt Case", "2026-05-01T00:00:00.000Z", 0.5),
      candle("Kilowatt Case", "2026-05-02T00:00:00.000Z", 0.1),
      candle("Kilowatt Case", "2026-05-03T00:00:00.000Z", 0.2),
      candle("Recoil Case", "2026-05-01T00:00:00.000Z", 0.6),
      candle("Recoil Case", "2026-05-02T00:00:00.000Z", 0.2),
      candle("Recoil Case", "2026-05-03T00:00:00.000Z", 0.35)
    ]
  };
}

function candle(item: string, timestamp: string, close: number): NormalizedMarketData["candles"][number] {
  return {
    item,
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
    provider: "cs2cap",
    sourceKind: "ohlcv",
    currency: "USD",
    raw: {
      open: close,
      high: close,
      low: close,
      close,
      volume: 100
    }
  };
}

function agentReport(options: {
  model: string;
  costUsd?: number;
  entries: Array<[string, "complete" | "missing_data", AgentBenchmarkReport["items"][number]["trades"][number]]>;
}): AgentBenchmarkReport {
  return {
    generatedAt: "2026-05-19T01:00:00.000Z",
    source: "normalized_market_candles",
    model: options.model,
    costUsd: options.costUsd,
    budgetUsd: 5,
    contextDays: 7,
    feePct: 0,
    items: options.entries.map(([item, status, trade]) => ({
      item,
      status,
      model: options.model,
      currency: "USD",
      startingBudgetUsd: 5,
      finalPortfolioValue: 5,
      returnPct: 0,
      tradeCount: status === "complete" ? 1 : 0,
      trades: status === "complete" ? [trade] : [],
      baselineValues: {
        windowStartHoldValue: 5,
        latestCashValue: 5
      },
      issues: status === "missing_data" ? ["No data"] : undefined
    })),
    summary: {
      itemsComplete: options.entries.filter(([, status]) => status === "complete").length,
      itemsMissingData: options.entries.filter(([, status]) => status !== "complete").length
    },
    caveats: ["Paper trading only."]
  };
}

function buyTrade(item: string, price: number, executedAt: string): AgentBenchmarkReport["items"][number]["trades"][number] {
  return {
    item,
    executedAt,
    price,
    action: "buy",
    targetPositionPct: 100,
    units: 1,
    cashUsd: 0,
    portfolioValueUsd: price,
    confidence: 0.8,
    rationale: "Buy for test.",
    evidence: ["price"],
    riskFlags: []
  };
}

function skipTrade(item: string): AgentBenchmarkReport["items"][number]["trades"][number] {
  return {
    item,
    executedAt: "2026-05-03T00:00:00.000Z",
    price: 0.3,
    action: "skip",
    targetPositionPct: 0,
    units: 0,
    cashUsd: 5,
    portfolioValueUsd: 5,
    confidence: 0.1,
    rationale: "Skip for test.",
    evidence: ["insufficient data"],
    riskFlags: ["DATA_UNAVAILABLE"]
  };
}
