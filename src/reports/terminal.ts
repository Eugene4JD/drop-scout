import type { HumanBenchmarkReport, ItemBenchmark } from "../types.js";
import { formatInt, formatPct, formatUsd } from "../utils/format.js";

export function renderTerminalReport(report: HumanBenchmarkReport): string {
  const rows = report.items.map((item) => [
    item.item,
    item.status,
    formatUsd(item.windowStart?.price),
    formatUsd(item.averageHumanMarket?.price),
    formatUsd(item.bestHistorical?.price),
    formatPct(item.timingOpportunityPct),
    formatInt(item.totalVolume),
    item.liquidityTier ?? "n/a",
    item.priceSparkline ?? "n/a"
  ]);

  return [
    "",
    "DropScout human benchmark",
    `Generated: ${report.generatedAt}`,
    `Budget: ${formatUsd(report.budgetUsd)}`,
    "",
    table(
      [
        "Item",
        "Status",
        "Window start",
        "Avg human",
        "Best*",
        "Timing opp",
        "Volume",
        "Liquidity",
        "Price"
      ],
      rows
    ),
    "",
    "* Best price is hindsight-only. It is a benchmark, not a live decision.",
    ""
  ].join("\n");
}

export function renderIssueSummary(items: ItemBenchmark[]): string {
  const issues = items.flatMap((item) => item.issues?.map((issue) => `${item.item}: ${issue}`) ?? []);
  if (issues.length === 0) {
    return "";
  }

  return ["Data issues:", ...issues.map((issue) => `- ${issue}`)].join("\n");
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length))
  );

  const renderRow = (row: string[]) =>
    row.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ");

  return [
    renderRow(headers),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map(renderRow)
  ].join("\n");
}
