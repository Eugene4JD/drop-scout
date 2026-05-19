import type { HumanBenchmarkReport } from "../types.js";
import { formatInt, formatPct, formatUsd } from "../utils/format.js";

export function renderMarkdownReport(report: HumanBenchmarkReport): string {
  const lines: string[] = [
    "# DropScout Human Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## What This Measures",
    "",
    report.dataMeaning,
    "",
    "Human benchmark reports do not contain agent decisions. Gemini paper-trading output is generated separately by the agent benchmark command.",
    "",
    "## Summary",
    "",
    `- Complete items: ${report.summary.itemsComplete}`,
    `- Missing-data items: ${report.summary.itemsMissingData}`,
    `- Budget: ${formatUsd(report.budgetUsd)}`
  ];

  if (report.summary.strongestTimingOpportunity) {
    lines.push(
      `- Strongest timing opportunity: ${report.summary.strongestTimingOpportunity.item} (${formatPct(
        report.summary.strongestTimingOpportunity.timingOpportunityPct
      )})`
    );
  }

  if (report.summary.highestLiquidity) {
    lines.push(
      `- Highest liquidity: ${report.summary.highestLiquidity.item} (${formatInt(
        report.summary.highestLiquidity.totalVolume
      )} observed volume)`
    );
  }

  lines.push(
    "",
    "## Item Benchmarks",
    "",
    "| Item | Status | Window Start | Avg Human Market | Best Hindsight | Worst Hindsight | Timing Opportunity | Volume | Liquidity |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
  );

  for (const item of report.items) {
    lines.push(
      [
        item.item,
        item.status,
        formatUsd(item.windowStart?.price),
        formatUsd(item.averageHumanMarket?.price),
        formatUsd(item.bestHistorical?.price),
        formatUsd(item.worstHistorical?.price),
        formatPct(item.timingOpportunityPct),
        formatInt(item.totalVolume),
        item.liquidityTier ?? "n/a"
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
    );
  }

  lines.push("", "## Terminal-Scale Sparklines", "");
  for (const item of report.items) {
    lines.push(`- ${item.item}: price \`${item.priceSparkline ?? "n/a"}\`, volume \`${item.volumeSparkline ?? "n/a"}\``);
  }

  const issues = report.items.flatMap((item) => item.issues?.map((issue) => `${item.item}: ${issue}`) ?? []);
  if (issues.length > 0) {
    lines.push("", "## Data Issues", "", ...issues.map((issue) => `- ${issue}`));
  }

  lines.push("", "## Caveats", "", ...report.caveats.map((caveat) => `- ${caveat}`), "");

  return `${lines.join("\n")}\n`;
}
