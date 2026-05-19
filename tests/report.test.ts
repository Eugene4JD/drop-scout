import { describe, expect, it } from "vitest";
import { renderMarkdownReport } from "../src/reports/markdown.js";
import type { HumanBenchmarkReport } from "../src/types.js";

describe("renderMarkdownReport", () => {
  it("renders required benchmark sections", () => {
    const markdown = renderMarkdownReport({
      generatedAt: "2026-05-19T00:00:00.000Z",
      source: "normalized_market_candles",
      dataMeaning: "Aggregate market behavior.",
      budgetUsd: 5,
      items: [],
      summary: {
        itemsComplete: 0,
        itemsMissingData: 0
      },
      caveats: ["No agent in V1."]
    } satisfies HumanBenchmarkReport);

    expect(markdown).toContain("# DropScout Human Benchmark");
    expect(markdown).toContain("V1 is intentionally only data gathering");
    expect(markdown).toContain("## Caveats");
  });
});
