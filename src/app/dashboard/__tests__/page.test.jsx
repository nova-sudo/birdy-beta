import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import PortfolioDashboardPage from "../page";
import { usePortfolioData } from "../usePortfolioData";
import { DashboardControlsProvider } from "@/components/dashboard-controls";
import { PageHeaderProvider, PageHeaderTitle } from "@/components/page-header";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/birdy/BirdyAvatar", () => ({
  default: () => <span data-testid="birdy-avatar" />,
}));

import { format, startOfISOWeek, subDays } from "date-fns";

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { toast } from "sonner";

import { apiRequest } from "@/lib/api";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";

/** N days ago, in the two shapes this file needs. */
const dayISO = (n) => format(subDays(new Date(), n), "yyyy-MM-dd");

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
    { id: "a4", kind: "analysis_pass", actor: "birdy", title: "Analyzed Contour — weekly performance", client: "Contour", time: "4d ago" },
    { id: "a5", actor: "birdy", title: "Analyzed The Body Lab — weekly performance", client: "The Body Lab", time: "4d ago" },
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
  localStorage.setItem("user", JSON.stringify({ name: "Abdelrahman Noa" }));
  useClientGroupsWithSeries.mockImplementation(fakeUseClientGroups({ last_7d: GROUPS }));
  mockEndpoints();
});

/**
 * Renders the page the way src/app/layout.jsx does: the date range lives in
 * DashboardControlsProvider, and the page publishes its top-bar title through
 * PageHeaderProvider (PageHeaderTitle stands in for the bar).
 */
function renderDashboard() {
  return render(
    <PageHeaderProvider>
      <DashboardControlsProvider>
        <div data-testid="top-bar">
          <PageHeaderTitle />
        </div>
        <PortfolioDashboardPage />
      </DashboardControlsProvider>
    </PageHeaderProvider>
  );
}

async function renderPage() {
  renderDashboard();
  await waitFor(() => expect(screen.getByRole("tab", { name: /^Closes/ })).toBeInTheDocument());
}

const tab = (name) => screen.getByRole("tab", { name });
const dsAll = (name) => Array.from(document.querySelectorAll(`[data-ds="${name}"]`));
const ds = (name) => dsAll(name)[0];

