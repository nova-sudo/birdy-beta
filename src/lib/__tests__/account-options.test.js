import { describe, expect, it } from "vitest";
import { BRIEF_TIMES, TIMEZONES, withCurrent } from "../account-options";

describe("withCurrent", () => {
  it("puts a value from elsewhere first so it stays selectable", () => {
    expect(withCurrent(BRIEF_TIMES, "9:15 AM")[0]).toBe("9:15 AM");
    expect(withCurrent(TIMEZONES, "Asia/Tokyo")).toHaveLength(TIMEZONES.length + 1);
  });

  it("leaves the list alone for a listed or empty value", () => {
    expect(withCurrent(TIMEZONES, "UTC")).toBe(TIMEZONES);
    expect(withCurrent(TIMEZONES, "")).toBe(TIMEZONES);
  });
});
