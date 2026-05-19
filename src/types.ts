export type ProviderName = "cs2cap" | "steam";

export interface DateWindow {
  start: string;
  end: string;
}

export interface RawArtifact<TPayload = unknown> {
  provider: ProviderName;
  kind: "candles" | "sales" | "overview" | "blocker";
  item: string;
  ok: boolean;
  fetchedAt: string;
  request: {
    url: string;
    method: "GET";
    window?: DateWindow;
    lookback?: string;
  };
  payloadHash: string;
  payload?: TPayload;
  error?: {
    code: string;
    message: string;
    status?: number;
    detail?: unknown;
  };
  notes?: string[];
}

export interface Cs2CapCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  q?: number | null;
  providers?: unknown;
}

export interface Cs2CapCandlesPayload {
  meta?: {
    itemId?: number;
    marketHashName?: string;
    currency?: string;
    interval?: string;
    start?: string;
    end?: string;
  };
  data?: Cs2CapCandle[];
}

export interface SteamOverviewPayload {
  success: boolean;
  lowest_price?: string;
  median_price?: string;
  volume?: string;
}

export interface MarketCandle {
  item: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  provider: string;
  sourceKind: "ohlcv";
  currency: string;
  raw: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

export interface NormalizedMarketData {
  generatedAt: string;
  window: DateWindow | null;
  priceScale: "minor" | "raw";
  candles: MarketCandle[];
  issues: NormalizationIssue[];
}

export interface NormalizationIssue {
  item: string;
  provider: ProviderName;
  kind: string;
  code: string;
  message: string;
}

export interface ItemBenchmark {
  item: string;
  status: "complete" | "missing_data";
  currency: string;
  candleCount: number;
  window: DateWindow | null;
  buyNow?: PricePoint;
  averageHumanMarket?: {
    price: number;
    method: "ohlcv_vwap" | "mean_close";
    label: string;
  };
  bestHistorical?: PricePoint & {
    label: "hindsight_only";
  };
  worstHistorical?: PricePoint & {
    label: "hindsight_only";
  };
  volatilityPct?: number;
  timingOpportunityPct?: number;
  totalVolume?: number;
  averageDailyVolume?: number;
  liquidityTier?: "high" | "medium" | "low";
  budget?: {
    budgetUsd: number;
    unitsAtBuyNow: number;
    unitsAtAverage: number;
    unitsAtBestHindsight: number;
  };
  priceSparkline?: string;
  volumeSparkline?: string;
  issues?: string[];
}

export interface PricePoint {
  price: number;
  timestamp: string;
}

export interface HumanBenchmarkReport {
  generatedAt: string;
  source: "normalized_market_candles";
  dataMeaning: string;
  budgetUsd: number;
  items: ItemBenchmark[];
  summary: {
    itemsComplete: number;
    itemsMissingData: number;
    strongestTimingOpportunity?: {
      item: string;
      timingOpportunityPct: number;
    };
    highestLiquidity?: {
      item: string;
      totalVolume: number;
    };
  };
  caveats: string[];
}
