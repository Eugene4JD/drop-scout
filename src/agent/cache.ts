import { join } from "node:path";
import { readJson, slugify, writeJson } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { parseAgentDecision } from "./decision.js";
import type { AgentDecision, AgentDecisionInput, AgentDecisionProvider } from "./types.js";

export function createCachedDecisionProvider(
  provider: AgentDecisionProvider,
  options: {
    cacheDir: string;
    model: string;
  }
): AgentDecisionProvider {
  return async (input: AgentDecisionInput): Promise<AgentDecision> => {
    const path = cachePath(options.cacheDir, options.model, input);

    try {
      return parseAgentDecision(await readJson(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const decision = parseAgentDecision(await provider(input));
    await writeJson(path, decision);
    return decision;
  };
}

function cachePath(cacheDir: string, model: string, input: AgentDecisionInput): string {
  return join(cacheDir, slugify(model), `${sha256(input)}.json`);
}
