import { describe, expect, it } from "vitest";
import { LABEL_WORD, STRINGS } from "@shared/strings";

describe("copy rules (DESIGN_SYSTEM.md section 1)", () => {
  const all = [...Object.values(LABEL_WORD), ...Object.values(STRINGS)];
  it("has no em dashes and no hype words", () => {
    for (const s of all) {
      expect(s).not.toMatch(/\u2014/); // em dash, written as an escape
      expect(s).not.toMatch(/revolutionary|seamless|unleash|supercharge|cutting-edge|effortless|magical/i); // slop-ok: test data listing banned words
    }
  });
  it("uses neutral wording for uncertainty", () => {
    expect(STRINGS.insufficient).toBe("We couldn't find enough evidence to decide. That doesn't mean it's false.");
  });
});
