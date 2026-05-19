import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createCachedDecisionProvider } from "../src/agent/cache.js";
import { runAgentModelMatrix } from "../src/agent/matrix.js";
import type { AgentDecisionProvider } from "../src/agent/types.js";
import type { MarketCandle, NormalizedMarketData } from "../src/types.js";

describe("agent model matrix", () => {
  it("isolates model failures without losing successful model reports", async () => {
    const report = await runAgentModelMatrix(
      normalized([
        candle("2026-01-01T00:00:00.000Z", 1),
        candle("2026-01-02T00:00:00.000Z", 2)
      ]),
      {
        models: ["ok-model", "bad-model"],
        budgetUsd: 10,
        contextDays: 1,
        feePct: 0,
        maxConcurrency: 2
      },
      (model) => {
        if (model === "bad-model") {
          return async () => {
            throw new Error("model unavailable");
          };
        }

        return async () => ({
          action: "buy",
          targetPositionPct: 100,
          confidence: 0.9,
          rationale: "Buy for deterministic test.",
          evidence: ["test"],
          riskFlags: []
        });
      }
    );

    expect(report.results.find((result) => result.model === "ok-model")?.status).toBe("complete");
    expect(report.results.find((result) => result.model === "bad-model")?.status).toBe("failed");
    expect(report.summary.modelsComplete).toBe(1);
    expect(report.summary.modelsFailed).toBe(1);
  });

  it("caches decisions by model and input for resumable matrix runs", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "dropscout-agent-cache-"));
    let calls = 0;
    const baseProvider: AgentDecisionProvider = async () => {
      calls += 1;
      return {
        action: "hold",
        targetPositionPct: 0,
        confidence: 0.8,
        rationale: "Hold in cash.",
        evidence: ["cached"],
        riskFlags: []
      };
    };

    const cached = createCachedDecisionProvider(baseProvider, { cacheDir, model: "cache-model" });
    await cached(decisionInput("2026-01-01T00:00:00.000Z"));
    await cached(decisionInput("2026-01-01T00:00:00.000Z"));

    expect(calls).toBe(1);
  });
});

function normalized(candles: MarketCandle[]): NormalizedMarketData {
  return {
    generatedAt: "2026-01-03T00:00:00.000Z",
    window: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-03T00:00:00.000Z"
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

function decisionInput(timestamp: string) {
  return {
    item: "Kilowatt Case",
    model: "cache-model",
    step: 1,
    contextCandles: [candle(timestamp, 1)],
    portfolio: {
      cashUsd: 10,
      units: 0,
      valueUsd: 10
    },
    dataIssues: []
  };
}
