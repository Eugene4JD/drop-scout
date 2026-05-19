import { z } from "zod";
import type { AgentDecision } from "./types.js";

export const AgentDecisionSchema = z.object({
  action: z.enum(["buy", "sell", "hold", "skip"]),
  targetPositionPct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
  evidence: z.array(z.string().trim().min(1)).min(1),
  riskFlags: z.array(z.string().trim().min(1)).default([])
});

export function parseAgentDecision(value: unknown): AgentDecision {
  return AgentDecisionSchema.parse(value);
}
