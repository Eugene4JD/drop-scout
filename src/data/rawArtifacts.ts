import { join } from "node:path";
import type { RawArtifact, RawRunManifest, RawRunManifestArtifact } from "../types.js";
import { writeJson } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { LATEST_RAW_RUN_PATH, RAW_DIR, RAW_RUNS_DIR } from "../paths.js";
import { slugify } from "../utils/fs.js";

export function buildArtifact<TPayload>(
  artifact: Omit<RawArtifact<TPayload>, "payloadHash">
): RawArtifact<TPayload> {
  const hashTarget = artifact.ok ? artifact.payload : artifact.error;
  return {
    ...artifact,
    payloadHash: sha256(hashTarget ?? null)
  };
}

export async function saveRawArtifact<TPayload>(artifact: RawArtifact<TPayload>): Promise<string> {
  const fileName = [
    slugify(artifact.item),
    artifact.kind,
    artifact.request.window
      ? slugify(artifact.request.window.start.slice(0, 10))
      : artifact.request.lookback
        ? slugify(`lookback-${artifact.request.lookback}`)
        : "live",
    artifact.request.window ? slugify(artifact.request.window.end.slice(0, 10)) : "now"
  ].join("-");

  const path = join(RAW_DIR, artifact.provider, `${fileName}.json`);
  await writeJson(path, artifact);
  return path;
}

export function manifestEntryForArtifact(path: string, artifact: RawArtifact): RawRunManifestArtifact {
  return {
    path,
    provider: artifact.provider,
    kind: artifact.kind,
    item: artifact.item,
    ok: artifact.ok
  };
}

export async function saveRawRunManifest(manifest: RawRunManifest): Promise<string> {
  const path = join(RAW_RUNS_DIR, `${slugify(manifest.runId)}.json`);
  await writeJson(path, manifest);
  await writeJson(LATEST_RAW_RUN_PATH, manifest);
  return path;
}
