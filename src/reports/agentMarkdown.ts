import type { AgentBenchmarkReport } from "../agent/types.js";
import { formatInt, formatPct, formatUsd } from "../utils/format.js";

export function renderAgentMarkdownReport(report: AgentBenchmarkReport): string {
  const lines: string[] = [
    "# DropScout Gemini Agent Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    `Model: ${report.model}`,
    `Budget: ${formatUsd(report.budgetUsd)}`,
    `Context days: ${report.contextDays}`,
    `Fee: ${formatPct(report.feePct)}`,
    "",
    "## Summary",
    "",
    `- Complete items: ${report.summary.itemsComplete}`,
    `- Missing-data items: ${report.summary.itemsMissingData}`
  ];

  if (report.summary.bestAgentReturn) {
    lines.push(
      `- Best agent return: ${report.summary.bestAgentReturn.item} (${formatPct(
        report.summary.bestAgentReturn.returnPct
      )})`
    );
  }

  if (report.summary.strongestOutperformance) {
    lines.push(
      `- Strongest outperformance vs window-start hold: ${report.summary.strongestOutperformance.item} (${formatUsd(
        report.summary.strongestOutperformance.outperformanceUsd
      )})`
    );
  }

  lines.push(
    "",
    "## Item Results",
    "",
    "| Item | Status | Final Value | Return | Window-Start Hold | Trades |",
    "| --- | --- | ---: | ---: | ---: | ---: |"
  );

  for (const item of report.items) {
    lines.push(
      [
        item.item,
        item.status,
        formatUsd(item.finalPortfolioValue),
        formatPct(item.returnPct),
        formatUsd(item.baselineValues.windowStartHoldValue),
        formatInt(item.tradeCount)
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
    );
  }

  const issues = report.items.flatMap((item) => item.issues?.map((issue) => `${item.item}: ${issue}`) ?? []);
  if (issues.length > 0) {
    lines.push("", "## Data Issues", "", ...issues.map((issue) => `- ${issue}`));
  }

  lines.push("", "## Caveats", "", ...report.caveats.map((caveat) => `- ${caveat}`), "");
  return `${lines.join("\n")}\n`;
}

export function renderAgentTerminalReport(report: AgentBenchmarkReport): string {
  return [
    "",
    "DropScout Gemini agent benchmark",
    `Generated: ${report.generatedAt}`,
    `Model: ${report.model}`,
    `Budget: ${formatUsd(report.budgetUsd)} | Context days: ${report.contextDays} | Fee: ${formatPct(report.feePct)}`,
    "",
    table(
      ["Item", "Status", "Final", "Return", "Window hold", "Trades"],
      report.items.map((item) => [
        item.item,
        item.status,
        formatUsd(item.finalPortfolioValue),
        formatPct(item.returnPct),
        formatUsd(item.baselineValues.windowStartHoldValue),
        formatInt(item.tradeCount)
      ])
    ),
    "",
    "Paper trading only. No real market execution is performed.",
    ""
  ].join("\n");
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
