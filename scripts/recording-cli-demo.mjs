#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fast = process.argv.includes("--fast");
const still = process.argv.includes("--still");
const delay = fast ? 90 : 420;
const root = process.cwd();

const human = readJson("reports/human-benchmark.json");
const agent = readJson("reports/agent-benchmark.json");
const normalized = readJson("data/normalized/market-candles.json");
const top = [...human.items].sort((a, b) => b.timingOpportunityPct - a.timingOpportunityPct)[0];

const models = [
  { name: "gemini-3.1-pro-preview", status: "queued", action: "evaluate 6 cases", result: "pending" },
  { name: "gemini-3-pro-preview", status: "queued", action: "evaluate 6 cases", result: "pending" },
  { name: "gemini-3-flash-preview", status: "queued", action: "evaluate 6 cases", result: "pending" },
  { name: "gemini-2.5-pro", status: "queued", action: "evaluate 6 cases", result: "pending" },
  { name: "gemini-2.5-flash", status: "queued", action: "evaluate 6 cases", result: "pending" },
  {
    name: agent.model,
    status: "complete",
    action: "past-only decision",
    result: `${agent.summary.itemsComplete}/${agent.items.length} complete · skip on blocked evidence`
  }
];

await main();

async function main() {
  clear();
  await splash();
  await pipeline();
  await modelMatrix();
  await summary();
}

async function splash() {
  frame([
    title("DropScout model benchmark"),
    "",
    dim("DEMO VISUALIZATION - mocked parallel model run for recording"),
    dim("Real artifacts loaded from reports/*.json and data/normalized/*.json"),
    "",
    row("market window", `${dateOnly(top.window.start)} -> ${dateOnly(top.window.end)}`),
    row("basket", `${human.items.length} CS2 cases`),
    row("candles", `${normalized.candles.length} normalized daily candles`),
    row("timing ceiling", `${pct(top.timingOpportunityPct)} on ${top.item}`),
    "",
    command("dropscout agent-matrix --models all --paper --same-evidence")
  ]);
  await wait(delay * 3);
}

async function pipeline() {
  const steps = [
    ["fetch", "CS2Cap candles + Steam sanity", "done"],
    ["normalize", "common OHLCV schema", "done"],
    ["baseline", "human market + hindsight ceiling", "done"],
    ["agent matrix", "parallel model paper-trading", "running"],
    ["web snapshot", "recording-ready result page", "next"]
  ];

  for (let active = 0; active < steps.length; active += 1) {
    frame([
      title("Benchmark pipeline"),
      "",
      ...steps.map((step, index) =>
        `${index === active ? green("➜") : dim(" ")} ${badge(index <= active ? step[2] : "wait")} ${step[0].padEnd(13)} ${arrow()} ${step[1]}`
      ),
      "",
      dim("The model score is only meaningful because the market baseline exists first.")
    ]);
    await wait(delay);
  }
}

async function modelMatrix() {
  const states = ["queued", "context", "decide", "simulate", "score"];
  for (let tick = 0; tick < states.length; tick += 1) {
    frame([
      title("Running model matrix"),
      "",
      dim("Each model receives the same past-only evidence window."),
      "",
      ...models.map((model, index) => {
        const active = (tick + index) % states.length;
        const status = model.status === "complete" ? "complete" : states[Math.min(active, states.length - 1)];
        return modelLine(model.name, status, model.result);
      }),
      "",
      dim("No live trading. No future prices. Missing data stays visible.")
    ]);
    await wait(delay);
  }
}

async function summary() {
  frame([
    title("Result snapshot ready"),
    "",
    `${green("✓")} baseline: ${human.items.length} complete items · ${pct(top.timingOpportunityPct)} largest timing ceiling`,
    `${green("✓")} model harness: ${agent.model} · ${agent.summary.itemsComplete}/${agent.items.length} complete item`,
    `${yellow("!")} evidence gate: ${agent.summary.itemsMissingData} missing-data items kept explicit`,
    `${green("✓")} next: open http://localhost:3000 and show the leaderboard/result page`,
    "",
    command("npm run web:dev -- --hostname 127.0.0.1 --port 3000"),
    "",
    dim("Hold this frame for 2-3 seconds before switching to the website.")
  ]);
}

function modelLine(name, status, result) {
  const color =
    status === "complete" ? green :
    status === "score" ? green :
    status === "simulate" ? cyan :
    status === "decide" ? yellow :
    status === "context" ? cyan :
    dim;
  const label = status === "complete" ? "complete" : status.padEnd(8);
  const tail = result === "pending" ? dim("pending") : result;
  return `${color("➜")} ${name.padEnd(28)} ${arrow()} ${color(label)} ${dim("→")} ${tail}`;
}

function frame(lines) {
  clear();
  const width = 96;
  console.log(green("┌" + "─".repeat(width - 2) + "┐"));
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const padding = Math.max(0, width - 4 - stripped.length);
    console.log(`${green("│")} ${line}${" ".repeat(padding)} ${green("│")}`);
  }
  console.log(green("└" + "─".repeat(width - 2) + "┘"));
}

function title(value) {
  return `${green("●")} ${bold(value)}`;
}

function row(label, value) {
  return `${dim(label.padEnd(16))} ${arrow()} ${value}`;
}

function command(value) {
  return `${dim("$")} ${cyan(value)}`;
}

function badge(value) {
  if (value === "done" || value === "complete") return green(`[${value}]`.padEnd(12));
  if (value === "running") return cyan(`[${value}]`.padEnd(12));
  if (value === "next") return yellow(`[${value}]`.padEnd(12));
  return dim(`[${value}]`.padEnd(12));
}

function arrow() {
  return green("=>");
}

function clear() {
  if (!still) process.stdout.write("\x1b[2J\x1b[H");
}

function wait(ms) {
  return still ? Promise.resolve() : new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function pct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function dateOnly(value) {
  return String(value).slice(0, 10);
}

function bold(value) {
  return `\x1b[1m${value}\x1b[22m`;
}

function green(value) {
  return `\x1b[32m${value}\x1b[39m`;
}

function cyan(value) {
  return `\x1b[36m${value}\x1b[39m`;
}

function yellow(value) {
  return `\x1b[33m${value}\x1b[39m`;
}

function dim(value) {
  return `\x1b[2m${value}\x1b[22m`;
}

function stripAnsi(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/g, "");
}
