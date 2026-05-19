# DropScout Recording Instructions

Goal: record raw material that can be cropped into a clean demo video later.

## What is prepared

- Terminal visual: `scripts/recording-cli-demo.mjs`
- Website recording data: `apps/web/src/data/benchmark-visualization-data.json`
- Recording output folder: `media/drop-scout-demo/`

The terminal model-matrix sequence is a recording-demo visual and is explicitly labeled as mocked. The website shows the current local benchmark visualization data. The benchmark baselines, item basket, candle count, and timing-ceiling numbers come from the local benchmark artifacts.

## One-time setup before recording

From repo root:

```bash
node scripts/prepare-recording-web-snapshot.mjs
npm run web:typecheck
```

Then start the website:

```bash
npm run web:dev -- --hostname 127.0.0.1 --port 3000
```

If that says another Next dev server is already running for this repo, use the existing `http://127.0.0.1:3000` page.

Open:

```text
http://127.0.0.1:3000
```

Important: run `node scripts/prepare-recording-web-snapshot.mjs` immediately before recording so the browser page includes the top recording note.

## Screen layout

Use 1920x1080 recording if possible.

Terminal:
- Use a dark theme.
- Set font size around 18-22 px.
- Resize terminal so the script box fits without wrapping.
- Run from repo root:

```bash
node scripts/recording-cli-demo.mjs
```

For a fast rehearsal:

```bash
node scripts/recording-cli-demo.mjs --fast
```

Website:
- Browser zoom: 100%.
- Window width: at least 1200 px.
- Keep the cursor still unless clicking.
- Start on the Leaderboard tab, then optionally click Matrix.

## Suggested recording sequence

1. Record yourself saying the hook:
   "In the AI era, confident trading recommendations are cheap. What matters is whether the model can beat a benchmark without cheating."

2. Cut to terminal. Run:

```bash
node scripts/recording-cli-demo.mjs
```

Say:
   "This is the benchmark run: same evidence window, market baseline first, then multiple models are scored through paper trading."

3. When the terminal reaches `Result snapshot ready`, pause 2 seconds.

4. Cut to the browser at `http://127.0.0.1:3000`.

Say:
   "Now the website shows the result layer: measured model rows, returns versus the human market baseline, evidence coverage, and the matrix view."

5. Click Matrix, then Evidence if you want more detail.

Say:
   "A model only gets credit through simulated portfolio value. Missing data and risk flags stay visible."

6. Close with:
   "DropScout is not a fake trading agent. It is the scoreboard for evaluating AI trading agents."

## Self-recording guidance

- Record your face/audio separately if possible. Use the screen recording as B-roll.
- Camera at eye level, horizontal 16:9.
- Leave headroom and keep yourself centered; avoid cropping hands/face.
- Use a quiet room and a mic close to your mouth.
- Clap once at the beginning if recording camera and screen separately; it helps sync later.
- Speak slower than normal. Leave 1 second of silence before and after each section.

## Files to send/use for editing

- Your talking-head recording.
- Your screen recording of the terminal.
- Your screen recording of the website.
- Optional: `media/drop-scout-demo/drop-scout-benchmark-demo.mp4` as fallback B-roll.
