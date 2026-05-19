import { describe, expect, it } from "vitest";
import { normalizeMoney } from "../src/data/normalize.js";

describe("normalizeMoney", () => {
  it("converts minor-unit money into display USD", () => {
    expect(normalizeMoney(203, "minor")).toBe(2.03);
  });

  it("can preserve raw provider money values", () => {
    expect(normalizeMoney(2.03, "raw")).toBe(2.03);
  });
});
