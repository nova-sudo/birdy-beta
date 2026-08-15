import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioDashboardPage from "../page";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// next/font hits the network at module load, which a unit test has no business
// doing — the class names are all the page uses.
vi.mock("../fonts", () => ({ portfolioFontClass: "" }));

import { apiRequest } from "@/lib/api";
import { useClientGroups } from "@/lib/useClientGroups";

/** A client group in the shape GET /api/client-groups actually returns. */
function group({ id, name, spend, results, won, revenue, contacts = 0, calls = {} }) {
  return {
    id,
    name,
    client_status: "Active",
    facebook: { currency: "GBP", metrics: { insights: { spend, results } } },
    gohighlevel: {
      metrics: { total_contacts: contacts, opportunity_stats: { won, won_revenue: revenue } },
    },
    hotprospector: { call_stats: calls },
  };
}

const GROUPS = [
  group({ id: "a", name: "The Body Room", spend: 100, results: 100, won: 4, revenue: 900, contacts: 80,
    calls: { total_calls: 120, answered_calls: 60, leads_with_calls: 50, total_leads: 100, total_talk_min: 200 } }),
  group({ id: "b", name: "Tylaesthetics", spend: 300, results: 100, won: 12, revenue: 2400, contacts: 70,
    calls: { total_calls: 80, answered_calls: 50, leads_with_calls: 40, total_leads: 100, total_talk_min: 140 } }),
];

const LEADS = [
  { created_time: "2026-07-01T09:00:00Z", ghl_opportunity_status: "won" },
  { created_time: "2026-07-01T11:00:00Z", ghl_opportunity_status: "open" },
  { created_time: "2026-07-02T09:00:00Z", ghl_opportunity_status: "won" },
  { created_time: "2026-07-03T09:00:00Z", ghl_opportunity_status: null },
];

const SUMMARY = {
  suggestions: [
    { id: "s1", severity: "HIGH", client: "Palm Peach", title: "Pause 2 underperforming ads", description: "£48 CPL vs £22 target." },
    { id: "s2", severity: "MEDIUM", client: "Aura", title: "Raise daily budget", description: "Budget capped by 2pm." },
  ],
  wins: [
    { id: "w1", client: "The Body Room", title: "CPL down 22% this week", description: "Cheapest leads since March." },
  ],
  activity: [
    { id: "a1", kind: "action_applied", actor: "birdy", title: "Paused 2 ads", client: "Contour", time: "4 min ago" },
    { id: "a2", kind: "action_applied", actor: "user", title: "Raised budget", client: "Tylaesthetics", time: "1 hr ago" },
    { id: "a3", kind: "suggestion_created", actor: "birdy", title: "noise", client: "x", time: "2 hrs ago" },
  ],
};

