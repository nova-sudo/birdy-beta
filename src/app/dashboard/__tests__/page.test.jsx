import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioDashboardPage from "../page";
import {
  DashboardControlsProvider,
  DashboardHeaderControls,
  DashboardHeaderTitle,
} from "@/components/dashboard-controls";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
// The header controls only render on the dashboard route.
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// next/font hits the network at module load, which a unit test has no business
// doing — the class names are all the page uses.
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }));

import { format, subDays } from "date-fns";

import { apiRequest } from "@/lib/api";
import { useClientGroups } from "@/lib/useClientGroups";

/** N days ago, in the two shapes this file needs. */
const dayISO = (n) => format(subDays(new Date(), n), "yyyy-MM-dd");
const dayLabel = (n) => format(subDays(new Date(), n), "d MMM yyyy");

/** A client group in the shape GET /api/client-groups actually returns. */
function group({ id, name, spend, results, won, revenue, contacts = 0, open = 0, calls = {}, funnel = null, dailySpend = [] }) {
  return {
    id,
    name,
    client_status: "Active",
    facebook: {
      currency: "GBP",
      metrics: { insights: { spend, results } },
      daily_spend: dailySpend,
    },
    gohighlevel: {
      metrics: {
        total_contacts: contacts,
        opportunity_stats: { won, open, won_revenue: revenue },
        funnel,
      },
    },
    hotprospector: { call_stats: calls },
  };
}

const GROUPS = [
  group({ id: "a", name: "The Body Room", spend: 100, results: 100, won: 4, revenue: 900, contacts: 5000, open: 60,
    calls: { total_calls: 120, answered_calls: 60, leads_with_calls: 50, total_leads: 100, total_talk_min: 200 },
    funnel: { leads: 300, in_crm: 120, called: 200, closes: 30 },
    // Measured spend: deliberately NOT proportional to lead volume, so a curve
    // that still borrows the lead shape is visible in the assertions.
    //
    // Dated relative to today because the chart slices this to the selected
    // range, and the default preset is last_7d — fixed July dates would fall
    // outside it and the series would (correctly) come back empty.
    dailySpend: [
      { date: dayISO(3), spend: 20 },
      { date: dayISO(2), spend: 55 },
      { date: dayISO(1), spend: 25 },
    ] }),
  group({ id: "b", name: "Tylaesthetics", spend: 300, results: 100, won: 12, revenue: 2400, contacts: 4000, open: 40,
    calls: { total_calls: 80, answered_calls: 50, leads_with_calls: 40, total_leads: 100, total_talk_min: 140 },
    funnel: { leads: 100, in_crm: 60, called: 70, closes: 20 },
    dailySpend: [
      { date: dayISO(3), spend: 80 },
      { date: dayISO(2), spend: 145 },
      { date: dayISO(1), spend: 75 },
    ] }),
];

// Per-day counts as /api/facebook-leads/series returns them: four leads over
// three days, two of which went on to close.
const LEAD_DAYS = [
  { date: "2026-07-01", leads: 2, closes: 1 },
  { date: "2026-07-02", leads: 1, closes: 1 },
  { date: "2026-07-03", leads: 1, closes: 0 },
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

// Two leads with call logs: three calls on 1 Jul, one on 2 Jul.
const CALL_ROWS = [
  {
    id: "l1",
    call_logs: [
      { call_time_iso: "2026-07-01T09:00:00Z" },
      { call_time_iso: "2026-07-01T10:00:00Z" },
    ],
  },
  {
    id: "l2",
    call_logs: [
      { call_time_iso: "2026-07-01T15:00:00Z" },
      { call_time_iso: "2026-07-02T09:00:00Z" },
    ],
  },
];

function mockEndpoints(overrides = {}) {
  apiRequest.mockImplementation((url) => {
    if (url.startsWith("/api/hotprospector/call-center")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: overrides.callRows ?? CALL_ROWS }),
      });
    }
    if (url.startsWith("/api/dashboard/summary")) {
      return Promise.resolve({ ok: true, json: async () => overrides.summary ?? SUMMARY });
    }
    if (url.startsWith("/api/facebook-leads/series")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ series: overrides.leadDays ?? LEAD_DAYS }),
      });
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

/**
 * Renders the page the way src/app/layout.jsx does — the date range and
 * granularity chips live in the global top bar, above the page, sharing state
 * through DashboardControlsProvider. Rendering the page alone would not
 * exercise that wiring at all.
 */
function renderDashboard() {
  return render(
    <DashboardControlsProvider>
      <DashboardHeaderTitle />
      <DashboardHeaderControls />
      <PortfolioDashboardPage />
    </DashboardControlsProvider>
  );
}