describe("Portfolio Dashboard", () => {
  it("opens with a greeting, a one-sentence summary and the period switch", async () => {
    await renderPage();

    const header = ds("page-header");
    expect(within(header).getByRole("heading", { level: 1 }).textContent).toMatch(
      /^Good (morning|afternoon|evening), Abdelrahman$/
    );
    // £400 over 200 leads, up against the week before (last_14d minus this week).
    expect(header).toHaveTextContent("2 clients brought in 200 leads on £400 of ad spend, up");
    expect(within(header).getByRole("tab", { name: "7 days" })).toHaveAttribute("aria-selected", "true");
  });

  it("greets neutrally in server-rendered markup, so hydration has nothing to correct", () => {
    const html = renderToString(
      <DashboardControlsProvider>
        <PortfolioDashboardPage />
      </DashboardControlsProvider>
    );
    expect(html).toContain(">Hello<");
    expect(html).not.toMatch(/Good (morning|afternoon|evening)/);
  });

  it("publishes its title to the top bar", async () => {
    await renderPage();
    expect(screen.getByTestId("top-bar")).toHaveTextContent("Dashboard");
  });

  it("shows the five metrics as tabs, with cost per lead as the inverted one", async () => {
    await renderPage();

    const chart = ds("metric-tabs-chart");
    const tabs = within(chart).getAllByRole("tab");
    expect(tabs.map((t) => t.querySelector("span").textContent)).toEqual([
      "Leads",
      "Closes",
      "Calls",
      "Cost per lead",
      "Ad spend",
    ]);
    expect(tab(/^Leads/)).toHaveTextContent("200");
    expect(tab(/^Closes/)).toHaveTextContent("16");
    expect(tab(/Cost per lead/)).toHaveTextContent("£2.00");
    expect(tab(/Ad spend/)).toHaveTextContent("£400");

    // Leads are up on the week before: good, so green. Cost per lead is also
    // up (£1.75 to £2.00) and for a cost that is bad, so red.
    const leadsDelta = tab(/^Leads/).querySelector("[data-ds=delta]");
    const cplDelta = tab(/Cost per lead/).querySelector("[data-ds=delta]");
    expect(leadsDelta).toHaveTextContent(/^Up/);
    expect(leadsDelta).toHaveAttribute("data-tone", "good");
    expect(cplDelta).toHaveTextContent(/^Up/);
    expect(cplDelta).toHaveAttribute("data-tone", "bad");
    // The delta names what it is measured against.
    expect(leadsDelta).toHaveTextContent("vs previous period");
  });

  it("switches the selected metric", async () => {
    const user = userEvent.setup();
    await renderPage();

    expect(tab(/^Leads/)).toHaveAttribute("aria-selected", "true");
    await user.click(tab(/Ad spend/));
    expect(tab(/Ad spend/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Leads/)).toHaveAttribute("aria-selected", "false");
  });

  it("does not fetch call logs until the Calls tab is opened", async () => {
    await renderPage();
    expect(
      apiRequest.mock.calls.some(([url]) => url.startsWith("/api/hotprospector/call-center"))
    ).toBe(false);
  });

  it("breaks leads down by client with each one's share", async () => {
    await renderPage();

    const breakdown = ds("breakdown");
    expect(within(breakdown).getByText("By client")).toBeInTheDocument();
    const rows = within(breakdown).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("The Body Room");
    expect(rows[0]).toContain("50%");
    expect(rows[1]).toContain("Tylaesthetics");
  });

  it("refetches every figure when the period changes", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({
        last_7d: GROUPS,
        last_30d: [
          group({ id: "a", name: "The Body Room", spend: 1000, results: 500, won: 40, revenue: 9000, contacts: 400 }),
        ],
      })
    );

    await renderPage();
    expect(tab(/Ad spend/)).toHaveTextContent("£400");

    await user.click(within(ds("page-header")).getByRole("tab", { name: "30 days" }));

    await waitFor(() => expect(tab(/Ad spend/)).toHaveTextContent("£1,000"));
    expect(tab(/^Leads/)).toHaveTextContent("500");
    expect(tab(/^Closes/)).toHaveTextContent("40");
    expect(ds("page-header")).toHaveTextContent("1 client brought in 500 leads");
    expect(within(ds("breakdown")).getAllByRole("listitem")).toHaveLength(1);
  });

  it("offers every other preset under More, and shows the active one on the button", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({
        last_7d: GROUPS,
        this_month: [
          group({ id: "c", name: "Aura", spend: 50, results: 50, won: 9, revenue: 700, contacts: 40 }),
        ],
      })
    );
    await renderPage();

    const header = ds("page-header");
    await user.click(within(header).getByRole("button", { name: "More periods" }));
    // The quick picks are not repeated in the menu.
    expect(screen.queryByRole("menuitemradio", { name: "Today" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitemradio", { name: "This Month" }));

    await waitFor(() => expect(tab(/Ad spend/)).toHaveTextContent("£50"));
    expect(within(header).getByRole("button", { name: "More periods: This Month" })).toHaveTextContent(
      "This Month"
    );
    for (const t of within(header).getAllByRole("tab")) {
      expect(t).toHaveAttribute("aria-selected", "false");
    }
  });

  it("says a trend needs a longer period when the window has a single bucket", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS, today: GROUPS })
    );
    mockEndpoints({ leadDays: [LEAD_DAYS[0]] });
    await renderPage();

    await user.click(within(ds("page-header")).getByRole("tab", { name: "Today" }));

    await waitFor(() =>
      expect(ds("metric-tabs-chart").querySelector("[role=tabpanel]")).toHaveTextContent(
        "Pick 7 days or longer to see a trend."
      )
    );
    // The figures still show.
    expect(tab(/^Leads/)).toHaveTextContent("200");
  });

  it("never shows one window's figures under another window's label", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS, last_30d: [] })
    );

    await renderPage();
    await user.click(within(ds("page-header")).getByRole("tab", { name: "30 days" }));

    await waitFor(() => expect(screen.getByText("No active clients yet")).toBeInTheDocument());
    expect(screen.queryByText("£400")).not.toBeInTheDocument();
  });

  it("drops the deltas on a period with nothing to compare against", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS, last_30d: GROUPS })
    );
    await renderPage();

    await user.click(within(ds("page-header")).getByRole("tab", { name: "30 days" }));

    await waitFor(() => expect(ds("page-header")).not.toHaveTextContent("on the previous period"));
    expect(ds("metric-tabs-chart").querySelector("[data-ds=delta]")).toBeNull();
  });
});

