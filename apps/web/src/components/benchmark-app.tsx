"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, HumanIcon, VendorIcon } from "./icons";
import {
  formatPct,
  formatUsd,
  metricInfo,
  metricLabel,
  metricValue,
  sortModels,
  type Metric,
  type WebSnapshot,
  type WebSnapshotDecision,
  type WebSnapshotItem,
  type WebSnapshotModel
} from "../lib/snapshot";

type View = "home" | "running" | "results";

export function BenchmarkApp({ snapshot }: { snapshot: WebSnapshot }) {
  const [metric, setMetric] = useState<Metric>("savings");
  const [view, setView] = useState<View>("home");
  const [activeModel, setActiveModel] = useState<WebSnapshotModel | null>(null);
  const [commandModel, setCommandModel] = useState<WebSnapshotModel | null>(null);

  const runModel = (model: WebSnapshotModel) => {
    if (!model.generatedAt) {
      setCommandModel(model);
      return;
    }
    setActiveModel(model);
    setView("running");
  };

  return (
    <main className="app-shell">
      <Header snapshot={snapshot} />
      {view === "home" && (
        <>
          <MetricTabs snapshot={snapshot} metric={metric} onMetricChange={setMetric} />
          {metric === "matrix" ? (
            <MatrixView models={snapshot.models} />
          ) : (
            <RankedList snapshot={snapshot} metric={metric} onRun={runModel} />
          )}
          {commandModel ? <CommandPanel model={commandModel} onClose={() => setCommandModel(null)} /> : null}
        </>
      )}
      {view === "running" && activeModel ? (
        <Simulation snapshot={snapshot} model={activeModel} onDone={() => setView("results")} />
      ) : null}
      {view === "results" && activeModel ? (
        <Results snapshot={snapshot} model={activeModel} onBack={() => setView("home")} />
      ) : null}
    </main>
  );
}

function Header({ snapshot }: { snapshot: WebSnapshot }) {
  const demoNotice = snapshot.summary.caveats.find((caveat) => caveat.startsWith("RECORDING DEMO SNAPSHOT"));
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <span>
          <span>Trade</span>
          <span className="accent-text">Bench</span>
        </span>
      </div>
      {demoNotice ? <div className="demo-banner mono">{demoNotice}</div> : null}
    </header>
  );
}

function MetricTabs({
  snapshot,
  metric,
  onMetricChange
}: {
  snapshot: WebSnapshot;
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
}) {
  const doneCount = snapshot.models.filter((model) => model.generatedAt).length;
  const metrics: Metric[] = ["savings", "efficiency", "cost", "matrix"];

  return (
    <div className="tabs-row mono">
      <div className="tabs">
        {metrics.map((candidate) => (
          <button
            key={candidate}
            className={candidate === metric ? "tab active" : "tab"}
            type="button"
            onClick={() => onMetricChange(candidate)}
          >
            {metricLabel(candidate)}
          </button>
        ))}
      </div>
      <div className="metric-ref">
        <span>{metricInfo(snapshot, metric)}</span>
        <span className="muted-dot">·</span>
        <span>{doneCount} runs</span>
        <InfoIcon tip={metricTooltip(metric)} />
      </div>
    </div>
  );
}

function InfoIcon({ tip }: { tip: string }) {
  return (
    <span className="info-wrap">
      <span className="info-icon">i</span>
      <span className="tooltip">{tip}</span>
    </span>
  );
}

function RankedList({
  snapshot,
  metric,
  onRun
}: {
  snapshot: WebSnapshot;
  metric: Exclude<Metric, "matrix">;
  onRun: (model: WebSnapshotModel) => void;
}) {
  const sorted = sortModels(snapshot.models, metric).filter((model) => {
    const value = metricValue(model, metric);
    return model.rankable && value !== null;
  });
  const rankedValues = sorted
    .map((model) => metricValue(model, metric))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const showHuman = metric === "savings" || metric === "efficiency";
  const humanValue = 0;
  const span = Math.max(
    1,
    ...rankedValues.map((value) => Math.abs(value - humanValue)),
    snapshot.summary.maxSavingsPct ?? 0
  );
  const domainMin = showHuman ? humanValue - span * 1.08 : 0;
  const domainMax = showHuman ? humanValue + span * 1.08 : Math.max(1, ...rankedValues) * 1.08;
  const pctFor = (value: number) => ((value - domainMin) / (domainMax - domainMin)) * 100;
  const humanLinePct = showHuman ? pctFor(humanValue) : null;
  let rank = 0;

  return (
    <section className="ranked-list" aria-label={`${metricLabel(metric)} leaderboard`}>
      {showHuman ? <HumanRow humanLinePct={humanLinePct ?? 50} value={metric === "savings" ? "0.0%" : "0%"} /> : null}
      {sorted.map((model) => {
        const value = metricValue(model, metric);
        const ranked = model.rankable && value !== null;
        if (ranked) rank += 1;
        const valuePct = value === null ? null : pctFor(value);
        const barLeft = humanLinePct !== null && valuePct !== null ? Math.min(humanLinePct, valuePct) : 0;
        const barWidth = humanLinePct !== null && valuePct !== null ? Math.abs(valuePct - humanLinePct) : valuePct ?? 0;
        const sign = metric === "cost" || value === null ? 0 : Math.sign(value - humanValue);
        return (
          <ModelRow
            key={model.slug}
            model={model}
            metric={metric}
            rank={ranked ? rank : null}
            value={value}
            sign={sign}
            barLeft={barLeft}
            barWidth={barWidth}
            humanLinePct={humanLinePct}
            onRun={onRun}
          />
        );
      })}
      {sorted.length === 0 ? <NoRankableRows /> : null}
    </section>
  );
}

