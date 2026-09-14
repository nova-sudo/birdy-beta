import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import PortfolioDashboardPage from "../page";
import {
  DashboardControlsProvider,
  DashboardHeaderControls,
  DashboardHeaderTitle,
} from "@/components/dashboard-controls";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }));

import { apiRequest } from "@/lib/api";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";

// ─── The portfolio nobody dials ─────────────────────────────────────────────
// Every call figure on this screen is a sum over `hotprospector.call_stats`,
// and a client whose `call_log_provider` is "none" has no such cache — so the
// sums land on a perfectly formatted 0. That 0 is the bug: it is
// indistinguishable from a quiet week and means the opposite of one.
//
// What is asserted here is the distinction, not the styling. A test that
// looked for a grey class would pass on a screen that had greyed out a real
// number; these look for the absence of the zero and the presence of the way
// out of it.

/** A client group as GET /api/client-groups returns it, provider included. */
function group({ id, name, provider, calls = {}, funnel = null }) {
  return {
    id,
    name,
    client_status: "Active",
    // The provider is the whole point of this file, so it is never defaulted.
    call_log_provider: provider,
    facebook: { currency: "GBP", metrics: { insights: { spend: 400, results: 200 } }, daily_spend: [] },
    gohighlevel: {
      metrics: {
        total_contacts: 1000,
        opportunity_stats: { won: 16, open: 0, won_revenue: 3000 },
        funnel,
      },
    },
    hotprospector: { call_stats: calls },
  };
}

// One client, no dialler, but a real Meta/GHL history — so anything that goes
// grey here went grey because of the provider and not because the group is
// empty.
const NO_CALL_CENTRE = [
  group({
    id: "a",
    name: "The Body Room",
    provider: "none",
    funnel: { leads: 400, in_crm: 180, called: 0, closes: 50 },
  }),
];

// The same client with a dialler behind it, as the control.
const WITH_CALL_CENTRE = [
  group({
    id: "a",
    name: "The Body Room",
    provider: "hotprospector",
    calls: { total_calls: 200, answered_calls: 110, leads_with_calls: 90, total_leads: 150, total_talk_min: 340 },
    funnel: { leads: 400, in_crm: 180, called: 270, closes: 50 },
  }),
];

function mockEndpoints() {
  apiRequest.mockImplementation((url) => {
    if (url.startsWith("/api/hotprospector/call-center")) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    }
    if (url.startsWith("/api/dashboard/summary")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ suggestions: [], wins: [], activity: [] }),
      });
    }
    if (url.startsWith("/api/facebook-leads/series")) {
      return Promise.resolve({ ok: true, json: async () => ({ series: [] }) });
    }
    // The previous-period client-groups fetch; no comparison needed here.
    return Promise.resolve({ ok: true, json: async () => ({ client_groups: [] }) });
  });
}

const NO_GROUPS = [];

function fakeUseClientGroups(groupsByPreset) {
  return (initialPreset) => {
    const [datePreset, setDatePreset] = useState(initialPreset);
    return {
      clientGroups: groupsByPreset[datePreset] ?? NO_GROUPS,
      loading: false,
      error: null,
      datePreset,
      setDatePreset,
    };
  };
}

async function renderWith(groups) {
  useClientGroupsWithSeries.mockImplementation(fakeUseClientGroups({ last_7d: groups }));
  render(
    <DashboardControlsProvider>
      <DashboardHeaderTitle />
      <DashboardHeaderControls />
      <PortfolioDashboardPage />
    </DashboardControlsProvider>
  );
  await waitFor(() => expect(screen.getByText("Total ad spend")).toBeInTheDocument());
}

const card = (name) => screen.getByRole("heading", { name }).closest("section");

beforeEach(() => {
  vi.clearAllMocks();
  mockEndpoints();
});

