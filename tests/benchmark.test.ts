import { describe, expect, it } from "vitest";
import { buildHumanBenchmark } from "../src/benchmark/humanBenchmark.js";
import type { NormalizedMarketData } from "../src/types.js";

const fixture: NormalizedMarketData = {
  generatedAt: "2026-05-19T00:00:00.000Z",
  window: {
    start: "2026-04-19T00:00:00.000Z",
    end: "2026-05-19T00:00:00.000Z"
  },
  priceScale: "minor",
  issues: [],
  candles: [
    candle("Kilowatt Case", "2026-04-19T00:00:00.000Z", 1, 1.1, 0.9, 1, 100),
    candle("Kilowatt Case", "2026-04-20T00:00:00.000Z", 1, 1.2, 0.7, 0.8, 200),
    candle("Kilowatt Case", "2026-04-21T00:00:00.000Z", 0.8, 1, 0.6, 0.9, 300)
  ]
};

describe("buildHumanBenchmark", () => {
  it("computes buy-now, VWAP, hindsight, volatility, and budget metrics", () => {
    const report = buildHumanBenchmark(fixture, { budgetUsd: 5 });
    const item = report.items[0];

    expect(item.item).toBe("Kilowatt Case");
    expect(item.status).toBe("complete");
    expect(item.buyNow?.price).toBe(1);
    expect(item.averageHumanMarket?.method).toBe("ohlcv_vwap");
    expect(item.averageHumanMarket?.price).toBeCloseTo((1 * 100 + 0.8 * 200 + 0.9 * 300) / 600);
    expect(item.bestHistorical?.price).toBe(0.6);
    expect(item.worstHistorical?.price).toBe(1.2);
    expect(item.timingOpportunityPct).toBeCloseTo(40);
    expect(item.budget?.unitsAtBuyNow).toBe(5);
    expect(item.budget?.unitsAtBestHindsight).toBe(8);
  });

  it("carries missing-data provider issues into the report", () => {
    const report = buildHumanBenchmark(
      {
        ...fixture,
        candles: [],
        issues: [
          {
            item: "Recoil Case",
            provider: "cs2cap",
            kind: "blocker",
            code: "MISSING_CS2CAP_API_KEY",
            message: "No key"
          }
        ]
      },
      { budgetUsd: 5 }
    );

    expect(report.items).toHaveLength(1);
    expect(report.items[0].status).toBe("missing_data");
    expect(report.items[0].issues?.[0]).toContain("MISSING_CS2CAP_API_KEY");
  });
});

function candle(
  item: string,
  timestamp: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
) {
  return {
    item,
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    provider: "cs2cap",
    sourceKind: "ohlcv" as const,
    currency: "USD",
    raw: {
      open,
      high,
      low,
      close,
      volume
    }
  };
}
