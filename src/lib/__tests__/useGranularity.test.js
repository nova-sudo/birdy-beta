import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useGranularity } from "../useGranularity";

// The rule the hubs' granularity chip follows: the window answers until you
// answer for it, and then your answer sticks. See useGranularity's header.

describe("useGranularity", () => {
  it("starts on whatever the window would have chosen for itself", () => {
    const week = renderHook(() => useGranularity("last_7d"));
    expect(week.result.current.granularity).toBe("Daily");
    expect(week.result.current.isAuto).toBe(true);

    // All-time has no start date, so it buckets by month rather than plotting
    // years of days.
    const all = renderHook(() => useGranularity("maximum"));
    expect(all.result.current.granularity).toBe("Monthly");
  });

  it("takes an explicit pick over the window's own choice", () => {
    const { result } = renderHook(() => useGranularity("last_7d"));

    act(() => result.current.setGranularity("Monthly"));

    expect(result.current.granularity).toBe("Monthly");
    expect(result.current.isAuto).toBe(false);
  });

  it("keeps that pick as the date range moves", () => {
    const { result, rerender } = renderHook(({ preset }) => useGranularity(preset), {
      initialProps: { preset: "maximum" },
    });

    act(() => result.current.setGranularity("Weekly"));
    rerender({ preset: "last_7d" });

    // Having asked for weekly once, you meant it — a new window does not
    // quietly hand the choice back to the default.
    expect(result.current.granularity).toBe("Weekly");
  });
});
