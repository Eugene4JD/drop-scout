"use client";

import { useState } from "react";
import { BrandMark, HumanIcon, VendorIcon } from "./icons";
import {
  formatInt,
  formatPct,
  formatUsd,
  itemTicker,
  windowStartHoldAverageReturn,
  type BenchmarkVisualizationData,
  type CompletedModelResult,
  type PartialModelResult,
  type ProjectionResult,
  type VisualView
} from "../lib/visualization";

export function VisualizationApp({ data }: { data: BenchmarkVisualizationData }) {
  const [view, setView] = useState<VisualView>("leaderboard");
  const [activeModel, setActiveModel] = useState(data.completedLeaderboard[0]?.model ?? "");

  return (
    <main className="app-shell">
      <Header />
      <VisualTabs data={data} view={view} onViewChange={setView} />
      {view === "leaderboard" ? <LeaderboardView data={data} /> : null}
      {view === "items" ? <ItemsView data={data} activeModel={activeModel} onActiveModelChange={setActiveModel} /> : null}
      {view === "evidence" ? <EvidenceView data={data} /> : null}
      {view === "matrix" ? <CoverageMatrix data={data} /> : null}
      <Caveats data={data} />
    </main>
  );
}

function Header() {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <span>
          <span>Trade</span>
          <span className="accent-text">Bench</span>
        </span>
      </div>
    </header>
  );
}

function VisualTabs({
  data,
  view,
  onViewChange
}: {
  data: BenchmarkVisualizationData;
  view: VisualView;
  onViewChange: (view: VisualView) => void;
}) {
  const views: Array<[VisualView, string]> = [
    ["leaderboard", "Savings"],
    ["items", "Items"],
    ["evidence", "Evidence"],
    ["matrix", "Matrix"]
  ];

  return (
    <div className="tabs-row mono">
      <div className="tabs">
        {views.map(([candidate, label]) => (
          <button key={candidate} className={candidate === view ? "tab active" : "tab"} type="button" onClick={() => onViewChange(candidate)}>
            {label}
          </button>
        ))}
      </div>
      <div className="metric-ref">
        <span>vs window-start hold</span>
        <span className="muted-dot">·</span>
        <span>{data.completedLeaderboard.length} measured models</span>
        <span className="muted-dot">·</span>
        <span>{data.setup.itemsCount} items</span>
      </div>
    </div>
  );
}

