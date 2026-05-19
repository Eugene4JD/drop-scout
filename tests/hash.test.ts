import { describe, expect, it } from "vitest";
import { sha256 } from "../src/utils/hash.js";

describe("sha256", () => {
  it("hashes objects deterministically regardless of key order", () => {
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
  });
});
