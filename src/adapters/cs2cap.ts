import type { Cs2CapCandlesPayload, RawArtifact } from "../types.js";
import { buildArtifact, saveRawArtifact } from "../data/rawArtifacts.js";
import type { DateWindow } from "../types.js";

export interface Cs2CapFetchOptions {
  item: string;
  window?: DateWindow;
  lookback?: string;
  currency: string;
  interval: "1d" | "1h" | "5m";
  fill: boolean;
  apiKey?: string;
  baseUrl?: string;
}

export async function fetchCs2CapForItem(options: Cs2CapFetchOptions): Promise<string[]> {
  const paths: string[] = [];
  paths.push(await fetchCandles(options));
  paths.push(await fetchRecentSales(options));
  return paths;
}

async function fetchCandles(options: Cs2CapFetchOptions): Promise<string> {
  const url = new URL("/v1/prices/candles", options.baseUrl ?? "https://api.cs2c.app");
  url.searchParams.set("market_hash_name", options.item);
  if (options.window) {
    url.searchParams.set("start", options.window.start);
    url.searchParams.set("end", options.window.end);
  } else if (options.lookback) {
    url.searchParams.set("lookback", options.lookback);
  }
  url.searchParams.set("interval", options.interval);
  url.searchParams.set("fill", String(options.fill));
  url.searchParams.set("currency", options.currency);

  const artifact = await requestCs2Cap<Cs2CapCandlesPayload>({
    url: url.toString(),
    item: options.item,
    kind: "candles",
    window: options.window,
    lookback: options.lookback,
    apiKey: options.apiKey
  });

  return saveRawArtifact(artifact);
}

async function fetchRecentSales(options: Cs2CapFetchOptions): Promise<string> {
  const url = new URL("/v1/sales", options.baseUrl ?? "https://api.cs2c.app");
  url.searchParams.set("market_hash_name", options.item);
  url.searchParams.set("currency", options.currency);
  url.searchParams.set("limit", "50");

  const artifact = await requestCs2Cap<unknown>({
    url: url.toString(),
    item: options.item,
    kind: "sales",
    window: options.window,
    lookback: options.lookback,
    apiKey: options.apiKey,
    missingKeyMessage:
      "CS2Cap recent sales also require CS2CAP_API_KEY. Sales are optional context; candles are the required V1 historical data."
  });

  return saveRawArtifact(artifact);
}

async function requestCs2Cap<TPayload>(options: {
  url: string;
  item: string;
  kind: "candles" | "sales";
  window?: DateWindow;
  lookback?: string;
  apiKey?: string;
  missingKeyMessage?: string;
}): Promise<RawArtifact<TPayload>> {
  if (!options.apiKey) {
    return buildArtifact<TPayload>({
      provider: "cs2cap",
      kind: options.kind,
      item: options.item,
      ok: false,
      fetchedAt: new Date().toISOString(),
      request: {
        url: options.url,
        method: "GET",
        window: options.window,
        lookback: options.lookback
      },
      error: {
        code: "MISSING_CS2CAP_API_KEY",
        message:
          options.missingKeyMessage ??
          "CS2Cap historical market data requires CS2CAP_API_KEY. No historical data was fetched."
      },
      notes: [
        "This blocker is intentional. DropScout must not fabricate historical market data.",
        "Set CS2CAP_API_KEY in .env and rerun dropscout fetch."
      ]
    });
  }

  try {
    const response = await fetch(options.url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.apiKey}`
      }
    });
    const payload = (await response.json().catch(() => null)) as TPayload;

    if (!response.ok) {
      return buildArtifact<TPayload>({
        provider: "cs2cap",
        kind: options.kind,
        item: options.item,
        ok: false,
        fetchedAt: new Date().toISOString(),
        request: {
          url: options.url,
          method: "GET",
          window: options.window,
          lookback: options.lookback
        },
        error: {
          code: `CS2CAP_HTTP_${response.status}`,
          message: `CS2Cap returned HTTP ${response.status}.`,
          status: response.status,
          detail: payload
        }
      });
    }

    return buildArtifact<TPayload>({
      provider: "cs2cap",
      kind: options.kind,
      item: options.item,
      ok: true,
      fetchedAt: new Date().toISOString(),
      request: {
        url: options.url,
        method: "GET",
        window: options.window,
        lookback: options.lookback
      },
      payload
    });
  } catch (error) {
    return buildArtifact<TPayload>({
      provider: "cs2cap",
      kind: options.kind,
      item: options.item,
      ok: false,
      fetchedAt: new Date().toISOString(),
      request: {
        url: options.url,
        method: "GET",
        window: options.window,
        lookback: options.lookback
      },
      error: {
        code: "CS2CAP_NETWORK_ERROR",
        message: (error as Error).message
      }
    });
  }
}
