#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "media/drop-scout-demo");
const buildDir = mkdtempSync(join(tmpdir(), "dropscout-static-video-"));
const width = 1920;
const height = 1080;
const fps = 30;

mkdirSync(outDir, { recursive: true });

const human = readJson("reports/human-benchmark.json");
const agent = readJson("reports/agent-benchmark.json");
const normalized = readJson("data/normalized/market-candles.json");

const sorted = [...human.items].sort((a, b) => b.timingOpportunityPct - a.timingOpportunityPct);
const topItem = sorted[0];
const mostLiquid = [...human.items].sort((a, b) => b.totalVolume - a.totalVolume)[0];
const agentComplete = agent.items.filter((item) => item.status === "complete").length;
const agentMissing = agent.items.length - agentComplete;
const issueCount = normalized.issues?.length ?? 0;
const completeAgent = agent.items.find((item) => item.status === "complete") ?? agent.items[0];
const firstTrade = completeAgent.trades?.[0];

const scenes = [
  {
    id: "01-why",
    duration: 8,
    subtitle:
      "In the era of AI, confident recommendations are cheap. Benchmarks are how we prove whether a model can actually trade.",
    svg: renderWhyScene()
  },
  {
    id: "02-built",
    duration: 9,
    subtitle:
      "DropScout turns CS2 market data into a controlled paper-trading exam: fetch, normalize, baseline, model decision, simulated P and L, report.",
    svg: renderBuiltScene()
  },
  {
    id: "03-baseline",
    duration: 9,
    subtitle:
      `The benchmark first builds the yardstick: ${human.items.length} cases, ${normalized.candles.length} candles, and a ${pct(topItem.timingOpportunityPct)} timing ceiling on ${topItem.item}.`,
    svg: renderBaselineScene()
  },
  {
    id: "04-model",
    duration: 9,
    subtitle:
      `Then the model is tested with past-only evidence. This run used ${agent.model}; blocked evidence produced a skip, not a fake trade.`,
    svg: renderModelScene()
  },
  {
    id: "05-takeaway",
    duration: 8,
    subtitle:
      "What we built is the scoring layer for AI trading agents: same evidence, clear baselines, simulated portfolio value, visible data blockers.",
    svg: renderTakeawayScene()
  }
];

const subtitlesPath = resolve(outDir, "drop-scout-benchmark-demo.srt");
writeFileSync(subtitlesPath, renderSrt(scenes));

const sceneVideoListPath = resolve(buildDir, "scene-videos.txt");
const sceneVideoPaths = [];

for (const scene of scenes) {
  const svgPath = resolve(buildDir, `${scene.id}.svg`);
  const pngPath = resolve(buildDir, `${scene.id}.png`);
  const mp4Path = resolve(buildDir, `${scene.id}.mp4`);
  writeFileSync(svgPath, scene.svg);
  run("sips", ["-s", "format", "png", svgPath, "--out", pngPath], { quiet: true });
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-loop",
    "1",
    "-t",
    String(scene.duration),
    "-i",
    pngPath,
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    "-r",
    String(fps),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    mp4Path
  ]);
  sceneVideoPaths.push(mp4Path);
}

