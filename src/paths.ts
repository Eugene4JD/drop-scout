import { join } from "node:path";

export const DATA_DIR = "data";
export const RAW_DIR = join(DATA_DIR, "raw");
export const NORMALIZED_DIR = join(DATA_DIR, "normalized");
export const REPORTS_DIR = "reports";

export const NORMALIZED_CANDLES_PATH = join(NORMALIZED_DIR, "market-candles.json");
export const BENCHMARK_JSON_PATH = join(REPORTS_DIR, "human-benchmark.json");
export const BENCHMARK_MD_PATH = join(REPORTS_DIR, "human-benchmark.md");