function mockEndpoints(overrides = {}) {
  apiRequest.mockImplementation((url) => {
    if (url.startsWith("/api/dashboard/summary")) {
      return Promise.resolve({ ok: true, json: async () => overrides.summary ?? SUMMARY });
    }
    if (url.startsWith("/api/facebook-leads/filtered")) {
      return Promise.resolve({ ok: true, json: async () => ({ leads: overrides.leads ?? LEADS }) });
    }
    if (url.startsWith("/api/client-groups")) {
      // The previous-period fetch. last_14d encloses last_7d, so it reads
      // higher; the hook subtracts to get the week before.
      return Promise.resolve({
        ok: true,
        json: async () => ({
          client_groups: overrides.previous ?? [
            group({ id: "a", name: "The Body Room", spend: 180, results: 180, won: 6, revenue: 1500, contacts: 150 }),
            group({ id: "b", name: "Tylaesthetics", spend: 500, results: 180, won: 20, revenue: 4000, contacts: 130 }),
          ],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

/**
 * A stand-in that behaves the way the real useClientGroups does — including the
 * part that bit: the preset argument is only an *initial* value, and the only
 * way to move the window is the setDatePreset it hands back. A mock that simply
 * echoed its argument would pass whether or not the page wires that up.
 */
const NO_GROUPS = [];

function fakeUseClientGroups(groupsByPreset, { loading = false, error = null } = {}) {
  return (initialPreset) => {
    const [datePreset, setDatePreset] = useState(initialPreset);
    return {
      // A fresh [] per render would make every effect keyed on this re-fire.
      clientGroups: groupsByPreset[datePreset] ?? NO_GROUPS,
      loading,
      error,
      datePreset,
      setDatePreset,
    };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useClientGroups.mockImplementation(fakeUseClientGroups({ last_7d: GROUPS }));
  mockEndpoints();
});

async function renderPage() {
  render(<PortfolioDashboardPage />);
  await waitFor(() => expect(screen.getByText("Total ad spend")).toBeInTheDocument());
}

function kpiCell(label) {
  const strip = screen.getByRole("group", { name: "Portfolio KPIs" });
  return within(strip).getByText(label).closest("div.flex-1");
}

describe("Portfolio Dashboard", () => {
  it("rolls the portfolio up from real client groups", async () => {
    await renderPage();

    expect(within(kpiCell("Total ad spend")).getByText("£400")).toBeInTheDocument();
    expect(within(kpiCell("Total leads")).getByText("200")).toBeInTheDocument();
    // £400 over 200 leads.
    expect(within(kpiCell("Average CPL")).getByText("£2.00")).toBeInTheDocument();
    expect(within(kpiCell("Closed Leads")).getByText("16")).toBeInTheDocument();
  });

  it("counts the active clients in the header", async () => {
    await renderPage();
    expect(screen.getByText(/2 clients · portfolio-level performance/)).toBeInTheDocument();
  });

  it("compares against the previous period on a preset that has one", async () => {
    await renderPage();

    // last_14d spend of £680 minus this week's £400 leaves £280 for the week
    // before, so spend is up.
    const spendPill = within(kpiCell("Total ad spend")).getByText(/%$/);
    expect(spendPill.className).toContain("text-pd-success");
  });

  it("refetches every figure when the date range changes", async () => {
    const user = userEvent.setup();
    // A different window has to yield different numbers, or the assertion
    // below would pass on stale data.
    useClientGroups.mockImplementation(
      fakeUseClientGroups({
        last_7d: GROUPS,
        last_30d: [
          group({ id: "a", name: "The Body Room", spend: 1000, results: 500, won: 40, revenue: 9000, contacts: 400 }),
        ],
      })
    );

    await renderPage();
    expect(within(kpiCell("Total ad spend")).getByText("£400")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Date range:/ }));
    await user.click(screen.getByRole("option", { name: "Last 30 Days" }));

    // The client-group figures have to move with the window, not just the
    // chart series this hook fetches for itself.
    await waitFor(() =>
      expect(within(kpiCell("Total ad spend")).getByText("£1,000")).toBeInTheDocument()
    );
    expect(within(kpiCell("Total leads")).getByText("500")).toBeInTheDocument();
    expect(within(kpiCell("Closed Leads")).getByText("40")).toBeInTheDocument();
    expect(screen.getByText(/1 client · portfolio-level performance/)).toBeInTheDocument();
  });

  it("re-ranks the leaderboard off the new window's clients", async () => {
    const user = userEvent.setup();
    useClientGroups.mockImplementation(
      fakeUseClientGroups({
        last_7d: GROUPS,
        this_month: [
          group({ id: "c", name: "Aura", spend: 50, results: 50, won: 9, revenue: 700, contacts: 40 }),
        ],
      })
    );

    const leaderboard = () =>
      screen.getByRole("heading", { name: "Top performing clients" }).closest("section");

    await renderPage();
    expect(within(leaderboard()).getAllByRole("listitem")[0]).toHaveTextContent("The Body Room");

    await user.click(screen.getByRole("button", { name: /Date range:/ }));
    await user.click(screen.getByRole("option", { name: "This Month" }));

    await waitFor(() =>
      expect(within(leaderboard()).getAllByRole("listitem")[0]).toHaveTextContent("Aura")
    );
  });

  it("never shows one window's figures under another window's label", async () => {
    const user = userEvent.setup();
    useClientGroups.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS, last_30d: [] })
    );

    await renderPage();
    await user.click(screen.getByRole("button", { name: /Date range:/ }));
    await user.click(screen.getByRole("option", { name: "Last 30 Days" }));

    // The empty 30-day window must not leave the 7-day totals on screen.
    await waitFor(() => expect(screen.getByText("No active clients yet")).toBeInTheDocument());
    expect(screen.queryByText("£400")).not.toBeInTheDocument();
  });

  it("drops the delta pills entirely on a preset with no comparable period", async () => {
    const user = userEvent.setup();
    // Same clients either side — this is about the comparison, not the window.
    useClientGroups.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS, last_30d: GROUPS })
    );
    await renderPage();

    await user.click(screen.getByRole("button", { name: /Date range:/ }));
    await user.click(screen.getByRole("option", { name: "Last 30 Days" }));

    await waitFor(() => {
      const strip = screen.getByRole("group", { name: "Portfolio KPIs" });
      expect(within(strip).queryByText(/%$/)).not.toBeInTheDocument();
    });
  });

  it("builds the trend series from dated lead rows", async () => {
    await renderPage();

    // 1 Jul has two leads, 2 and 3 Jul one each.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "1 Jul 2026: 2" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "3 Jul 2026: 1" })).toBeInTheDocument();
  });

  it("offers no ad-spend chart tab, because no endpoint breaks spend down by day", async () => {
    await renderPage();

    const tabs = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(tabs).toEqual(["Leads", "Closes"]);
  });

  it("plots only won leads on the closes series", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("radio", { name: "Closes" }));
    // Two won leads, one on 1 Jul and one on 2 Jul.
    expect(screen.getByRole("button", { name: "1 Jul 2026: 1" })).toBeInTheDocument();
  });

  it("re-buckets the same window when granularity changes", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /Chart granularity:/ }));
    await user.click(screen.getByRole("option", { name: "Monthly" }));

    // All four leads fall in one month.
    expect(screen.getByRole("button", { name: "July 2026: 4" })).toBeInTheDocument();
  });

  it("ranks clients by the chosen metric", async () => {
    const user = userEvent.setup();
    await renderPage();

    const card = screen.getByRole("heading", { name: "Top performing clients" }).closest("section");
    // Avg CPL is the default and ranks ascending — £1 beats £3.
    expect(within(card).getAllByRole("listitem")[0]).toHaveTextContent("The Body Room");

    await user.click(within(card).getByRole("button", { name: /Rank clients by/ }));
    await user.click(screen.getByRole("option", { name: "Revenue" }));

    expect(within(card).getAllByRole("listitem")[0]).toHaveTextContent("Tylaesthetics");
  });

  it("builds a four-stage funnel and stops where the data does", async () => {
    await renderPage();

    const card = screen.getByRole("heading", { name: "Performance funnel" }).closest("section");
    const stages = within(card).getAllByRole("listitem").map((li) => li.textContent);

    expect(stages).toHaveLength(4);
    expect(stages[0]).toContain("Leads");
    expect(stages[3]).toContain("Closes");
    expect(card.textContent).not.toContain("Shows");
  });

  it("computes the call insights from HotProspector stats", async () => {
    await renderPage();

    const card = screen.getByRole("heading", { name: "Call insights" }).closest("section");
    expect(within(card).getByText("200")).toBeInTheDocument(); // 120 + 80 calls
    expect(within(card).getByText("55.0%")).toBeInTheDocument(); // 110 answered of 200
  });

  it("shows suggestions from the dashboard summary", async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument()
    );
  });

  it("separates what Birdy did on its own from what the user approved", async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Activity/ }));

    expect(screen.getByText("Paused 2 ads").closest("li")).toHaveTextContent("Auto-run");
    expect(screen.getByText("Raised budget").closest("li")).toHaveTextContent("Approved");
    // suggestion_created entries are noise in this feed.
    expect(screen.queryByText("noise")).not.toBeInTheDocument();
  });

  it("moves an applied suggestion into the feed", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((url, opts) => {
      if (url.includes("/apply")) return Promise.resolve({ ok: true, json: async () => ({ succeeded: ["ad1"] }) });
      if (url.startsWith("/api/dashboard/summary")) return Promise.resolve({ ok: true, json: async () => SUMMARY });
      if (url.startsWith("/api/facebook-leads/filtered")) return Promise.resolve({ ok: true, json: async () => ({ leads: LEADS }) });
      return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
    });

    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Do it for me: Pause 2 underperforming ads/ }));
    await waitFor(() =>
      expect(screen.queryByText("Pause 2 underperforming ads")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("puts a suggestion back when applying fails", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((url) => {
      if (url.includes("/apply")) return Promise.resolve({ ok: false, status: 500 });
      if (url.startsWith("/api/dashboard/summary")) return Promise.resolve({ ok: true, json: async () => SUMMARY });
      if (url.startsWith("/api/facebook-leads/filtered")) return Promise.resolve({ ok: true, json: async () => ({ leads: LEADS }) });
      return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
    });

    await renderPage();
    await waitFor(() => expect(screen.getByText("Raise daily budget")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Do it for me: Raise daily budget/ }));
    await waitFor(() => expect(screen.getByText("Raise daily budget")).toBeInTheDocument());
  });

  it("keeps client wins reachable, which the page it replaces owned", async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Wins/ }));
    expect(screen.getByText("CPL down 22% this week")).toBeInTheDocument();
  });

  it("marks a win done", async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Wins/ }));
    await user.click(screen.getByRole("button", { name: /Mark done: CPL down 22%/ }));

    await waitFor(() =>
      expect(screen.queryByText("CPL down 22% this week")).not.toBeInTheDocument()
    );
  });

  it("says so when there are no active clients rather than showing zeroes", async () => {
    useClientGroups.mockImplementation(fakeUseClientGroups({}));
    render(<PortfolioDashboardPage />);

    await waitFor(() => expect(screen.getByText("No active clients yet")).toBeInTheDocument());
    expect(screen.queryByRole("group", { name: "Portfolio KPIs" })).not.toBeInTheDocument();
  });

  it("distinguishes a failed load from an empty portfolio", async () => {
    useClientGroups.mockImplementation(fakeUseClientGroups({}, { error: "HTTP 503" }));
    render(<PortfolioDashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Couldn't load your portfolio")).toBeInTheDocument()
    );
  });
});
