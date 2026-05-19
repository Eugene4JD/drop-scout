import rawVisualization from "../data/benchmark-visualization-data.json";
import { VisualizationApp } from "../components/visualization-app";
import type { BenchmarkVisualizationData } from "../lib/visualization";

export default function HomePage() {
  return <VisualizationApp data={rawVisualization as BenchmarkVisualizationData} />;
}
