import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { normalizeRawData } from "../src/data/normalize.js";
import type { RawArtifact } from "../src/types.js";

describe("normalizeRawData run manifests", () => {
  it("normalizes only artifacts selected by the manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "dropscout-normalize-"));
    const selectedPath = join(root, "raw", "selected.json");
    const stalePath = join(root, "raw", "stale.json");
    const manifestPath = join(root, "raw", "runs", "run-a.json");
    const outputPath = join(root, "normalized.json");

    await writeJson(selectedPath, candleArtifact("Selected Case", "2026-01-01T00:00:00.000Z", 100));
    await writeJson(stalePath, candleArtifact("Stale Case", "2026-01-01T00:00:00.000Z", 900));
    await writeJson(manifestPath, {
      runId: "run-a",
      fetchedAt: "2026-01-02T00:00:00.000Z",
      request: { items: ["Selected Case"], lookback: "1d", currency: "USD", interval: "1d", fill: false },
      artifacts: [{ path: selectedPath, provider: "cs2cap", kind: "candles", item: "Selected Case", ok: true }]
    });

    const normalized = await normalizeRawData({ priceScale: "minor", manifestPath, outputPath });

    expect(normalized.candles.map((candle) => candle.item)).toEqual(["Selected Case"]);
    expect(JSON.parse(await readFile(outputPath, "utf8")).candles).toHaveLength(1);
  });

  it("records and skips duplicate item/timestamp candle rows", async () => {
    const root = await mkdtemp(join(tmpdir(), "dropscout-duplicates-"));
    const firstPath = join(root, "raw", "first.json");
    const duplicatePath = join(root, "raw", "duplicate.json");
    const manifestPath = join(root, "raw", "runs", "run-a.json");
    const outputPath = join(root, "normalized.json");

    await writeJson(firstPath, candleArtifact("Kilowatt Case", "2026-01-01T00:00:00.000Z", 100));
    await writeJson(duplicatePath, candleArtifact("Kilowatt Case", "2026-01-01T00:00:00.000Z", 200));
    await writeJson(manifestPath, {
      runId: "run-a",
      fetchedAt: "2026-01-02T00:00:00.000Z",
      request: { items: ["Kilowatt Case"], lookback: "1d", currency: "USD", interval: "1d", fill: false },
      artifacts: [
        { path: firstPath, provider: "cs2cap", kind: "candles", item: "Kilowatt Case", ok: true },
        { path: duplicatePath, provider: "cs2cap", kind: "candles", item: "Kilowatt Case", ok: true }
      ]
    });

    const normalized = await normalizeRawData({ priceScale: "minor", manifestPath, outputPath });

    expect(normalized.candles).toHaveLength(1);
    expect(normalized.candles[0].close).toBe(1);
    expect(normalized.issues.map((issue) => issue.code)).toContain("DUPLICATE_CANDLE_TIMESTAMP");
  });
});

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function candleArtifact(item: string, timestamp: string, close: number): RawArtifact {
  const seconds = Math.floor(new Date(timestamp).getTime() / 1000);

  return {
    provider: "cs2cap",
    kind: "candles",
    item,
    ok: true,
    fetchedAt: "2026-01-02T00:00:00.000Z",
    request: {
      url: "https://example.test/candles",
      method: "GET",
      lookback: "1d"
    },
    payloadHash: "test",
    payload: {
      meta: {
        currency: "USD",
        start: timestamp,
        end: "2026-01-02T00:00:00.000Z"
      },
      data: [{ t: seconds, o: close, h: close, l: close, c: close, v: 10 }]
    }
  };
}