describe("Birdy's read on the dashboard", () => {
  it("lists suggestions as findings with a tone and a Do it action", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    const read = ds("birdy-read");
    expect(within(read).getByText("Raise daily budget")).toBeInTheDocument();
    expect(within(read).getAllByRole("button", { name: "Do it" })).toHaveLength(2);
    // HIGH reads as danger.
    const high = within(read).getByText("Pause 2 underperforming ads").closest("li");
    expect(high.querySelector("span[class*=danger]")).not.toBeNull();
  });

  it("moves an applied suggestion out of the list and confirms it", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((url) => {
      if (url.includes("/apply")) return Promise.resolve({ ok: true, json: async () => ({ succeeded: ["ad1"] }) });
      if (url.startsWith("/api/dashboard/summary")) return Promise.resolve({ ok: true, json: async () => SUMMARY });
      if (url.startsWith("/api/facebook-leads/series")) return Promise.resolve({ ok: true, json: async () => ({ series: LEAD_DAYS }) });
      return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    const row = screen.getByText("Pause 2 underperforming ads").closest("li");
    await user.click(within(row).getByRole("button", { name: "Do it" }));

    await waitFor(() =>
      expect(screen.queryByText("Pause 2 underperforming ads")).not.toBeInTheDocument()
    );
    expect(toast.success).toHaveBeenCalledWith("Applied to 1 ad", expect.anything());
  });

  it("puts a suggestion back when applying fails", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((url) => {
      if (url.includes("/apply")) return Promise.resolve({ ok: false, status: 500 });
      if (url.startsWith("/api/dashboard/summary")) return Promise.resolve({ ok: true, json: async () => SUMMARY });
      if (url.startsWith("/api/facebook-leads/series")) return Promise.resolve({ ok: true, json: async () => ({ series: LEAD_DAYS }) });
      return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText("Raise daily budget")).toBeInTheDocument());

    const row = screen.getByText("Raise daily budget").closest("li");
    await user.click(within(row).getByRole("button", { name: "Do it" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("Raise daily budget")).toBeInTheDocument();
  });

  it("dismisses a suggestion through the existing endpoint", async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Dismiss Pause 2 underperforming ads" }));

    await waitFor(() =>
      expect(screen.queryByText("Pause 2 underperforming ads")).not.toBeInTheDocument()
    );
    expect(apiRequest).toHaveBeenCalledWith("/api/dashboard/suggestions/s1", { method: "DELETE" });
    expect(toast).toHaveBeenCalledWith("Suggestion dismissed", expect.anything());
  });

  it("puts a suggestion back when dismissing fails", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((url, opts) => {
      if (opts?.method === "DELETE") return Promise.resolve({ ok: false, status: 500 });
      if (url.startsWith("/api/dashboard/summary")) return Promise.resolve({ ok: true, json: async () => SUMMARY });
      if (url.startsWith("/api/facebook-leads/series")) return Promise.resolve({ ok: true, json: async () => ({ series: LEAD_DAYS }) });
      return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText("Raise daily budget")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Dismiss Raise daily budget" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("Raise daily budget")).toBeInTheDocument();
  });

  it("says nothing needs you when there are no suggestions", async () => {
    mockEndpoints({ summary: { suggestions: [], wins: [], activity: [] } });
    await renderPage();
    await waitFor(() =>
      expect(within(ds("birdy-read")).getByText("Nothing needs you right now.")).toBeInTheDocument()
    );
  });
});

describe("Dashboard states", () => {
  it("shows skeletons while the portfolio loads, with the header already in place", async () => {
    useClientGroupsWithSeries.mockImplementation(fakeUseClientGroups({}, { loading: true }));
    renderDashboard();

    expect(ds("page-header")).toBeInTheDocument();
    expect(ds("metric-tabs-chart").querySelector("[role=tablist]")).toBeNull();
    expect(dsAll("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("No active clients yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your portfolio")).not.toBeInTheDocument();
  });

  it("explains an empty portfolio instead of showing zeroes, and keeps the period switch", async () => {
    useClientGroupsWithSeries.mockImplementation(fakeUseClientGroups({}));
    renderDashboard();

    await waitFor(() => expect(screen.getByText("No active clients yet")).toBeInTheDocument());
    expect(ds("empty-state")).toBeInTheDocument();
    expect(ds("metric-tabs-chart")).toBeUndefined();
    expect(within(ds("page-header")).getByRole("tab", { name: "30 days" })).toBeInTheDocument();
  });

  it("distinguishes a failed load from an empty portfolio, with a retry", async () => {
    useClientGroupsWithSeries.mockImplementation(fakeUseClientGroups({}, { error: "HTTP 503." }));
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Couldn't load your portfolio")).toBeInTheDocument());
    expect(ds("error-state")).toHaveTextContent("HTTP 503. Nothing here");
    expect(ds("error-state")).not.toHaveTextContent("..");
    expect(within(ds("error-state")).getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText("No active clients yet")).not.toBeInTheDocument();
  });

  it("shows a skeleton plot, not the empty message, while the series is still counting", async () => {
    let release;
    apiRequest.mockImplementation((url) => {
      if (url.startsWith("/api/facebook-leads/series")) {
        return new Promise((resolve) => {
          release = () => resolve({ ok: true, json: async () => ({ series: LEAD_DAYS }) });
        });
      }
      if (url.startsWith("/api/dashboard/summary")) return Promise.resolve({ ok: true, json: async () => SUMMARY });
      return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
    });
    await renderPage();

    const panel = ds("metric-tabs-chart").querySelector("[role=tabpanel]");
    expect(panel.querySelector('[data-ds="skeleton"]')).not.toBeNull();
    expect(panel).not.toHaveTextContent("No dated");
    release();
  });

  it("says why the plot is empty once the series has arrived with no dated rows", async () => {
    mockEndpoints({ leadDays: [] });
    await renderPage();
    await waitFor(() =>
      expect(ds("metric-tabs-chart").querySelector("[role=tabpanel]")).toHaveTextContent(
        "No dated leads in this window yet."
      )
    );
  });
});

const callFetches = () =>
  apiRequest.mock.calls.filter(([url]) => url.startsWith("/api/hotprospector/call-center"));

describe("Calls tab", () => {
  it("shows the group's total calls on the tab", async () => {
    await renderPage();
    // 120 + 80 from the two groups' call_stats.
    expect(tab(/^Calls/)).toHaveTextContent("200");
  });

  it("fetches call logs once per preset, lazily, and plots them", async () => {
    const user = userEvent.setup();
    await renderPage();
    expect(callFetches()).toHaveLength(0);

    await user.click(tab(/^Calls/));
    await waitFor(() => expect(callFetches()).toHaveLength(1));
    expect(callFetches()[0][0]).toContain("limit=2000");
    expect(tab(/^Calls/)).toHaveAttribute("aria-selected", "true");

    // Away and back: the rows for this preset are held, not refetched.
    await user.click(tab(/^Leads/));
    await user.click(tab(/^Calls/));
    await waitFor(() => expect(ds("metric-tabs-chart")).toBeInTheDocument());
    expect(callFetches()).toHaveLength(1);
    expect(ds("metric-tabs-chart").querySelector("[role=tabpanel]")).not.toHaveTextContent(
      "No dated calls"
    );
  });

  it("refetches for a new preset", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS, last_30d: GROUPS })
    );
    await renderPage();
    await user.click(tab(/^Calls/));
    await waitFor(() => expect(callFetches()).toHaveLength(1));

    await user.click(within(ds("page-header")).getByRole("tab", { name: "30 days" }));
    await waitFor(() => expect(callFetches()).toHaveLength(2));
  });

  it("says so when the window has no dated calls", async () => {
    const user = userEvent.setup();
    mockEndpoints({ callRows: [] });
    await renderPage();
    await user.click(tab(/^Calls/));
    await waitFor(() =>
      expect(ds("metric-tabs-chart").querySelector("[role=tabpanel]")).toHaveTextContent(
        "No dated calls in this window yet."
      )
    );
  });

  it("keeps the tab, explains itself and fetches nothing when no client has a call centre", async () => {
    const user = userEvent.setup();
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS.map((g) => ({ ...g, call_log_provider: "none" })) })
    );
    await renderPage();
    expect(tab(/^Calls/)).toHaveTextContent("—");

    await user.click(tab(/^Calls/));
    const panel = ds("metric-tabs-chart").querySelector("[role=tabpanel]");
    expect(panel).toHaveTextContent("No call data across your clients");
    expect(panel).toHaveTextContent("so there's no call volume to plot");
    expect(callFetches()).toHaveLength(0);
  });
});

