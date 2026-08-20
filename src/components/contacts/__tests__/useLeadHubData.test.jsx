import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }));

const { useLeadHubData } = await import("@/components/contacts/useLeadHubData");
const { presetToDateRange } = await import("@/lib/date-utils");
const { previousWindow, LEAD_SERIES_PAGE_SIZE } = await import("@/lib/lead-hub-aggregate");

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

  it("stops paging as soon as a page comes back short", async () => {
    // Two rows against a page size of 100 is the last page whether or not meta
    // says so, and asking for page 2 would be a wasted round trip.
    const { result } = setup();
    await settled(result);

    const rowPages = apiRequest.mock.calls
      .map(([url]) => url)
      .filter((u) => u.includes(`limit=${LEAD_SERIES_PAGE_SIZE}`));
    expect(rowPages).toHaveLength(1);
    expect(rowPages[0]).toContain("page=1");
  });

  it("fetches the tail of a long window in parallel, not one page at a time", async () => {
    // Sequential paging is what turned a slow window into a minute of loading
    // pulse. Page one goes on its own because its meta says how many pages
    // there are; everything after it goes out together.
    const full = (totalPages) => ({
      contacts: Array.from({ length: LEAD_SERIES_PAGE_SIZE }, (_, i) => ({
        dateAdded: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
        contactType: "lead",
        opportunities: [],
      })),
      meta: { ...payload().meta, total_pages: totalPages },
    });

    let inFlight = 0;
    let peak = 0;
    const rowPages = [];

    apiRequest.mockImplementation((url) => {
      if (!url.includes(`limit=${LEAD_SERIES_PAGE_SIZE}`)) return Promise.resolve(ok(payload()));
      rowPages.push(url);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise((resolve) =>
        setTimeout(() => {
          inFlight -= 1;
          resolve(ok(full(3)));
        }, 0)
      );
    });

    const { result } = setup();
    await settled(result);

    expect(rowPages).toHaveLength(3);
    // Pages 2 and 3 were open at the same time.
    expect(peak).toBeGreaterThan(1);
    expect(result.current.chartFor("leads")).not.toBeNull();
  });

  it("reads every page of a long window, not the first few", async () => {
    // The chart is bucketed from rows, and this endpoint sorts newest-first, so
    // a truncated read covers the recent end of the window and leaves the
    // earlier buckets missing rather than merely short — a curve describing a
    // fortnight while claiming to describe a quarter.
    const TOTAL_PAGES = 14;
    const seen = new Set();

    apiRequest.mockImplementation((url) => {
      if (!url.includes(`limit=${LEAD_SERIES_PAGE_SIZE}`)) return Promise.resolve(ok(payload()));
      seen.add(new URL(url, "http://x").searchParams.get("page"));
      return Promise.resolve(
        ok({
          contacts: Array.from({ length: LEAD_SERIES_PAGE_SIZE }, () => ({
            dateAdded: "2026-08-18T10:00:00Z",
            contactType: "lead",
            opportunities: [],
          })),
          meta: { ...payload().meta, total_pages: TOTAL_PAGES },
        })
      );
    });

    const { result } = setup();
    await settled(result);

    expect(seen.size).toBe(TOTAL_PAGES);
    // Read in full, so nothing is scaled and nothing is flagged an estimate.
    expect(result.current.chartMetrics.leads.estimated).toBe(false);
    expect(result.current.seriesPartial).toBe(false);
  });

  it("says so when a page fails and the read comes up short", async () => {
    apiRequest.mockImplementation((url) => {
      if (!url.includes(`limit=${LEAD_SERIES_PAGE_SIZE}`)) return Promise.resolve(ok(payload()));
      const page = new URL(url, "http://x").searchParams.get("page");
      if (page !== "1") return Promise.reject(new Error("boom"));
      return Promise.resolve(
        ok({
          contacts: Array.from({ length: LEAD_SERIES_PAGE_SIZE }, () => ({
            dateAdded: "2026-08-18T10:00:00Z",
            contactType: "lead",
            opportunities: [],
          })),
          meta: { ...payload().meta, total_pages: 4 },
        })
      );
    });

    const { result } = setup();
    await settled(result);

    // A curve genuinely under the total above it has to admit that rather than
    // under-draw in silence.
    expect(result.current.seriesPartial).toBe(true);
    expect(result.current.chartMetrics.leads.estimated).toBe(true);
    expect(result.current.seriesError).toBe(false);
  });

  it("tells a failed row request from an empty window", async () => {
    // The two looked identical before — which is how a rejected request came to
    // sit on the card reading as a fact about the business.
    apiRequest.mockImplementation((url) =>
      url.includes("limit=1&") ? Promise.resolve(ok(payload())) : Promise.reject(new Error("boom"))
    );

    const { result } = setup();
    await settled(result);

    expect(result.current.seriesError).toBe(true);
    expect(result.current.chartFor("leads")).toBeNull();
    // The tiles still have their figures — one failed request should not blank
    // the whole hero.
    expect(result.current.current.leads).toBe(1525);
  });

  it("does not call an empty window a failure", async () => {
    apiRequest.mockResolvedValue(ok({ contacts: [], meta: payload().meta }));

    const { result } = setup();
    await settled(result);

    expect(result.current.seriesError).toBe(false);
    expect(result.current.chartFor("leads")).toBeNull();
  });
});
