import type { MarketCandle, PricePoint } from "../types.js";

export function mean(values: number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) {
    return Number.NaN;
  }

  return values.reduce((sum, entry) => sum + entry.value * Math.max(0, entry.weight), 0) / totalWeight;
}

export function pctChange(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0) {
    return Number.NaN;
  }

  return ((to - from) / from) * 100;
}

export function minPricePoint(candles: MarketCandle[], field: "low" | "close"): PricePoint {
  const first = candles[0];
  let result = {
    price: first[field],
    timestamp: first.timestamp
  };

  for (const candle of candles) {
    if (candle[field] < result.price) {
      result = {
        price: candle[field],
        timestamp: candle.timestamp
      };
    }
  }

  return result;
}

export function maxPricePoint(candles: MarketCandle[], field: "high" | "close"): PricePoint {
  const first = candles[0];
  let result = {
    price: first[field],
    timestamp: first.timestamp
  };

  for (const candle of candles) {
    if (candle[field] > result.price) {
      result = {
        price: candle[field],
        timestamp: candle.timestamp
      };
    }
  }

  return result;
}

export function liquidityTier(averageDailyVolume: number): "high" | "medium" | "low" {
  if (averageDailyVolume >= 50_000) {
    return "high";
  }

  if (averageDailyVolume >= 10_000) {
    return "medium";
  }

  return "low";
}
