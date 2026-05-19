import type {
  Cs2CapCandlesPayload,
  MarketCandle,
  NormalizationIssue,
  NormalizedMarketData,
  RawArtifact,
  RawRunManifest
} from "../types.js";
import { listJsonFiles, readJson, writeJson } from "../utils/fs.js";
import { epochToIso } from "../utils/dates.js";
import { LATEST_RAW_RUN_PATH, NORMALIZED_CANDLES_PATH, RAW_DIR } from "../paths.js";

export interface NormalizeOptions {
  priceScale: "minor" | "raw";
  manifestPath?: string;
  outputPath?: string;
  allowAllRaw?: boolean;
}

export async function normalizeRawData(options: NormalizeOptions): Promise<NormalizedMarketData> {
  const source = await resolveRawArtifactFiles(options);
  const rawFiles = source.files;
  const candles: MarketCandle[] = [];
  const issues: NormalizationIssue[] = [];
  const seenCandles = new Set<string>();

  for (const file of rawFiles) {
    const artifact = await readJson<RawArtifact<Cs2CapCandlesPayload>>(file);
    if (artifact.provider !== "cs2cap") {
      continue;
    }

    if (!artifact.ok) {
      issues.push({
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

      const timestamp = epochToIso(candle.t);
      const candleKey = `${artifact.item}:${timestamp}`;
      if (seenCandles.has(candleKey)) {
        issues.push({
          item: artifact.item,
          provider: "cs2cap",
          kind: "candles",
          code: "DUPLICATE_CANDLE_TIMESTAMP",
          message: `Skipped duplicate candle timestamp ${timestamp} for ${artifact.item}.`
        });
        continue;
      }
      seenCandles.add(candleKey);

      candles.push({
        item: artifact.item,
        timestamp,
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

  candles.sort((a, b) => `${a.item}:${a.timestamp}`.localeCompare(`${b.item}:${b.timestamp}`));

  const normalized: NormalizedMarketData = {
    generatedAt: new Date().toISOString(),
    window: deriveWindow(candles),
    priceScale: options.priceScale,
    sourceManifest: source.manifest
      ? {
          runId: source.manifest.runId,
          path: source.manifestPath
        }
      : undefined,
    candles,
    issues
  };

  await writeJson(options.outputPath ?? NORMALIZED_CANDLES_PATH, normalized);
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

async function resolveRawArtifactFiles(options: NormalizeOptions): Promise<{
  files: string[];
  manifest?: RawRunManifest;
  manifestPath: string;
}> {
  if (options.allowAllRaw) {
    return {
      files: (await listJsonFiles(RAW_DIR)).filter((file) => !file.includes("/runs/")),
      manifestPath: "all-raw"
    };
  }

  const manifestPath = options.manifestPath ?? LATEST_RAW_RUN_PATH;
  let manifest: RawRunManifest;
  try {
    manifest = await readJson<RawRunManifest>(manifestPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `No raw run manifest found at ${manifestPath}. Run dropscout fetch first, pass --manifest, or use --all-raw explicitly for legacy artifacts.`
      );
    }

    throw error;
  }

  return {
    files: manifest.artifacts.map((artifact) => artifact.path),
    manifest,
    manifestPath
  };
}

function deriveWindow(candles: MarketCandle[]): NormalizedMarketData["window"] {
  if (candles.length === 0) {
    return null;
  }

  const timestamps = candles.map((candle) => candle.timestamp).sort();
  return {
    start: timestamps[0],
    end: timestamps[timestamps.length - 1]
  };
}
