import { describe, expect, it } from "vitest";
import { STRICTNESS_OPTIONS, strictnessLabel } from "../strictness";

describe("strictness", () => {
  it("offers the backend's three profiles, balanced as the default", () => {
    expect(STRICTNESS_OPTIONS.map((o) => o.value)).toEqual(["lenient", "balanced", "strict"]);
  });

  it("names a profile without its default note", () => {
    expect(strictnessLabel("balanced")).toBe("Balanced");
    expect(strictnessLabel("strict")).toBe("Strict");
    expect(strictnessLabel("custom")).toBe("custom");
  });
});