describe("Calls fetch recovery", () => {
  it("fetches again and leaves loading after the tab was left mid-fetch", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const base = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((url, opts) => {
      if (url.startsWith("/api/hotprospector/call-center")) {
        calls += 1;
        if (calls === 1) {
          // Never resolves on its own: it ends only when the page aborts it.
          return new Promise((_, reject) => {
            opts.signal.addEventListener("abort", () =>
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
            );
          });
        }
      }
      return base(url, opts);
    });
    await renderPage();

    await user.click(tab(/^Calls/));
    await waitFor(() => expect(callFetches()).toHaveLength(1));
    await user.click(tab(/^Leads/));
    await user.click(tab(/^Calls/));

    await waitFor(() => expect(callFetches()).toHaveLength(2));
    await waitFor(() =>
      expect(
        ds("metric-tabs-chart").querySelector('[role=tabpanel] [data-ds="skeleton"]')
      ).toBeNull()
    );
  });
});

describe("Call insights", () => {
  const group_ = () => within(document.querySelector('[data-ds="metric-group"]'));

  it("renders all six cells under the group heading", async () => {
    await renderPage();
    const insights = document.querySelector('[data-ds="metric-group"]');
    expect(insights).toHaveTextContent("Call insights");
    expect(insights).toHaveTextContent("Across all client call centres");
    const cards = insights.querySelectorAll('[data-slot="metric-group-cell"]');
    expect(Array.from(cards).map((c) => c.firstChild.textContent)).toEqual([
      "Total calls",
      "Talk time (min)",
      "Answer rate",
      "Calls per lead",
      "Calls per close",
      "Conversion rate",
    ]);
    expect(group_().getByText("Total calls").closest('[data-slot="metric-group-cell"]')).toHaveTextContent("200");
    expect(screen.queryByText(/None of your clients use a call centre/)).not.toBeInTheDocument();
  });

  it("keeps every cell but greys the call-centre ones, with a notice, when nobody dials", async () => {
    useClientGroupsWithSeries.mockImplementation(
      fakeUseClientGroups({ last_7d: GROUPS.map((g) => ({ ...g, call_log_provider: "none" })) })
    );
    await renderPage();

    const notice = ds("notice");
    expect(notice).toHaveTextContent(
      "None of your clients use a call centre, so these figures have no source. Conversion rate is unaffected — it comes from your CRM."
    );
    const insights = document.querySelector('[data-ds="metric-group"]');
    const cards = insights.querySelectorAll('[data-slot="metric-group-cell"]');
    expect(cards).toHaveLength(6);
    // Five placeholders; conversion (closes / leads) stays a real number: 16 / 200.
    expect(insights.querySelectorAll("[title^='Not available']")).toHaveLength(5);
    expect(cards[5]).toHaveTextContent("8.0%");
  });

  it("shows a skeleton in its place while the portfolio loads", () => {
    useClientGroupsWithSeries.mockImplementation(fakeUseClientGroups({}, { loading: true }));
    renderDashboard();
    expect(document.querySelector('[data-ds="metric-group"]')).toBeNull();
    // LoadingBody's placeholders, including the full-width one for the insights.
    expect(document.querySelectorAll('[data-ds="skeleton"].lg\\:col-span-2')).toHaveLength(1);
  });
});

