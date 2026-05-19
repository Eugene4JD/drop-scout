import { describe, expect, it } from "vitest";
import { runPaperTradingBenchmark } from "../src/agent/paperTrading.js";
import type { AgentDecisionInput } from "../src/agent/types.js";
import type { MarketCandle, NormalizedMarketData } from "../src/types.js";

describe("runPaperTradingBenchmark", () => {
  it("runs walk-forward without exposing the execution candle to the agent", async () => {
    const calls: AgentDecisionInput[] = [];
    const report = await runPaperTradingBenchmark(
      normalized([
        candle("2026-01-01T00:00:00.000Z", 1),
        candle("2026-01-02T00:00:00.000Z", 2),
        candle("2026-01-03T00:00:00.000Z", 4)
      ]),
      {
        budgetUsd: 10,
        contextDays: 1,
        feePct: 0,
        model: "test-model"
      },
      async (input) => {
        calls.push(input);
        expect(input.contextCandles).toHaveLength(1);
        expect(input).not.toHaveProperty("executionCandle");
        return {
          action: "buy",
          targetPositionPct: 100,
          confidence: 0.9,
          rationale: "Allocate fully for this deterministic test.",
          evidence: [input.contextCandles[0].timestamp],
          riskFlags: []
        };
      }
    );

    expect(calls.map((call) => call.contextCandles.map((context) => context.timestamp))).toEqual([
      ["2026-01-01T00:00:00.000Z"],
      ["2026-01-02T00:00:00.000Z"]
    ]);
    expect(report.items[0].trades.map((trade) => trade.executedAt)).toEqual([
      "2026-01-02T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z"
    ]);
    expect(report.items[0].finalPortfolioValue).toBeCloseTo(20);
    expect(report.items[0].baselineValues.windowStartHoldValue).toBeCloseTo(40);
  });

  it("does not add missing-data rows for issues outside a limited item run", async () => {
    const report = await runPaperTradingBenchmark(
      {
        ...normalized([
          candle("2026-01-01T00:00:00.000Z", 1),
          candle("2026-01-02T00:00:00.000Z", 2)
        ]),
        issues: [
          {
            item: "Other Case",
            provider: "cs2cap",
            kind: "sales",
            code: "CS2CAP_HTTP_403",
            message: "Sales unavailable"
          }
        ]
      },
      {
        budgetUsd: 10,
        contextDays: 1,
        feePct: 0,
        model: "test-model",
        limitItems: 1
      },
      async () => ({
        action: "hold",
        targetPositionPct: 0,
        confidence: 0.9,
        rationale: "Stay in cash for this test.",
        evidence: ["test"],
        riskFlags: []
      })
    );

    expect(report.items.map((item) => item.item)).toEqual(["Kilowatt Case"]);
  });
});

function normalized(candles: MarketCandle[]): NormalizedMarketData {
  return {
    generatedAt: "2026-01-04T00:00:00.000Z",
    window: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-04T00:00:00.000Z"
    },
    priceScale: "raw",
    candles,
    issues: []
  };
}

function candle(timestamp: string, close: number): MarketCandle {
  return {
    item: "Kilowatt Case",
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
    provider: "cs2cap",
    sourceKind: "ohlcv",
    currency: "USD",
    raw: { open: close, high: close, low: close, close, volume: 100 }
  };
}
