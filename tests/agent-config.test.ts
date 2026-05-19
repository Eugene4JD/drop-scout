import { describe, expect, it } from "vitest";
import { resolveGeminiConfig } from "../src/agent/config.js";

describe("resolveGeminiConfig", () => {
  it("uses CLI model names before environment defaults", () => {
    expect(
      resolveGeminiConfig({
        cliModel: "gemini-3-pro-preview",
        env: {
          GOOGLE_GENERATIVE_AI_API_KEY: "local-secret",
          DROPSCOUT_GEMINI_MODEL: "gemini-3-flash-preview"
        }
      }).model
    ).toBe("gemini-3-pro-preview");
  });

  it("does not leak API keys in validation errors", () => {
    expect(() =>
      resolveGeminiConfig({
        cliModel: " ",
        env: {
          GOOGLE_GENERATIVE_AI_API_KEY: "do-not-print-this-secret"
        }
      })
    ).toThrow(/model/i);

    try {
      resolveGeminiConfig({
        cliModel: " ",
        env: {
          GOOGLE_GENERATIVE_AI_API_KEY: "do-not-print-this-secret"
        }
      });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-print-this-secret");
    }
  });
});
