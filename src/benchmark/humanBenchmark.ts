import type { HumanBenchmarkReport, ItemBenchmark, MarketCandle, NormalizedMarketData } from "../types.js";
import { mean, minPricePoint, maxPricePoint, pctChange, weightedAverage, liquidityTier } from "./math.js";
import { sparkline } from "../utils/format.js";

export interface BenchmarkOptions {
  budgetUsd: number;
}

export function buildHumanBenchmark(
  normalized: NormalizedMarketData,
  options: BenchmarkOptions
): HumanBenchmarkReport {
  const items = [...new Set(normalized.candles.map((candle) => candle.item))].sort();
  const itemBenchmarks = items.map((item) =>
    benchmarkItem(
      item,
      normalized.candles.filter((candle) => candle.item === item),
      options
    )
  );

  for (const issue of normalized.issues) {
    if (itemBenchmarks.some((benchmark) => benchmark.item === issue.item)) {
      continue;
    }

    itemBenchmarks.push({
      item: issue.item,
      status: "missing_data",
      currency: "USD",
      candleCount: 0,
      window: normalized.window,
      issues: [`${issue.code}: ${issue.message}`]
    });
  }

  const complete = itemBenchmarks.filter((item) => item.status === "complete");
  const strongestTimingOpportunity = complete
    .filter((item) => item.timingOpportunityPct !== undefined)
    .sort((a, b) => (b.timingOpportunityPct ?? 0) - (a.timingOpportunityPct ?? 0))[0];
  const highestLiquidity = complete
    .filter((item) => item.totalVolume !== undefined)
    .sort((a, b) => (b.totalVolume ?? 0) - (a.totalVolume ?? 0))[0];

  return {
    generatedAt: new Date().toISOString(),
    source: "normalized_market_candles",
    dataMeaning:
      "Human data is aggregate market behavior from price candles and observed volume. It is not identifiable individual trader data.",
    budgetUsd: options.budgetUsd,
    items: itemBenchmarks.sort((a, b) => a.item.localeCompare(b.item)),
    summary: {
      itemsComplete: complete.length,
      itemsMissingData: itemBenchmarks.length - complete.length,
      strongestTimingOpportunity: strongestTimingOpportunity?.timingOpportunityPct
        ? {
            item: strongestTimingOpportunity.item,
            timingOpportunityPct: strongestTimingOpportunity.timingOpportunityPct
          }
        : undefined,
      highestLiquidity: highestLiquidity?.totalVolume
        ? {
            item: highestLiquidity.item,
            totalVolume: highestLiquidity.totalVolume
          }
        : undefined
    },
    caveats: [
      "V1 contains no agent strategy. It only establishes data quality and human-market baselines.",
      "Best and worst historical prices are hindsight-only and must not be presented as live-buy decisions.",
      "OHLCV-derived VWAP is a market approximation unless exact trade-level sales are available.",
      "CS2Cap candle money fields are normalized using the configured price scale from the normalize step."
    ]
  };
}

function benchmarkItem(item: string, candles: MarketCandle[], options: BenchmarkOptions): ItemBenchmark {
  const sorted = candles
    .filter((candle) => candle.close > 0 && candle.low > 0 && candle.high > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (sorted.length === 0) {
    return {
      item,
      status: "missing_data",
      currency: "USD",
      candleCount: 0,
      window: null,
      issues: ["No valid positive-price candles available."]
    };
  }

  const first = sorted[0];
  const buyNow = {
    price: first.close,
    timestamp: first.timestamp
  };
  const best = {
    ...minPricePoint(sorted, "low"),
    label: "hindsight_only" as const
  };
  const worst = {
    ...maxPricePoint(sorted, "high"),
    label: "hindsight_only" as const
  };
  const totalVolume = sorted.reduce((sum, candle) => sum + Math.max(0, candle.volume), 0);
  const vwap = weightedAverage(sorted.map((candle) => ({ value: candle.close, weight: candle.volume })));
  const averagePrice = Number.isFinite(vwap) ? vwap : mean(sorted.map((candle) => candle.close));
  const averageDailyVolume = totalVolume / sorted.length;

  return {
    item,
    status: "complete",
    currency: first.currency,
    candleCount: sorted.length,
    window: {
      start: sorted[0].timestamp,
      end: sorted[sorted.length - 1].timestamp
    },
    buyNow,
    averageHumanMarket: {
      price: averagePrice,
      method: Number.isFinite(vwap) ? "ohlcv_vwap" : "mean_close",
      label: Number.isFinite(vwap)
        ? "OHLCV-derived VWAP from aggregate human market volume"
        : "Mean close price because volume was unavailable"
    },
    bestHistorical: best,
    worstHistorical: worst,
    volatilityPct: ((worst.price - best.price) / buyNow.price) * 100,
    timingOpportunityPct: Math.max(0, pctChange(buyNow.price, best.price) * -1),
    totalVolume,
    averageDailyVolume,
    liquidityTier: liquidityTier(averageDailyVolume),
    budget: {
      budgetUsd: options.budgetUsd,
      unitsAtBuyNow: Math.floor(options.budgetUsd / buyNow.price),
      unitsAtAverage: Math.floor(options.budgetUsd / averagePrice),
      unitsAtBestHindsight: Math.floor(options.budgetUsd / best.price)
    },
    priceSparkline: sparkline(sorted.map((candle) => candle.close)),
    volumeSparkline: sparkline(sorted.map((candle) => candle.volume))
  };
}