function LeaderboardView({ data }: { data: BenchmarkVisualizationData }) {
  const ranked = [...data.completedLeaderboard].sort((a, b) => b.averageReturnPct - a.averageReturnPct);
  const holdReturn = windowStartHoldAverageReturn(ranked[0]);
  const values = [0, holdReturn ?? 0, ...ranked.map((model) => model.averageReturnPct)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pctFor = (value: number) => ((value - min) / span) * 100;
  const zeroPct = pctFor(0);

  return (
    <section className="visual-section" aria-label="Measured leaderboard">
      {holdReturn !== null ? <BaselineRow label="window-start hold" value={holdReturn} zeroPct={zeroPct} pctFor={pctFor} /> : null}
      {ranked.map((model, index) => (
        <MeasuredRow key={model.model} model={model} rank={index + 1} zeroPct={zeroPct} pctFor={pctFor} />
      ))}
      <ProjectionStrip projection={data.projections[0]} />
    </section>
  );
}

function BaselineRow({
  label,
  value,
  zeroPct,
  pctFor
}: {
  label: string;
  value: number;
  zeroPct: number;
  pctFor: (value: number) => number;
}) {
  const valuePct = pctFor(value);
  const left = Math.min(zeroPct, valuePct);
  const width = Math.abs(valuePct - zeroPct);
  return (
    <div className="leader-row visual-row human-row mono">
      <span className="rank-cell">--</span>
      <div className="model-cell">
        <HumanIcon />
        <span>{label}</span>
        <span className="baseline-tag">BASELINE</span>
      </div>
      <ReturnBar zeroPct={zeroPct} left={left} width={width} tone={value >= 0 ? "positive" : "negative"} />
      <span className={`value-cell ${value >= 0 ? "positive" : "negative"}`}>{formatPct(value)}</span>
    </div>
  );
}

function MeasuredRow({
  model,
  rank,
  zeroPct,
  pctFor
}: {
  model: CompletedModelResult;
  rank: number;
  zeroPct: number;
  pctFor: (value: number) => number;
}) {
  const valuePct = pctFor(model.averageReturnPct);
  const left = Math.min(zeroPct, valuePct);
  const width = Math.abs(valuePct - zeroPct);
  return (
    <div className="leader-row visual-row mono">
      <span className="rank-cell">{String(rank).padStart(2, "0")}</span>
      <div className="model-cell">
        <VendorIcon vendor="google" />
        <span className="model-name">{model.model}</span>
        <span className="baseline-tag">MEASURED</span>
      </div>
      <ReturnBar zeroPct={zeroPct} left={left} width={width} tone={model.averageReturnPct >= 0 ? "positive" : "negative"} />
      <span className={`value-cell ${model.averageReturnPct >= 0 ? "positive" : "negative"}`}>{formatPct(model.averageReturnPct)}</span>
      <span className="visual-row-meta">
        +{formatUsd(model.averageDeltaVsWindowStartHoldUsd)} vs hold · {model.coverage.executedDecisions}/{model.coverage.requiredDecisions} decisions
      </span>
    </div>
  );
}

function ReturnBar({ zeroPct, left, width, tone }: { zeroPct: number; left: number; width: number; tone: "positive" | "negative" }) {
  return (
    <div className="bar-track visual-track">
      <span className="negative-zone" style={{ width: `${zeroPct}%` }} />
      <span className="positive-zone" style={{ left: `${zeroPct}%`, width: `${100 - zeroPct}%` }} />
      <span className={`metric-bar ${tone}`} style={{ left: `${left}%`, width: `${width}%` }} />
      <span className="human-break-line" style={{ left: `calc(${zeroPct}% - 0.5px)` }} />
    </div>
  );
}

function ProjectionStrip({ projection }: { projection: ProjectionResult | undefined }) {
  if (!projection) return null;
  return (
    <aside className="leader-row visual-row projection-row mono">
      <span className="rank-cell">..</span>
      <div className="model-cell">
        <VendorIcon vendor="google" size={14} />
        <span className="model-name">{projection.model}</span>
        <span className="baseline-tag projected-tag">PROJECTED</span>
      </div>
      <div className="projection-range" aria-hidden="true">
        <span />
      </div>
      <span className="value-cell neutral">{formatPct(projection.projectedAverageReturnPct.low, 0)}..{formatPct(projection.projectedAverageReturnPct.high, 0)}</span>
      <span className="visual-row-meta">not scored · {formatPct(projection.coverage.percent, 2)} coverage · {projection.confidence} confidence</span>
    </aside>
  );
}

function ItemsView({
  data,
  activeModel,
  onActiveModelChange
}: {
  data: BenchmarkVisualizationData;
  activeModel: string;
  onActiveModelChange: (model: string) => void;
}) {
  const model = data.completedLeaderboard.find((candidate) => candidate.model === activeModel) ?? data.completedLeaderboard[0];
  return (
    <section className="visual-section" aria-label="Per item results">
      <div className="model-switch mono">
        {data.completedLeaderboard.map((candidate) => (
          <button
            key={candidate.model}
            className={candidate.model === model.model ? "active" : ""}
            type="button"
            onClick={() => onActiveModelChange(candidate.model)}
          >
            {candidate.model}
          </button>
        ))}
      </div>
      <div className="item-grid">
        {model.items.map((item) => {
          const baseline = data.humanMarketBaseline.items.find((candidate) => candidate.item === item.item);
          return (
            <article key={item.item} className="item-card mono">
              <div className="item-card-head">
                <span className="swatch" style={{ background: swatchFor(item.item) }} />
                <strong>{itemTicker(item.item)}</strong>
                <span>{item.item}</span>
              </div>
              <div className="item-metrics">
                <span>model</span>
                <strong className={item.returnPct >= 0 ? "positive" : "negative"}>{formatPct(item.returnPct)}</strong>
                <span>vs hold</span>
                <strong className="positive">+{formatUsd(item.deltaVsWindowStartHoldUsd)}</strong>
                <span>human avg</span>
                <strong>{formatUsd(baseline?.averageHumanMarketPriceUsd)}</strong>
                <span>opportunity</span>
                <strong>{formatPct(baseline?.timingOpportunityPct)}</strong>
              </div>
            </article>
          );
        })}
      </div>
      <BaselineTable data={data} />
    </section>
  );
}

function BaselineTable({ data }: { data: BenchmarkVisualizationData }) {
  return (
    <div className="baseline-table mono">
      <div className="baseline-table-head">human-market baseline</div>
      {data.humanMarketBaseline.items.map((item) => (
        <div key={item.item} className="baseline-table-row">
          <span>{itemTicker(item.item)}</span>
          <span>{item.item}</span>
          <span>start {formatUsd(item.windowStartPriceUsd)}</span>
          <span>avg {formatUsd(item.averageHumanMarketPriceUsd)}</span>
          <span>best {formatUsd(item.bestHindsightCloseUsd)}</span>
          <span>{formatInt(item.totalVolume)} vol</span>
        </div>
      ))}
    </div>
  );
}

function EvidenceView({ data }: { data: BenchmarkVisualizationData }) {
  return (
    <section className="visual-section evidence-layout" aria-label="Partial and projected evidence">
      <div className="partial-list">
        {data.partialAndProEvidence.map((model) => (
          <PartialCard key={model.model} model={model} />
        ))}
      </div>
      <div className="rules-panel mono">
        <div className="empty-title">display rules</div>
        {data.displayRules.map((rule) => (
          <p key={rule}>{rule}</p>
        ))}
        <div className="source-list">
          {Object.entries(data.sourceReports).map(([label, path]) => (
            <span key={label}>{`${label}: ${path}`}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PartialCard({ model }: { model: PartialModelResult }) {
  return (
    <article className="partial-card mono">
      <div className="partial-head">
        <VendorIcon vendor="google" size={14} />
        <strong>{model.model}</strong>
        <span>PARTIAL · NOT SCORED</span>
      </div>
      <div className="coverage-track">
        <span style={{ width: `${Math.max(0, Math.min(100, model.coverage.percent))}%` }} />
      </div>
      <div className="partial-meta">
        <span>{formatPct(model.coverage.percent, 2)} coverage</span>
        <span>{model.coverage.executedDecisions}/{model.coverage.requiredDecisions} decisions</span>
        <span>{formatPct(model.averageReturnPctOnCoveredItems)} covered return</span>
      </div>
      <div className="partial-items">
        {model.items.map((item) => (
          <span key={item.item} className={item.status}>
            {itemTicker(item.item)} {item.decisions.executed}/{item.decisions.required}
          </span>
        ))}
      </div>
    </article>
  );
}

function CoverageMatrix({ data }: { data: BenchmarkVisualizationData }) {
  const measured = data.completedLeaderboard.map((model) => ({
    model: model.model,
    type: "measured",
    x: model.averageReturnPct,
    y: model.coverage.percent,
    label: formatPct(model.averageReturnPct),
    coverage: model.coverage.percent
  }));
  const partial = data.partialAndProEvidence.map((model) => ({
    model: model.model,
    type: "partial",
    x: model.averageReturnPctOnCoveredItems,
    y: model.coverage.percent,
    label: formatPct(model.averageReturnPctOnCoveredItems),
    coverage: model.coverage.percent
  }));
  const projected = data.projections.map((model) => ({
    model: model.model,
    type: "projected",
    x: model.projectedAverageReturnPct.base,
    y: model.coverage.percent,
    label: `${formatPct(model.projectedAverageReturnPct.low, 0)}..${formatPct(model.projectedAverageReturnPct.high, 0)}`,
    coverage: model.coverage.percent
  }));
  const points = [...measured, ...partial, ...projected];
  const minX = Math.min(-10, ...points.map((point) => point.x));
  const maxX = Math.max(2, ...points.map((point) => point.x));
  const xSpan = Math.max(1, maxX - minX);
  const xFor = (value: number) => ((value - minX) / xSpan) * 100;
  const yFor = (value: number) => 100 - value;

  return (
    <section className="coverage-matrix mono" aria-label="Coverage matrix">
      <div className="matrix-plane">
        <span className="matrix-axis y">coverage</span>
        <span className="matrix-axis x">average return</span>
        {points.map((point) => (
          <div
            key={`${point.type}-${point.model}`}
            className={`matrix-dot ${point.type}`}
            style={{ left: `${xFor(point.x)}%`, top: `${yFor(point.y)}%` }}
            title={`${point.model}: ${point.label}, ${formatPct(point.coverage)} coverage`}
          >
            <VendorIcon vendor="google" size={18} />
          </div>
        ))}
      </div>
      <div className="matrix-legend">
        {points.map((point) => (
          <div key={`${point.type}-legend-${point.model}`} className="legend-row mono">
            <span className={point.type}>{point.type}</span>
            <VendorIcon vendor="google" size={13} />
            <span>{point.model}</span>
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Caveats({ data }: { data: BenchmarkVisualizationData }) {
  const visibleCaveats = data.caveats.filter((caveat) => !caveat.startsWith("RECORDING NOTE:"));
  return (
    <footer className="caveats mono">
      {visibleCaveats.map((caveat) => (
        <span key={caveat}>{caveat}</span>
      ))}
    </footer>
  );
}

function swatchFor(name: string): string {
  const colors: Record<string, string> = {
    "Dreams & Nightmares Case": "#56579a",
    "Fever Case": "#b94a6a",
    "Fracture Case": "#4f8a55",
    "Kilowatt Case": "#3b7a8a",
    "Recoil Case": "#7a6b9a",
    "Revolution Case": "#a85a2a"
  };
  return colors[name] ?? "#6b6860";
}