describe("Portfolio Dashboard without a call centre", () => {
  it("draws the Called funnel stage as unavailable rather than as zero", async () => {
    await renderWith(NO_CALL_CENTRE);

    const stages = within(card("Performance funnel"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);

    expect(stages[2]).toContain("Called");
    expect(stages[2]).not.toContain("0");
    expect(stages[2]).toContain("Not available");
  });

  it("leaves the stages the call centre does not report alone", async () => {
    // The one thing this funnel's cohort framing buys: Closes is counted
    // against the same window's contacts, not against Called, so a missing
    // Called stage does not make it unknowable. A drop-off funnel would have
    // had to blank everything below.
    await renderWith(NO_CALL_CENTRE);

    const stages = within(card("Performance funnel"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);

    expect(stages[0]).toContain("400");
    expect(stages[1]).toContain("180");
    expect(stages[3]).toContain("50");
    // Closes' share of the cohort — the close rate — still reads.
    expect(stages[3]).toContain("12.5% of leads");
  });

  it("still counts Called for a portfolio that does dial", async () => {
    await renderWith(WITH_CALL_CENTRE);

    const stages = within(card("Performance funnel"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);

    expect(stages[2]).toContain("270");
    expect(stages[2]).not.toContain("Not available");
  });

  it("greys the call insights and offers a way to connect one", async () => {
    await renderWith(NO_CALL_CENTRE);

    const insights = card("Call insights");

    // Total calls and talk time would both have summed to a clean 0.
    expect(within(insights).getByText("Total calls")).toBeInTheDocument();
    expect(within(insights).queryByText("0")).not.toBeInTheDocument();
    expect(within(insights).getAllByText(/Not available/).length).toBeGreaterThan(0);
    expect(within(insights).getByRole("link", { name: "Link a sales tool" })).toHaveAttribute(
      "href",
      "/settings?tab=integrations"
    );
  });

  it("keeps conversion rate real — it is closes over leads, not a call metric", async () => {
    // The card is headed "Call insights", but this figure comes from GHL wins
    // over Meta results and survives a client having no dialler. Greying it
    // would be claiming we cannot measure something we measure perfectly well.
    await renderWith(NO_CALL_CENTRE);

    const insights = card("Call insights");
    // 16 won opportunities of 200 Meta results. (Not the funnel's 50: that is
    // one window's cohort, a different question — see buildFunnel.)
    expect(within(insights).getByText("8.0%")).toBeInTheDocument();
  });

  it("dims the icon chip along with the figure", async () => {
    // "Dim all the metrics gray" — a bright purple chip beside a grey dash
    // reads as a live figure that has gone momentarily missing, which is the
    // opposite of what the dash means. The row has to dim as one thing.
    await renderWith(NO_CALL_CENTRE);

    const totalCalls = within(card("Call insights")).getByText("Total calls").parentElement;
    expect(totalCalls.querySelector(".bg-pd-neutral-badge")).not.toBeNull();

    const called = within(card("Performance funnel"))
      .getAllByRole("listitem")[2];
    expect(called.querySelector(".bg-pd-neutral-badge")).not.toBeNull();
  });

  it("leaves the chips their own colour where the figure is real", async () => {
    await renderWith(WITH_CALL_CENTRE);

    const totalCalls = within(card("Call insights")).getByText("Total calls").parentElement;
    expect(totalCalls.querySelector(".bg-pd-neutral-badge")).toBeNull();

    // Conversion rate is closes over leads and never dims, even here.
    const conversion = within(card("Call insights")).getByText("Conversion rate").parentElement;
    expect(conversion.querySelector(".bg-pd-neutral-badge")).toBeNull();
  });

  it("keeps the conversion chip lit while the rest of the card goes grey", async () => {
    await renderWith(NO_CALL_CENTRE);

    const conversion = within(card("Call insights")).getByText("Conversion rate").parentElement;
    expect(conversion.querySelector(".bg-pd-neutral-badge")).toBeNull();
  });

  it("computes the real figures when a call centre is connected", async () => {
    await renderWith(WITH_CALL_CENTRE);

    const insights = card("Call insights");
    expect(within(insights).getByText("200")).toBeInTheDocument();
    expect(within(insights).getByText("55.0%")).toBeInTheDocument();
    expect(within(insights).queryByRole("link", { name: "Link a sales tool" })).toBeNull();
  });
});
