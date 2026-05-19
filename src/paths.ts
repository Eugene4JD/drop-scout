import { join } from "node:path";

export const DATA_DIR = "data";
export const RAW_DIR = join(DATA_DIR, "raw");
export const RAW_RUNS_DIR = join(RAW_DIR, "runs");
export const LATEST_RAW_RUN_PATH = join(RAW_RUNS_DIR, "latest.json");
export const NORMALIZED_DIR = join(DATA_DIR, "normalized");
export const REPORTS_DIR = "reports";
export const AGENT_CACHE_DIR = join(DATA_DIR, "agent-cache");
export const AGENT_RUNS_DIR = join(REPORTS_DIR, "agent-runs");

export const NORMALIZED_CANDLES_PATH = join(NORMALIZED_DIR, "market-candles.json");
export const BENCHMARK_JSON_PATH = join(REPORTS_DIR, "human-benchmark.json");
export const BENCHMARK_MD_PATH = join(REPORTS_DIR, "human-benchmark.md");
export const AGENT_BENCHMARK_JSON_PATH = join(REPORTS_DIR, "agent-benchmark.json");
export const AGENT_BENCHMARK_MD_PATH = join(REPORTS_DIR, "agent-benchmark.md");
export const AGENT_MATRIX_JSON_PATH = join(REPORTS_DIR, "agent-model-matrix.json");
export const AGENT_MATRIX_MD_PATH = join(REPORTS_DIR, "agent-model-matrix.md");
export const WEB_SNAPSHOT_PATH = join("apps", "web", "src", "data", "dropscout-snapshot.json");
