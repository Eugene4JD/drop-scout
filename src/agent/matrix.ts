import type { NormalizedMarketData } from "../types.js";
import { runPaperTradingBenchmark } from "./paperTrading.js";
import type {
  AgentDecisionProvider,
  AgentModelMatrixOptions,
  AgentModelMatrixReport,
  AgentModelMatrixResult
} from "./types.js";

export async function runAgentModelMatrix(
  normalized: NormalizedMarketData,
  options: AgentModelMatrixOptions,
  providerFactory: (model: string) => AgentDecisionProvider
): Promise<AgentModelMatrixReport> {
  validateMatrixOptions(options);

  const results = await mapWithConcurrency(options.models, options.maxConcurrency, async (model) => {
    try {
      const report = await runPaperTradingBenchmark(
        normalized,
        {
          budgetUsd: options.budgetUsd,
          contextDays: options.contextDays,
          feePct: options.feePct,
          model,
          costUsd: options.costUsdByModel?.[model] ?? null,
          limitItems: options.limitItems,
          callDelayMs: options.callDelayMs
        },
        providerFactory(model)
      );

      return {
        model,
        status: "complete",
        report
      } satisfies AgentModelMatrixResult;
    } catch (error) {
      return {
        model,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      } satisfies AgentModelMatrixResult;
    }
  });

  const complete = results.filter((result) => result.status === "complete" && result.report);
  const bestModel = complete
    .map((result) => ({
      model: result.model,
      averageReturnPct:
        result.report!.items.reduce((sum, item) => sum + item.returnPct, 0) / Math.max(1, result.report!.items.length)
    }))
    .sort((a, b) => b.averageReturnPct - a.averageReturnPct)[0];

  return {
    generatedAt: new Date().toISOString(),
    source: "normalized_market_candles",
    budgetUsd: options.budgetUsd,
    contextDays: options.contextDays,
    feePct: options.feePct,
    maxConcurrency: options.maxConcurrency,
    models: options.models,
    results,
    summary: {
      modelsComplete: complete.length,
      modelsFailed: results.length - complete.length,
      bestModel
    },
    caveats: [
      "Matrix runs are paper-trading benchmarks only.",
      "Each model receives the same no-lookahead candle context.",
      "Cached decisions are reused on reruns to avoid duplicate paid API calls for identical prompts."
    ]
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]);
      }
    })
  );

  return results;
}

function validateMatrixOptions(options: AgentModelMatrixOptions): void {
  if (options.models.length === 0 || options.models.some((model) => model.trim() === "")) {
    throw new Error("Agent model matrix requires at least one non-empty model name.");
  }
  if (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1) {
    throw new Error("Agent model matrix maxConcurrency must be a positive integer.");
  }
  if (!Number.isFinite(options.budgetUsd) || options.budgetUsd <= 0) {
    throw new Error("Agent model matrix budgetUsd must be a positive number.");
  }
  if (!Number.isInteger(options.contextDays) || options.contextDays < 1) {
    throw new Error("Agent model matrix contextDays must be a positive integer.");
  }
  if (!Number.isFinite(options.feePct) || options.feePct < 0 || options.feePct >= 100) {
    throw new Error("Agent model matrix feePct must be a finite percentage from 0 inclusive to 100 exclusive.");
  }
}
