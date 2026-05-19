# DropScout V1

DropScout V1 is a CLI-only benchmark for CS2 digital-goods market timing.

The goal of this first version is deliberately narrow:

1. Gather real CS2 market data for selected cases.
2. Normalize and cache provider data.
3. Build human-market benchmark baselines from that data.
4. Generate JSON, Markdown, and terminal reports.

V1 does not include a web app, X402, Gemini, or an agent strategy. Those are next-step layers after the data and human benchmark are trustworthy.

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

## Setup

```bash
npm install
cp .env.example .env
```

Set `CS2CAP_API_KEY` in `.env` if you want real historical candles.

## CLI

Fetch raw provider data:

```bash
npm run dev -- fetch --start 2026-04-19 --end 2026-05-18
```

Normalize fetched candles:

```bash
npm run dev -- normalize
```

Run human-market benchmark:

```bash
npm run dev -- benchmark --budget 5
```

Generate Markdown report from the latest benchmark:

```bash
npm run dev -- report
```

## Output

Generated files:

- `data/raw/...`: raw provider artifacts and blocker records
- `data/normalized/market-candles.json`: normalized candles
- `reports/human-benchmark.json`: machine-readable benchmark
- `reports/human-benchmark.md`: human-readable benchmark

Generated data and reports are gitignored by default because provider payloads can be large and may depend on private API access.

## Benchmark Baselines

V1 benchmarks only human-market data:

- Buy-now baseline: first valid candle in the window
- Average human market: OHLCV-derived VWAP when volume exists, otherwise mean close
- Best historical price: hindsight-only low price
- Worst historical price: hindsight-only high price
- Volatility: observed high-low movement over the window
- Liquidity: total and average daily observed volume

No agent decisions are made in V1.
