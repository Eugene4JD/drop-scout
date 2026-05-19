import { join } from "node:path";
import type { RawArtifact } from "../types.js";
import { writeJson } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { RAW_DIR } from "../paths.js";
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
    artifact.request.window ? slugify(artifact.request.window.start.slice(0, 10)) : "live",
    artifact.request.window ? slugify(artifact.request.window.end.slice(0, 10)) : "now"
  ].join("-");

  const path = join(RAW_DIR, artifact.provider, `${fileName}.json`);
  await writeJson(path, artifact);
  return path;
}
