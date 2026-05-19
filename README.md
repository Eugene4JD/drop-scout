# DropScout V1

DropScout V1 is a benchmark, Gemini paper-trading harness, and static public web viewer for CS2 digital-goods market timing.

Public app: https://eugene4jd.github.io/drop-scout/

The goal of this first version is deliberately narrow:

1. Gather real CS2 market data for selected cases.
2. Normalize and cache provider data.
3. Build human-market benchmark baselines from that data.
4. Run Gemini model paper-trading decisions against the same candle data.
5. Generate JSON, Markdown, terminal reports, and a static web snapshot.

V1 does not include X402, OpenRouter, or real market execution. The current agent harness uses the Gemini API through the Vercel AI SDK Google provider and performs paper trading only.

## Items

The default case basket is:

- Kilowatt Case
- Revolution Case
- Recoil Case
- Fever Case
- Fracture Case
- Dreams & Nightmares Case

## Data Sources

- Primary historical source: CS2Cap (`/v1/prices/candles`)
- Human-sales context where available: CS2Cap (`/v1/sales`)
- Live sanity check: Steam Market overview

CS2Cap requires an API key for historical endpoints. If `CS2CAP_API_KEY` is missing, `dropscout fetch` records an explicit blocker artifact instead of fabricating historical data.

Gemini agent benchmarks require `GOOGLE_GENERATIVE_AI_API_KEY`. Set it locally only; do not commit real keys.

## Setup

```bash
npm install
cp .env.example .env
```

Set local keys in `.env`:

```bash
CS2CAP_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
DROPSCOUT_GEMINI_MODEL=gemini-3-flash-preview
```

## CLI

Fetch raw provider data:

```bash
npm run dev -- fetch --lookback 30d
```

The default fetch uses `--lookback 30d` and sparse candles (`fill=false`) because CS2Cap free-tier keys reject custom `start`/`end` ranges and forward-filled candles. Paid-tier users can request custom ranges with `--start ... --end ...` and forward-filled candles with `--fill`.

Fetch writes a raw run manifest in `data/raw/runs/`. Normalization uses the latest manifest by default so stale raw artifacts do not silently contaminate new benchmarks.

Normalize fetched candles:

```bash
npm run dev -- normalize
```

Normalize a specific run:

```bash
npm run dev -- normalize --manifest data/raw/runs/<run-id>.json
```

Legacy escape hatch for old local artifacts:

```bash
npm run dev -- normalize --all-raw
```

Run human-market benchmark:

```bash
npm run dev -- benchmark --budget 5
```

Run Gemini paper-trading benchmark:

```bash
npm run dev -- agent-benchmark --budget 5 --context-days 7 --fee-pct 0 --model gemini-3-flash-preview
```

Use any Gemini model name supported by your API access:

```bash
npm run dev -- agent-benchmark --model gemini-3-pro-preview --limit-items 1
```

Generate Markdown report from the latest benchmark:

```bash
npm run dev -- report
```

## Output

Generated files:

- `data/raw/...`: raw provider artifacts and blocker records
- `data/raw/runs/...`: fetch run manifests
- `data/normalized/market-candles.json`: normalized candles
- `reports/human-benchmark.json`: machine-readable benchmark
- `reports/human-benchmark.md`: human-readable benchmark
- `reports/agent-benchmark.json`: Gemini paper-trading benchmark
- `reports/agent-benchmark.md`: Gemini paper-trading report

Generated data and reports are gitignored by default because provider payloads can be large and may depend on private API access.

## Benchmark Baselines

V1 benchmarks only human-market data:

- Window-start baseline: first valid candle in the window
- Average human market: OHLCV-derived VWAP when volume exists, otherwise mean close
- Best historical price: hindsight-only close price
- Worst historical price: hindsight-only close price
- Volatility: observed high-low movement over the window
- Liquidity: total and average daily observed volume

## Gemini Agent Harness

The agent benchmark is deliberately bounded:

- It is paper trading only.
- Gemini sees only prior context candles at each walk-forward step.
- The simulator executes the structured decision on the next available candle.
- Outputs are validated before simulation: `buy | sell | hold | skip`, target position percentage, confidence, rationale, evidence, and risk flags.
- OpenRouter is not the primary integration path for this challenge; the implementation uses the Gemini API through `@ai-sdk/google`.
