import type { AgentModelMatrixReport } from "../agent/types.js";
import { formatPct, formatUsd } from "../utils/format.js";

export function renderAgentMatrixMarkdownReport(report: AgentModelMatrixReport): string {
  const lines: string[] = [
    "# DropScout Gemini Model Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    `Budget: ${formatUsd(report.budgetUsd)}`,
    `Context days: ${report.contextDays}`,
    `Fee: ${formatPct(report.feePct)}`,
    `Max concurrency: ${report.maxConcurrency}`,
    "",
    "## Summary",
    "",
    `- Complete models: ${report.summary.modelsComplete}`,
    `- Failed models: ${report.summary.modelsFailed}`
  ];

  if (report.summary.bestModel) {
    lines.push(
      `- Best average return: ${report.summary.bestModel.model} (${formatPct(
        report.summary.bestModel.averageReturnPct
      )})`
    );
  }

  lines.push(
    "",
    "## Model Results",
    "",
    "| Model | Status | Avg Return | Best Item | Failed Reason |",
    "| --- | --- | ---: | --- | --- |"
  );

  for (const result of report.results) {
    const items = result.report?.items ?? [];
    const averageReturn =
      items.length > 0 ? items.reduce((sum, item) => sum + item.returnPct, 0) / items.length : undefined;
    const bestItem = [...items].sort((a, b) => b.returnPct - a.returnPct)[0];
    lines.push(
      [
        result.model,
        result.status,
        formatPct(averageReturn),
        bestItem ? `${bestItem.item} (${formatPct(bestItem.returnPct)})` : "n/a",
        result.error ?? ""
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
    );
  }

  lines.push("", "## Caveats", "", ...report.caveats.map((caveat) => `- ${caveat}`), "");
  return `${lines.join("\n")}\n`;
}

export function renderAgentMatrixTerminalReport(report: AgentModelMatrixReport): string {
  return [
    "",
    "DropScout Gemini model matrix",
    `Generated: ${report.generatedAt}`,
    `Budget: ${formatUsd(report.budgetUsd)} | Context days: ${report.contextDays} | Fee: ${formatPct(
      report.feePct
    )} | Max concurrency: ${report.maxConcurrency}`,
    "",
    table(
      ["Model", "Status", "Avg return", "Best item"],
      report.results.map((result) => {
        const items = result.report?.items ?? [];
        const averageReturn =
          items.length > 0 ? items.reduce((sum, item) => sum + item.returnPct, 0) / items.length : undefined;
        const bestItem = [...items].sort((a, b) => b.returnPct - a.returnPct)[0];
        return [
          result.model,
          result.status,
          formatPct(averageReturn),
          bestItem ? `${bestItem.item} (${formatPct(bestItem.returnPct)})` : result.error ? "failed" : "n/a"
        ];
      })
    ),
    "",
    "Paper trading only. Per-model JSON reports are embedded in the matrix report.",
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
