import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AgentDecisionSchema, parseAgentDecision } from "./decision.js";
import type { AgentDecisionInput, AgentDecisionProvider } from "./types.js";

export function createGeminiDecisionProvider(options: {
  apiKey: string;
  model: string;
  temperature: number;
}): AgentDecisionProvider {
  const google = createGoogleGenerativeAI({ apiKey: options.apiKey });
  const model = google(options.model);

  return async (input: AgentDecisionInput) => {
    const result = await generateObject({
      model,
      schema: AgentDecisionSchema,
      temperature: options.temperature,
      system:
        "You are DropScout's paper-trading agent. You must make simulated CS2 case market timing decisions only from the provided historical context. Do not claim live execution, custody, account access, or real-money trading.",
      prompt: buildDecisionPrompt(input)
    });

    return parseAgentDecision(result.object);
  };
}

function buildDecisionPrompt(input: AgentDecisionInput): string {
  return JSON.stringify(
    {
      task:
        "Choose a paper-trading action for the next available candle. You can only use the contextCandles below; future candles are intentionally hidden.",
      item: input.item,
      model: input.model,
      step: input.step,
      portfolio: input.portfolio,
      dataIssues: input.dataIssues,
      contextCandles: input.contextCandles.map((candle) => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        currency: candle.currency
      })),
      outputContract: {
        action: "buy | sell | hold | skip",
        targetPositionPct: "0..100 percent of portfolio value allocated to this item after execution",
        confidence: "0..1",
        rationale: "short explanation grounded only in contextCandles",
        evidence: "array of concise references to supplied candle facts",
        riskFlags: "array of data/market risks"
      }
    },
    null,
    2
  );
}
