import type { RawArtifact, SteamOverviewPayload } from "../types.js";
import { buildArtifact, saveRawArtifact } from "../data/rawArtifacts.js";

export async function fetchSteamOverviewForItem(item: string): Promise<string> {
  const url = new URL("https://steamcommunity.com/market/priceoverview/");
  url.searchParams.set("appid", "730");
  url.searchParams.set("currency", "1");
  url.searchParams.set("market_hash_name", item);

  let artifact: RawArtifact<SteamOverviewPayload>;
  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json"
      }
    });
    const payload = (await response.json().catch(() => null)) as SteamOverviewPayload | null;

    if (!response.ok || !payload?.success) {
      artifact = buildArtifact<SteamOverviewPayload>({
        provider: "steam",
        kind: "overview",
        item,
        ok: false,
        fetchedAt: new Date().toISOString(),
        request: {
          url: url.toString(),
          method: "GET"
        },
        error: {
          code: `STEAM_HTTP_${response.status}`,
          message: "Steam Market overview did not return a successful payload.",
          status: response.status,
          detail: payload
        }
      });
    } else {
      artifact = buildArtifact<SteamOverviewPayload>({
        provider: "steam",
        kind: "overview",
        item,
        ok: true,
        fetchedAt: new Date().toISOString(),
        request: {
          url: url.toString(),
          method: "GET"
        },
        payload,
        notes: ["Steam overview is a live sanity check only. It is not historical benchmark data."]
      });
    }
  } catch (error) {
    artifact = buildArtifact<SteamOverviewPayload>({
      provider: "steam",
      kind: "overview",
      item,
      ok: false,
      fetchedAt: new Date().toISOString(),
      request: {
        url: url.toString(),
        method: "GET"
      },
      error: {
        code: "STEAM_NETWORK_ERROR",
        message: (error as Error).message
      }
    });
  }

  return saveRawArtifact(artifact);
}