function HumanRow({ humanLinePct, value }: { humanLinePct: number; value: string }) {
  return (
    <div className="leader-row human-row mono">
      <span className="rank-cell">--</span>
      <div className="model-cell">
        <HumanIcon />
        <span>human market</span>
        <span className="baseline-tag">BASELINE</span>
      </div>
      <div className="bar-track split-track">
        <span className="negative-zone" style={{ width: `${humanLinePct}%` }} />
        <span className="positive-zone" style={{ left: `${humanLinePct}%`, width: `${100 - humanLinePct}%` }} />
        <span className="human-dot" style={{ left: `calc(${humanLinePct}% - 4px)` }} />
        <HumanBreakLine pct={humanLinePct} />
      </div>
      <span className="value-cell neutral">{value}</span>
    </div>
  );
}

function ModelRow({
  model,
  metric,
  rank,
  value,
  sign,
  barLeft,
  barWidth,
  humanLinePct,
  onRun
}: {
  model: WebSnapshotModel;
  metric: Exclude<Metric, "matrix">;
  rank: number | null;
  value: number | null;
  sign: number;
  barLeft: number;
  barWidth: number;
  humanLinePct: number | null;
  onRun: (model: WebSnapshotModel) => void;
}) {
  const better = sign > 0;
  const worse = sign < 0;
  const valueText = metric === "cost" ? formatUsd(value, 3) : formatPct(value, metric === "efficiency" ? 0 : 1);
  return (
    <button
      className={`leader-row row-button mono ${better ? "is-better" : ""} ${worse ? "is-worse" : ""} ${model.status}`}
      type="button"
      onClick={() => onRun(model)}
    >
      <span className="rank-cell">{rank === null ? ".." : String(rank).padStart(2, "0")}</span>
      <div className="model-cell">
        <VendorIcon vendor={model.vendor} />
        <span className="model-name">{model.slug}</span>
      </div>
      <div className="bar-track">
        {humanLinePct !== null ? (
          <>
            <span className="negative-zone" style={{ width: `${humanLinePct}%` }} />
            <span className="positive-zone" style={{ left: `${humanLinePct}%`, width: `${100 - humanLinePct}%` }} />
          </>
        ) : (
          <span className="plain-zone" />
        )}
        <span
          className={`metric-bar ${better ? "positive" : worse ? "negative" : "accent"}`}
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
        {humanLinePct !== null ? <HumanBreakLine pct={humanLinePct} /> : null}
      </div>
      <span className={`value-cell ${better ? "positive" : worse ? "negative" : "neutral"}`}>
        {metric !== "cost" && better ? <span className="value-arrow">▲</span> : null}
        {metric !== "cost" && worse ? <span className="value-arrow">▼</span> : null}
        {valueText}
      </span>
    </button>
  );
}

function NoRankableRows() {
  return (
    <div className="no-rankable mono">
      No completed full-basket model result exported yet.
    </div>
  );
}

function HumanBreakLine({ pct }: { pct: number }) {
  return <span className="human-break-line" style={{ left: `calc(${pct}% - 0.5px)` }} />;
}

