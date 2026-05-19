import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package smoke", () => {
  it("builds the declared dropscout bin target", () => {
    execFileSync("npm", ["run", "build"], { cwd: process.cwd(), stdio: "pipe" });

    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
      bin: { dropscout: string };
    };

    expect(existsSync(pkg.bin.dropscout)).toBe(true);
    expect(execFileSync(process.execPath, [pkg.bin.dropscout, "--version"], { encoding: "utf8" }).trim()).toBe(
      pkg.version
    );
  });
});
