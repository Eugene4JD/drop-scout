import { describe, expect, it } from "vitest";
import { parseAgentDecision } from "../src/agent/decision.js";

describe("parseAgentDecision", () => {
  it("accepts a structured paper-trading decision", () => {
    expect(
      parseAgentDecision({
        action: "buy",
        targetPositionPct: 75,
        confidence: 0.8,
        rationale: "Price momentum improved while liquidity stayed high.",
        evidence: ["close increased over the last two candles"],
        riskFlags: ["short_history"]
      })
    ).toMatchObject({ action: "buy", targetPositionPct: 75 });
  });

  it("rejects malformed decisions before simulation", () => {
    expect(() =>
      parseAgentDecision({
        action: "buy_everything",
        targetPositionPct: 140,
        confidence: 2,
        rationale: "",
        evidence: [],
        riskFlags: []
      })
    ).toThrow();
  });
});