async function renderPage() {
  renderDashboard();
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

  it("publishes the active client count up to the top bar", async () => {
    // The title block renders in the header, above this page in the tree, so
    // the count has to travel up through the controls context.
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/2 clients · portfolio-level performance/)).toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { name: "Portfolio Dashboard" })).toBeInTheDocument();
  });

  it("keeps the title out of the page body", async () => {
    await renderPage();
    // Exactly one — the header's. The page no longer carries its own.
    expect(screen.getAllByRole("heading", { name: "Portfolio Dashboard" })).toHaveLength(1);
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

  it("offers all four chart tabs", async () => {
    await renderPage();

    const tabs = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(tabs).toEqual(["Leads", "Ad spend", "Calls", "Closes"]);
  });

  it("plots each day's measured spend, summed across clients", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("radio", { name: "Ad spend" }));

    // £20 + £80, then £55 + £145, then £25 + £75. Straight from Meta's rows.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: `${dayLabel(3)}: £100` })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: `${dayLabel(2)}: £200` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${dayLabel(1)}: £100` })).toBeInTheDocument();
  });

  it("no longer borrows the lead shape for spend", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("radio", { name: "Ad spend" }));

    // The fixture's spend is deliberately not proportional to its leads: the
    // heaviest spend day is the middle one, while lead volume peaks on the
    // first. A derived curve could not produce this ordering.
    expect(screen.getByRole("button", { name: `${dayLabel(2)}: £200` })).toBeInTheDocument();
    expect(screen.queryByText(/spread across days by lead share/)).not.toBeInTheDocument();
  });

  it("does not fetch call logs until the Calls tab is opened", async () => {
    const user = userEvent.setup();
    await renderPage();

    const calledCallCentre = () =>
      apiRequest.mock.calls.some(([url]) => url.startsWith("/api/hotprospector/call-center"));

    // A second heavyweight request most visits never need.
    expect(calledCallCentre()).toBe(false);

    await user.click(screen.getByRole("radio", { name: "Calls" }));
    await waitFor(() => expect(calledCallCentre()).toBe(true));
  });

  it("builds the calls series from nested call logs", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("radio", { name: "Calls" }));

    // Three calls on 1 Jul, one on 2 Jul.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "1 Jul 2026: 3" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "2 Jul 2026: 1" })).toBeInTheDocument();
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

  it("counts the four funnel stages off the cohort cache", async () => {
    await renderPage();

    const card = screen.getByRole("heading", { name: "Performance funnel" }).closest("section");
    const stages = within(card).getAllByRole("listitem").map((li) => li.textContent);

    expect(stages).toHaveLength(4);
    // Summed cohorts: 300+100 leads, 120+60 in CRM, 200+70 called, 30+20 won.
    expect(stages[0]).toContain("Leads");
    expect(stages[0]).toContain("400");
    expect(stages[1]).toContain("In CRM");
    expect(stages[1]).toContain("180");
    expect(stages[2]).toContain("Called");
    expect(stages[2]).toContain("270");
    expect(stages[3]).toContain("Closes");
    expect(stages[3]).toContain("50");
  });

  it("shows the close rate on the Closes stage", async () => {
    await renderPage();

    const card = screen.getByRole("heading", { name: "Performance funnel" }).closest("section");
    const stages = within(card).getAllByRole("listitem").map((li) => li.textContent);

    // 50 of the cohort's 400 leads closed. This is the number the card exists
    // to show, so it is asserted rather than left to the count alone.
    expect(stages[3]).toContain("12.5% of leads");
    expect(stages[0]).not.toContain("of leads");
  });

  it("keeps the funnel independent of the portfolio's other GHL totals", async () => {
    await renderPage();

    const card = screen.getByRole("heading", { name: "Performance funnel" }).closest("section");

    // 9,000 lifetime contacts and 100 open opps across the portfolio — the
    // funnel counts one windowed cohort and must show neither.
    expect(card.textContent).not.toContain("9,000");
  });

  it("has no Shows stage — GHL opportunity stats carry no attendance", async () => {
    await renderPage();

    const card = screen.getByRole("heading", { name: "Performance funnel" }).closest("section");
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

  it("shows two rail tabs, and no Wins tab even when the API returns wins", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    // The summary response still carries a win; the rail deliberately ignores it.
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toHaveLength(2);
    expect(tabs.join(" ")).not.toContain("Wins");
    expect(screen.queryByText("CPL down 22% this week")).not.toBeInTheDocument();
  });

  it("leaves the two remaining tab labels unabbreviated", async () => {
    await renderPage();

    // Three tabs squeezed "Suggestions" into "Sugges…"; two do not.
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs[0]).toContain("Suggestions");
    expect(tabs[1]).toContain("Activity");
  });

  it("says so when there are no active clients rather than showing zeroes", async () => {
    useClientGroups.mockImplementation(fakeUseClientGroups({}));
    renderDashboard();

    await waitFor(() => expect(screen.getByText("No active clients yet")).toBeInTheDocument());
    expect(screen.queryByRole("group", { name: "Portfolio KPIs" })).not.toBeInTheDocument();
  });

  it("distinguishes a failed load from an empty portfolio", async () => {
    useClientGroups.mockImplementation(fakeUseClientGroups({}, { error: "HTTP 503" }));
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Couldn't load your portfolio")).toBeInTheDocument()
    );
  });
});
