import type {
  Cs2CapCandlesPayload,
  MarketCandle,
  NormalizationIssue,
  NormalizedMarketData,
  RawArtifact
} from "../types.js";
import { listJsonFiles, readJson, writeJson } from "../utils/fs.js";
import { epochToIso } from "../utils/dates.js";
import { NORMALIZED_CANDLES_PATH, RAW_DIR } from "../paths.js";

export interface NormalizeOptions {
  priceScale: "minor" | "raw";
}

export async function normalizeRawData(options: NormalizeOptions): Promise<NormalizedMarketData> {
  const rawFiles = await listJsonFiles(RAW_DIR);
  const candles: MarketCandle[] = [];
  const issues: NormalizationIssue[] = [];
  let window: NormalizedMarketData["window"] = null;
  const successfulCandleItems = new Set<string>();
  const deferredIssues: NormalizationIssue[] = [];

  for (const file of rawFiles) {
    const artifact = await readJson<RawArtifact<Cs2CapCandlesPayload>>(file);
    if (artifact.provider !== "cs2cap") {
      continue;
    }

    if (!artifact.ok) {
      deferredIssues.push({
        item: artifact.item,
        provider: artifact.provider,
        kind: artifact.kind,
        code: artifact.error?.code ?? "UNKNOWN_BLOCKER",
        message: artifact.error?.message ?? "Provider artifact was not successful."
      });
      continue;
    }

    if (artifact.kind !== "candles") {
      continue;
    }

    window =
      artifact.request.window ??
      (artifact.payload?.meta?.start && artifact.payload?.meta?.end
        ? {
            start: new Date(artifact.payload.meta.start).toISOString(),
            end: new Date(artifact.payload.meta.end).toISOString()
          }
        : window);
    const payload = artifact.payload;
    if (!Array.isArray(payload?.data) || payload.data.length === 0) {
      issues.push({
        item: artifact.item,
        provider: "cs2cap",
        kind: "candles",
        code: "EMPTY_CANDLE_PAYLOAD",
        message: "CS2Cap returned no candle rows for this item."
      });
      continue;
    }

    successfulCandleItems.add(artifact.item);
    for (const candle of payload.data) {
      if (!isValidCandle(candle)) {
        issues.push({
          item: artifact.item,
          provider: "cs2cap",
          kind: "candles",
          code: "INVALID_CANDLE_ROW",
          message: `Skipped invalid candle row: ${JSON.stringify(candle)}`
        });
        continue;
      }

      candles.push({
        item: artifact.item,
        timestamp: epochToIso(candle.t),
        open: normalizeMoney(candle.o, options.priceScale),
        high: normalizeMoney(candle.h, options.priceScale),
        low: normalizeMoney(candle.l, options.priceScale),
        close: normalizeMoney(candle.c, options.priceScale),
        volume: Number(candle.v),
        provider: "cs2cap",
        sourceKind: "ohlcv",
        currency: payload.meta?.currency ?? "USD",
        raw: {
          open: candle.o,
          high: candle.h,
          low: candle.l,
          close: candle.c,
          volume: candle.v
        }
      });
    }
  }

  issues.push(
    ...deferredIssues.filter(
      (issue) => !(issue.kind === "candles" && successfulCandleItems.has(issue.item))
    )
  );

  const normalized: NormalizedMarketData = {
    generatedAt: new Date().toISOString(),
    window,
    priceScale: options.priceScale,
    candles: candles.sort((a, b) => `${a.item}:${a.timestamp}`.localeCompare(`${b.item}:${b.timestamp}`)),
    issues
  };

  await writeJson(NORMALIZED_CANDLES_PATH, normalized);
  return normalized;
}

export function normalizeMoney(value: number, scale: "minor" | "raw"): number {
  return scale === "minor" ? value / 100 : value;
}

function isValidCandle(candle: unknown): candle is {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
} {
  if (!candle || typeof candle !== "object") {
    return false;
  }

  const row = candle as Record<string, unknown>;
  return ["t", "o", "h", "l", "c", "v"].every((key) => Number.isFinite(row[key]));
}