describe("Granularity", () => {
  // Eight days across two ISO weeks: Mon 6 Jul to Mon 13 Jul 2026.
  const DAYS = Array.from({ length: 8 }, (_, i) => ({
    date: `2026-07-${String(6 + i).padStart(2, "0")}`,
    leads: 1,
    closes: 1,
  }));

  beforeEach(() => {
    // Radix Select leans on pointer-capture and scroll APIs jsdom lacks.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  it("offers Daily, Weekly and Monthly, starting from the window's own", async () => {
    const user = userEvent.setup();
    await renderPage();
    const trigger = screen.getByRole("combobox", { name: "Chart granularity" });
    expect(trigger).toHaveTextContent("Daily");
    await user.click(trigger);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Daily",
      "Weekly",
      "Monthly",
    ]);
  });

  it("follows the reader's pick in the control", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("combobox", { name: "Chart granularity" }));
    await user.click(screen.getByRole("option", { name: "Weekly" }));
    expect(screen.getByRole("combobox", { name: "Chart granularity" })).toHaveTextContent("Weekly");
  });

  it("re-buckets every series in the hook when granularity changes", async () => {
    mockEndpoints({ leadDays: DAYS });
    const { result, rerender } = renderHook(
      ({ granularity }) => usePortfolioData({ preset: "last_7d", granularity }),
      { initialProps: { granularity: "Daily" } }
    );
    await waitFor(() => expect(result.current.chartMetrics.leads.values.length).toBe(8));
    expect(result.current.chartMetrics.closes.values.length).toBe(8);
    // Spend is dated relative to today (100, 200, 100 on the last three days).
    expect(result.current.chartMetrics.spend.values).toEqual([100, 200, 100]);
    const weeksOfSpend = new Set(
      [3, 2, 1].map((n) => format(startOfISOWeek(subDays(new Date(), n)), "yyyy-MM-dd"))
    ).size;

    rerender({ granularity: "Weekly" });
    const weekly = result.current.chartMetrics.leads.values;
    expect(weekly.length).toBe(2);
    expect(weekly.reduce((a, b) => a + b, 0)).toBe(8);
    expect(result.current.chartMetrics.closes.values.length).toBe(2);
    const weeklySpend = result.current.chartMetrics.spend.values;
    expect(weeklySpend).toHaveLength(weeksOfSpend);
    expect(weeklySpend.reduce((a, b) => a + b, 0)).toBe(400);
  });

  it("re-buckets the calls series too", async () => {
    mockEndpoints({
      callRows: [
        {
          id: "l1",
          call_logs: DAYS.map((d) => ({ call_time_iso: `${d.date}T10:00:00Z` })),
        },
      ],
    });
    const { result, rerender } = renderHook(
      ({ granularity }) => usePortfolioData({ preset: "last_7d", granularity, chartMetric: "calls" }),
      { initialProps: { granularity: "Daily" } }
    );
    await waitFor(() => expect(result.current.chartMetrics.calls.values.length).toBe(8));
    rerender({ granularity: "Weekly" });
    // Mon 6 to Sun 12 Jul is seven calls, Mon 13 Jul is one. Uncapped, so unscaled.
    expect(result.current.chartMetrics.calls.values).toEqual([7, 1]);
  });

  it("scales a capped calls sample onto the real total, per bucket", async () => {
    // 2000 leads (the fetch cap) with one call each: 1000 on the first day and
    // 1000 on the last. The groups report 200 calls in all.
    const callRows = Array.from({ length: 2000 }, (_, i) => ({
      id: `l${i}`,
      call_logs: [{ call_time_iso: `${DAYS[i < 1000 ? 0 : 7].date}T10:00:00Z` }],
    }));
    mockEndpoints({ callRows });
    const { result, rerender } = renderHook(
      ({ granularity }) => usePortfolioData({ preset: "last_7d", granularity, chartMetric: "calls" }),
      { initialProps: { granularity: "Weekly" } }
    );
    await waitFor(() => expect(result.current.chartMetrics.calls.values.length).toBe(2));
    expect(result.current.chartMetrics.calls.values).toEqual([100, 100]);
    expect(result.current.chartMetrics.calls.estimated).toBe(true);
    rerender({ granularity: "Daily" });
    expect(result.current.chartMetrics.calls.values.reduce((a, b) => a + b, 0)).toBeCloseTo(200);
  });
});