function MatrixView({ models }: { models: WebSnapshotModel[] }) {
  const rankableCount = models.filter((model) => model.rankable).length;
  const points = models.filter(
    (model) => model.rankable && model.costUsd !== null && model.savingsPct !== null && model.costUsd > 0
  );

  if (points.length === 0) {
    return (
      <section className="empty-panel mono">
        <div className="empty-title">No cost matrix yet</div>
        <p>
          {rankableCount === 0
            ? "No completed full-basket model result is rankable yet. Run a real agent benchmark, then export the snapshot."
            : "Completed benchmark rows exist, but no run has public cost metadata. Re-run a model with --cost-usd, then export the snapshot."}
        </p>
      </section>
    );
  }

  const ranked = [...points].sort((a, b) => (b.savingsPct ?? 0) - (a.savingsPct ?? 0));
  const rankOf = new Map(ranked.map((model, index) => [model.slug, index + 1]));
  const width = 1000;
  const height = 420;
  const padL = 56;
  const padR = 28;
  const padT = 28;
  const padB = 48;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const costs = points.map((model) => model.costUsd!);
  const savings = points.map((model) => model.savingsPct!);
  const log = (value: number) => Math.log10(value);
  const xMin = Math.pow(10, Math.min(...costs.map(log)) - 0.16);
  const xMax = Math.pow(10, Math.max(...costs.map(log)) + 0.16);
  const yMin = Math.min(0, Math.floor(Math.min(...savings) / 5) * 5);
  const yMax = Math.max(5, Math.ceil(Math.max(...savings) / 5) * 5);
  const xFor = (value: number) => padL + ((log(value) - log(xMin)) / (log(xMax) - log(xMin))) * innerW;
  const yFor = (value: number) => padT + innerH - ((value - yMin) / (yMax - yMin)) * innerH;
  const xTicks = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5].filter(
    (value) => value >= xMin * 0.98 && value <= xMax * 1.02
  );
  const yTicks = niceTicks(yMin, yMax, 5);

  return (
    <section className="matrix-wrap">
      <svg className="matrix" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Savings versus cost value matrix">
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={padL} x2={width - padR} y1={yFor(tick)} y2={yFor(tick)} className="gridline" />
            <text x={padL - 8} y={yFor(tick) + 3.5} textAnchor="end" className="axis-label">
              {tick}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line y1={padT} y2={height - padB} x1={xFor(tick)} x2={xFor(tick)} className="gridline" />
            <text x={xFor(tick)} y={height - padB + 18} textAnchor="middle" className="axis-label">
              ${tick.toFixed(tick < 0.1 ? 3 : 2)}
            </text>
          </g>
        ))}
        <text x={width / 2} y={height - 8} textAnchor="middle" className="axis-title">
          TOTAL COST ($) · LOG SCALE
        </text>
        <text x={14} y={height / 2} textAnchor="middle" className="axis-title" transform={`rotate(-90 14 ${height / 2})`}>
          SAVINGS (%)
        </text>
        {points.map((model) => {
          const cx = xFor(model.costUsd!);
          const cy = yFor(model.savingsPct!);
          return (
            <g key={model.slug} className="matrix-point" transform={`translate(${cx} ${cy})`}>
              <foreignObject x="-12" y="-12" width="24" height="24">
                <VendorIcon vendor={model.vendor} size={22} />
              </foreignObject>
              <circle cx="12" cy="-12" r="8" className="rank-badge" />
              <text x="12" y="-9" textAnchor="middle" className="rank-badge-label">
                {rankOf.get(model.slug)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="matrix-legend">
        {ranked.map((model, index) => (
          <div key={model.slug} className="legend-row mono">
            <span>{index + 1}</span>
            <VendorIcon vendor={model.vendor} size={13} />
            <span>{model.slug}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommandPanel({ model, onClose }: { model: WebSnapshotModel; onClose: () => void }) {
  return (
    <aside className="command-panel mono">
      <div className="command-head">
        <span>{model.slug}</span>
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>
      <code>{model.runCommand}</code>
    </aside>
  );
}

function Simulation({
  snapshot,
  model,
  onDone
}: {
  snapshot: WebSnapshot;
  model: WebSnapshotModel;
  onDone: () => void;
}) {
  const maxDays = Math.max(1, ...snapshot.items.map((item) => item.candles.length));
  const [day, setDay] = useState(0);
  const doneRef = useRef(false);
  const buyDecisions = model.decisions.filter((decision) => decision.action === "buy");
  const visibleBuys = buyDecisions.filter((decision) => decision.dayIndex !== null && decision.dayIndex <= day);
  const spent = visibleBuys.reduce((total, decision) => total + (decision.price ?? 0), 0);
  const humanProgress = visibleBuys.reduce((total, decision) => {
    const item = snapshot.items.find((candidate) => candidate.id === decision.itemId);
    return total + (item?.humanMarketPrice ?? 0);
  }, 0);
  const liveDelta = humanProgress > 0 ? ((humanProgress - spent) / humanProgress) * 100 : null;

  useEffect(() => {
    const start = performance.now();
    const duration = 5200;
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - start) / duration);
      setDay(Math.min(maxDays - 1, Math.floor(progress * maxDays)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        window.setTimeout(onDone, 500);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [maxDays, onDone]);

  return (
    <section className="run-view">
      <RunKicker model={model} state="live" />
      <p className="run-sub mono">replaying exported benchmark decisions across the public candle window</p>
      <div className="stat-grid mono">
        <Stat label="day" value={`${String(Math.min(day + 1, maxDays)).padStart(2, "0")} / ${maxDays}`} />
        <Stat label="bought" value={`${visibleBuys.length} / ${snapshot.items.filter((item) => item.status === "complete").length}`} />
        <Stat label="spent" value={formatUsd(spent)} tone="accent" />
        <Stat label="vs human" value={formatPct(liveDelta)} tone={liveDelta !== null && liveDelta >= 0 ? "positive" : "negative"} />
      </div>
      <div className="timeline">
        <span style={{ width: `${((day + 1) / maxDays) * 100}%` }} />
      </div>
      <div className="timeline-labels mono">
        <span>{shortDate(snapshot.summary.window?.start ?? null)}</span>
        <span>{shortDate(snapshot.summary.window?.end ?? null)}</span>
      </div>
      <div className="live-grid">
        {snapshot.items.map((item) => (
          <LiveItem key={item.id} item={item} day={day} decision={model.decisions.find((decision) => decision.itemId === item.id)} />
        ))}
      </div>
    </section>
  );
}

function RunKicker({ model, state }: { model: WebSnapshotModel; state: "live" | "complete" | "incomplete" }) {
  return (
    <div className="run-kicker mono">
      <VendorIcon vendor={model.vendor} />
      <span>{model.slug}</span>
      <span className="muted-dot">·</span>
      <span className={`run-state ${state}`}>{state}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" | "positive" | "negative" }) {
  return (
    <div className="stat">
      <div>{label}</div>
      <strong className={tone ?? ""}>{value}</strong>
    </div>
  );
}

function LiveItem({ item, day, decision }: { item: WebSnapshotItem; day: number; decision: WebSnapshotDecision | undefined }) {
  const candleCount = item.candles.length;
  const visible = Math.min(day + 1, candleCount);
  const path = linePath(item.candles.slice(0, visible), 240, 56);
  const future = linePath(item.candles.slice(Math.max(0, visible - 1)), 240, 56, Math.max(0, visible - 1), candleCount);
  const currentPoint = pointForIndex(item.candles, Math.min(day, candleCount - 1), 240, 56);
  const decisionVisible = decision?.action === "buy" && decision.dayIndex !== null && decision.dayIndex <= day;
  const decisionPoint = decisionVisible ? pointForIndex(item.candles, decision.dayIndex!, 240, 56) : null;
  const price = decisionVisible ? decision?.price : item.candles[Math.min(day, candleCount - 1)]?.close ?? null;

  return (
    <article className={`live-item ${decisionVisible ? "bought" : ""}`}>
      <div className="live-head mono">
        <Swatch tone={item.tone} />
        <span>{item.name}</span>
        <strong>{formatUsd(price)}</strong>
      </div>
      <svg viewBox="0 0 240 56" preserveAspectRatio="none" className="mini-chart" aria-hidden="true">
        {future ? <path d={future} className="future-line" /> : null}
        {path ? <path d={path} className="past-line" /> : null}
        {currentPoint && !decisionVisible ? (
          <g>
            <circle cx={currentPoint.x} cy={currentPoint.y} r="7" className="ping" />
            <circle cx={currentPoint.x} cy={currentPoint.y} r="2.8" className="current-dot" />
          </g>
        ) : null}
        {decisionPoint ? <circle cx={decisionPoint.x} cy={decisionPoint.y} r="4.5" className="decision-dot" /> : null}
      </svg>
    </article>
  );
}

function Results({
  snapshot,
  model,
  onBack
}: {
  snapshot: WebSnapshot;
  model: WebSnapshotModel;
  onBack: () => void;
}) {
  const savings = model.savingsPct;
  const beat = savings !== null && savings >= 0;
  const complete = model.status === "complete";
  const rows = snapshot.items
    .filter((item) => item.status === "complete")
    .map((item) => ({
      item,
      decision: model.decisions.find((decision) => decision.itemId === item.id)
    }));

  return (
    <section className="results-view">
      <button className="back-button mono" type="button" onClick={onBack}>
        back to leaderboard
      </button>
      <RunKicker model={model} state={complete ? "complete" : "incomplete"} />
      <h1>
        {complete ? (
          <>
            {beat ? "Beat" : "Underperformed"} the market by <span className={beat ? "positive" : "negative"}>{formatPct(Math.abs(savings ?? 0))}</span>
          </>
        ) : (
          <>Run incomplete</>
        )}
      </h1>
      <p className="result-copy mono">
        {complete
          ? `spent ${formatUsd(model.totalSpend)} · human ${formatUsd(snapshot.summary.humanTotal)} · captured ${formatPct(model.efficiencyPct, 0)} of hindsight savings`
          : "No rank is assigned because this exported run did not buy every complete benchmark item."}
      </p>
      <ResultStats snapshot={snapshot} model={model} />
      {model.issues.length > 0 ? (
        <div className="issue-strip mono">
          {model.issues.slice(0, 4).map((issue) => (
            <span key={issue}>{issue}</span>
          ))}
        </div>
      ) : null}
      <div className="result-table mono">
        <div className="result-row result-head">
          <span>#</span>
          <span>item</span>
          <span>human</span>
          <span>best</span>
          <span>model</span>
          <span>delta</span>
        </div>
        {rows.map(({ item, decision }, index) => (
          <div className="result-row" key={item.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span className="table-item">
              <Swatch tone={item.tone} />
              <span>{item.name}</span>
              <small>{decision?.dayIndex !== null && decision?.dayIndex !== undefined ? `day ${decision.dayIndex + 1}` : "no buy"}</small>
            </span>
            <span>{formatUsd(item.humanMarketPrice)}</span>
            <span>{formatUsd(item.bestHistoricalPrice)}</span>
            <span className={decision?.price !== null && decision?.price !== undefined ? "strong" : ""}>{formatUsd(decision?.price ?? null)}</span>
            <span className={(decision?.deltaPct ?? 0) >= 0 ? "positive" : "negative"}>{formatPct(decision?.deltaPct ?? null)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultStats({ snapshot, model }: { snapshot: WebSnapshot; model: WebSnapshotModel }) {
  const cards = [
    { label: "PERFECT HINDSIGHT", value: formatUsd(snapshot.summary.perfectHindsightTotal), sub: "oracle floor", tone: "muted" },
    {
      label: "MODEL",
      value: formatUsd(model.totalSpend),
      sub: model.savingsPct === null ? "unranked" : `${formatPct(model.savingsPct)} vs human`,
      tone: model.status === "complete" && (model.savingsPct ?? 0) >= 0 ? "positive" : "negative"
    },
    { label: "HUMAN MARKET", value: formatUsd(snapshot.summary.humanTotal), sub: "baseline", tone: "muted" }
  ];

  return (
    <div className="result-stats">
      {cards.map((card) => (
        <div key={card.label} className={`result-stat mono ${card.tone}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.sub}</small>
        </div>
      ))}
    </div>
  );
}

function Swatch({ tone }: { tone: string }) {
  return <span className="swatch" style={{ background: `linear-gradient(135deg, ${tone}, ${tone}aa)` }} />;
}

function metricTooltip(metric: Metric): string {
  if (metric === "savings") return "Percent saved versus aggregate human market VWAP across complete items.";
  if (metric === "efficiency") return "Share of hindsight-only timing opportunity captured by the model.";
  if (metric === "cost") return "Public cost metadata supplied at export time. Missing cost is not inferred.";
  return "Scatter plot of savings and cost. Empty when no completed run has cost metadata.";
}

function shortDate(value: string | null): string {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(new Date(value)).toUpperCase();
}

function linePath(
  candles: WebSnapshotItem["candles"],
  width: number,
  height: number,
  startIndex = 0,
  totalCount = candles.length
): string {
  if (candles.length === 0) return "";
  const values = candles.map((candle) => candle.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const total = Math.max(1, totalCount - 1);
  return candles
    .map((candle, index) => {
      const x = ((startIndex + index) / total) * width;
      const y = height - 6 - ((candle.close - min) / range) * (height - 12);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function pointForIndex(candles: WebSnapshotItem["candles"], index: number, width: number, height: number): { x: number; y: number } | null {
  if (candles.length === 0 || index < 0 || index >= candles.length) return null;
  const values = candles.map((candle) => candle.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return {
    x: (index / Math.max(1, candles.length - 1)) * width,
    y: height - 6 - ((candles[index].close - min) / range) * (height - 12)
  };
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm < 1.5 ? mag : norm < 3 ? 2 * mag : norm < 7 ? 5 * mag : 10 * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step * 0.5; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return ticks;
}