writeFileSync(sceneVideoListPath, sceneVideoPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"));

const visualsPath = resolve(buildDir, "visuals.mp4");
run("ffmpeg", [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  sceneVideoListPath,
  "-c",
  "copy",
  visualsPath
]);

const duration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
const audioPath = resolve(buildDir, "music.m4a");
run("ffmpeg", [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=98:duration=${duration}:sample_rate=48000`,
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=146.83:duration=${duration}:sample_rate=48000`,
  "-filter_complex",
  `[0:a]volume=0.026[a0];[1:a]volume=0.016[a1];[a0][a1]amix=inputs=2:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(duration - 2, 0)}:d=2,lowpass=f=1200,highpass=f=70[a]`,
  "-map",
  "[a]",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  audioPath
]);

const finalPath = resolve(outDir, "drop-scout-benchmark-demo.mp4");
run("ffmpeg", [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  visualsPath,
  "-i",
  audioPath,
  "-i",
  subtitlesPath,
  "-map",
  "0:v:0",
  "-map",
  "1:a:0",
  "-map",
  "2:s:0",
  "-c:v",
  "copy",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-c:s",
  "mov_text",
  "-metadata:s:s:0",
  "language=eng",
  "-shortest",
  finalPath
]);

console.log(`Rendered ${finalPath}`);
console.log(`Subtitles ${subtitlesPath}`);

function renderWhyScene() {
  return page({
    eyebrow: "WHY THIS EXISTS",
    title: "AI trading needs exams, not demos.",
    body: "A model can sound decisive while hallucinating evidence, using future data, or ignoring missing provider history.",
    subtitle: scenesText(
      "In the era of AI, confident recommendations are cheap. Benchmarks are how we prove whether a model can actually trade."
    ),
    content: `
      ${bigNumber(130, 420, "claim", "model says buy")}
      ${arrow(545, 500, 720)}
      ${bigNumber(760, 420, "test", "same evidence")}
      ${arrow(1175, 500, 1350)}
      ${bigNumber(1390, 420, "score", "portfolio value")}
      ${bottomRule("The point is not to make the agent look smart. The point is to measure if it is.")}
    `
  });
}

function renderBuiltScene() {
  const steps = [
    ["fetch", "CS2Cap + Steam"],
    ["normalize", "OHLCV candles"],
    ["baseline", "market yardstick"],
    ["model", "past-only decision"],
    ["simulate", "paper P and L"],
    ["report", "receipts"]
  ];
  return page({
    eyebrow: "WHAT WE BUILT",
    title: "DropScout is a controlled paper-trading benchmark.",
    body: "It converts market data and model decisions into a reproducible score, with blockers kept visible.",
    subtitle: scenesText(
      "DropScout turns CS2 market data into a controlled paper-trading exam: fetch, normalize, baseline, model decision, simulated P and L, report."
    ),
    content: `
      <g transform="translate(115 405)">
        ${steps
          .map((step, index) => {
            const x = index * 292;
            return `
              <rect x="${x}" y="0" width="230" height="170" rx="18" fill="#091016" stroke="#26323f" stroke-width="2"/>
              ${text(step[0], x + 24, 60, 32, "#f6fbff", 800)}
              ${text(step[1], x + 24, 112, 22, "#8ea2b5", 600)}
              ${index < steps.length - 1 ? `<line x1="${x + 230}" y1="85" x2="${x + 292}" y2="85" stroke="#32d583" stroke-width="5"/>` : ""}
            `;
          })
          .join("")}
      </g>
      ${bottomRule("This is the scoring layer for comparing models, not live marketplace execution.")}
    `
  });
}

function renderBaselineScene() {
  return page({
    eyebrow: "THE YARDSTICK",
    title: "Before scoring the model, build the market baseline.",
    body: "The benchmark shows the opportunity the model could try to capture, while labeling hindsight as hindsight.",
    subtitle: scenesText(
      `The benchmark first builds the yardstick: ${human.items.length} cases, ${normalized.candles.length} candles, and a ${pct(topItem.timingOpportunityPct)} timing ceiling on ${topItem.item}.`
    ),
    content: `
      ${metricCard(130, 410, String(human.items.length), "CS2 cases")}
      ${metricCard(455, 410, String(normalized.candles.length), "daily candles")}
      ${metricCard(780, 410, pct(topItem.timingOpportunityPct), "largest timing ceiling")}
      ${metricCard(1105, 410, formatVolume(mostLiquid.totalVolume), "highest volume")}
      ${metricCard(1430, 410, String(issueCount), "visible data issues")}
      ${bottomRule("Baseline first prevents the model score from becoming storytelling theater.")}
    `
  });
}

function renderModelScene() {
  return page({
    eyebrow: "MODEL CAPABILITY TEST",
    title: "The model only earns credit through walk-forward paper trades.",
    body: "It sees past context, emits a structured decision, and the simulator turns that decision into portfolio value.",
    subtitle: scenesText(
      `Then the model is tested with past-only evidence. This run used ${agent.model}; blocked evidence produced a skip, not a fake trade.`
    ),
    content: `
      ${metricCard(130, 405, agent.model, "model")}
      ${metricCard(560, 405, `${agentComplete}/${agent.items.length}`, "complete items")}
      ${metricCard(885, 405, String(agentMissing), "missing-data items")}
      ${metricCard(1210, 405, firstTrade?.action ?? "n/a", "evidence-gated decision")}
      ${bottomRule(`Current run: ${completeAgent.item} ended at ${money(completeAgent.finalPortfolioValue)}; risk flag ${firstTrade?.riskFlags?.[0] ?? "n/a"}.`)}
    `
  });
}

function renderTakeawayScene() {
  return page({
    eyebrow: "AUDIENCE TAKEAWAY",
    title: "We built the benchmark layer AI trading needs.",
    body: "Same evidence. Clear baselines. Paper-trading score. Visible blockers. A way to compare models honestly.",
    subtitle: scenesText(
      "What we built is the scoring layer for AI trading agents: same evidence, clear baselines, simulated portfolio value, visible data blockers."
    ),
    content: `
      ${checkLine(150, 425, "Why needed", "AI makes claims cheap; benchmarks make claims testable.")}
      ${checkLine(150, 520, "What we built", "A local CLI pipeline plus visualization for model trading evaluation.")}
      ${checkLine(150, 615, "What it proves", "Whether a model can beat baselines without future leakage or hidden data gaps.")}
      ${bottomRule("DropScout: benchmark the market, run the model, score the trade, show the evidence.")}
    `
  });
}

function page({ eyebrow, title, body, subtitle, content }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#05070a"/>
      <stop offset="1" stop-color="#10130f"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="28" fill="none" stroke="#1d2a36" stroke-width="2"/>
  <rect x="130" y="92" width="16" height="16" fill="#32d583"/>
  ${text(eyebrow, 162, 109, 24, "#8ea2b5", 800, 4)}
  ${headline(title, 130, 225, 86)}
  ${wrapSvgText(body, 132, 350, 1280, 42, "#d8fff1", 34, 2)}
  ${content}
  <rect x="110" y="850" width="1700" height="145" rx="26" fill="#020407" stroke="#26323f" stroke-width="2"/>
  ${wrapSvgText(subtitle, 150, 910, 1600, 46, "#f6fbff", 39, 2)}
</svg>`;
}

function headline(value, x, y, size) {
  return wrapSvgText(value, x, y, 1450, size * 0.95, "#f6fbff", size, 2, 800);
}

function text(value, x, y, size, fill = "#eef6ff", weight = 500, spacing = 0) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Helvetica Neue, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${escapeXml(value)}</text>`;
}

function metricCard(x, y, value, label) {
  const valueSize = String(value).length > 18 ? 30 : String(value).length > 10 ? 42 : 62;
  return `<g>
    <rect x="${x}" y="${y}" width="280" height="190" rx="20" fill="#091016" stroke="#26323f" stroke-width="2"/>
    ${text(value, x + 28, y + 78, valueSize, "#32d583", 800)}
    ${wrapSvgText(label, x + 28, y + 126, 220, 28, "#d8fff1", 24, 2, 700)}
  </g>`;
}

function bigNumber(x, y, value, label) {
  return `<g>
    <rect x="${x}" y="${y}" width="360" height="170" rx="22" fill="#091016" stroke="#26323f" stroke-width="2"/>
    ${text(value, x + 34, y + 72, 48, "#32d583", 800)}
    ${wrapSvgText(label, x + 34, y + 118, 270, 32, "#d8fff1", 28, 2, 700)}
  </g>`;
}

function checkLine(x, y, label, body) {
  return `<g>
    <circle cx="${x + 28}" cy="${y - 5}" r="26" fill="#32d583" opacity="0.18" stroke="#32d583" stroke-width="2"/>
    <path d="M${x + 16} ${y - 5} l9 10 l18 -23" fill="none" stroke="#32d583" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(label, x + 78, y, 36, "#32d583", 800)}
    ${text(body, x + 350, y, 32, "#f6fbff", 700)}
  </g>`;
}

function arrow(x1, y, x2) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#32d583" stroke-width="5" stroke-linecap="round"/>
    <path d="M ${x2} ${y} l -18 -12 v 24 z" fill="#32d583"/>`;
}

function bottomRule(value) {
  return `<rect x="130" y="735" width="1660" height="64" rx="20" fill="#05070a" stroke="#26323f" stroke-width="2"/>
    ${wrapSvgText(value, 165, 776, 1585, 34, "#d8fff1", 28, 1, 700)}`;
}

function scenesText(value) {
  return value;
}

function wrapSvgText(value, x, y, maxWidth, lineHeight, fill, size, maxLines = 3, weight = 500) {
  const maxChars = Math.max(18, Math.floor(maxWidth / (size * 0.52)));
  return wrapText(value, maxChars, maxLines)
    .map((line, index) => text(line, x, y + index * lineHeight, size, fill, weight))
    .join("");
}

function renderSrt(sceneList) {
  let cursor = 0;
  return sceneList
    .map((scene, index) => {
      const start = cursor;
      const end = cursor + scene.duration;
      cursor = end;
      return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${scene.subtitle}\n`;
    })
    .join("\n");
}

function srtTime(seconds) {
  const whole = Math.floor(seconds);
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)},000`;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} failed with status ${result.status}${output ? `\n${output}` : ""}`);
  }
}

function wrapText(value, maxChars, maxLines) {
  const words = String(value ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function money(value) {
  return `USD ${Number(value).toFixed(2)}`;
}

function pct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function formatVolume(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return String(value);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pad(value) {
  return String(value).padStart(2, "0");
}
