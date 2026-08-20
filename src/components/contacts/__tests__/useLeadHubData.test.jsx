import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }));

const { useLeadHubData } = await import("@/components/contacts/useLeadHubData");
const { presetToDateRange } = await import("@/lib/date-utils");
const { previousWindow } = await import("@/lib/lead-hub-aggregate");

// No fake clock here: testing-library's waitFor drives its own timers, and
// pinning them deadlocks it. The window arithmetic is pinned and asserted in
// lib/__tests__/lead-hub-aggregate.test.js; these assertions derive the dates
// the same way the hook does, so they hold on any day the suite runs.
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const payload = (over = {}) => ({
  contacts: [
    { dateAdded: "2026-08-18T10:00:00Z", contactType: "lead", opportunities: [{ status: "won" }] },
    { dateAdded: "2026-08-19T10:00:00Z", contactType: "contact", opportunities: [] },
  ],
  meta: {
    stats: {
      lead_count: 1525,
      contact_count: 448,
      total_opportunities: 1528,
      open: 1425,
      lost: 63,
      conversion_rate: 2.6,
      ...over,
    },
  },
});

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(ok(payload()));
});

const setup = (props = {}) =>
  renderHook(() =>
    useLeadHubData({ datePreset: "last_7d", selectedClientGroup: "all", ...props })
  );

const settled = async (result) => {
  await waitFor(() => {
    expect(result.current.statsLoading).toBe(false);
    expect(result.current.seriesLoading).toBe(false);
  });
};

describe("useLeadHubData", () => {
  it("settles instead of loading forever when there is nothing to ask for", async () => {
    // Both flags start true so the first paint is a loading state. Bailing out
    // of the effects without clearing them left the chart shimmering
    // permanently on any account with no GHL-connected group — and a screen
    // that never resolves reads as a screen that was never built.
    const { result } = setup({ ready: false });

    await settled(result);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(result.current.current).toBeNull();
  });

  it("asks for the window and the one before it, and neither with a stage filter", async () => {
    // The hero describes the period; the table describes the open tab. Sending
    // the stage filter here would make "Total leads" mean "total won leads" the
    // moment the Won tab was opened.
    const { result } = setup();
    await settled(result);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));

    const urls = apiRequest.mock.calls.map(([url]) => url);
    const now = presetToDateRange("last_7d");
    const before = previousWindow("last_7d");

    expect(urls.some((u) => u.includes(`start_date=${now.start_date}`))).toBe(true);
    expect(urls.some((u) => u.includes(`start_date=${before.start_date}`))).toBe(true);
    expect(urls.every((u) => !u.includes("opportunity_status"))).toBe(true);
  });

  it("takes its totals from the stats and its shape from the rows", async () => {
    const { result } = setup();
    await settled(result);

    // The total is the exact window figure, not a count of the two rows read.
    expect(result.current.chartMetrics.leads.total).toBe("1,525");
    expect(result.current.chartMetrics.contacts.total).toBe("448");
    expect(result.current.chartMetrics.leads.values).toHaveLength(2);
  });

  it("gives the chart the same delta the tile for that metric shows", async () => {
    // One number, computed once — a second delta could disagree with the tile
    // for the same metric sitting inches away.
    const { result } = setup();
    await settled(result);
    await waitFor(() => expect(result.current.hasComparison).toBe(true));

    const chart = result.current.chartFor("leads");
    const tile = result.current.kpis.find((k) => k.key === "leads");
    expect(chart.delta).toBe(tile.delta);
    expect(chart.direction).toBe(tile.direction);
  });

  it("resolves to no chart rather than a stuck one when the rows fail", async () => {
    apiRequest.mockImplementation((url) =>
      url.includes("limit=1") ? Promise.resolve(ok(payload())) : Promise.reject(new Error("boom"))
    );

    const { result } = setup();
    await settled(result);

    expect(result.current.chartFor("leads")).toBeNull();
    // The tiles still have their figures — one failed request should not blank
    // the whole hero.
    expect(result.current.current.leads).toBe(1525);
  });
});
