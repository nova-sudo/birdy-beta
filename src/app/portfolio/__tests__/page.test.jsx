import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioDashboardPage from "../page";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
// next/font hits the network at module load, which a unit test has no business
// doing — the class names are all the page uses.
vi.mock("../fonts", () => ({ portfolioFontClass: "" }));

import { apiRequest } from "@/lib/api";

// The portfolio endpoint isn't live yet, so the page falls back to the
// handoff's figures outside production — which is exactly what these assert
// against. When the endpoint lands, point this at a fixture response instead.
beforeEach(() => {
  vi.clearAllMocks();
  apiRequest.mockRejectedValue(new Error("not implemented"));
});

async function renderPage() {
  render(<PortfolioDashboardPage />);
  await waitFor(() => expect(screen.getByText("Total ad spend")).toBeInTheDocument());
}

/** Figures repeat across the strip, chart and funnel — scope to the cell. */
function kpiCell(label) {
  const strip = screen.getByRole("group", { name: "Portfolio KPIs" });
  return within(strip).getByText(label).closest("div.flex-1");
}

async function pickTimeframe(user, timeframe) {
  await user.click(screen.getByRole("button", { name: /Timeframe:/ }));
  await user.click(screen.getByRole("option", { name: timeframe }));
}

describe("Portfolio Dashboard", () => {
  it("renders the portfolio KPIs for the default monthly timeframe", async () => {
    await renderPage();

    expect(within(kpiCell("Total ad spend")).getByText("£142,860")).toBeInTheDocument();
    expect(within(kpiCell("Total leads")).getByText("24,918")).toBeInTheDocument();
    expect(within(kpiCell("Average CPL")).getByText("£5.73")).toBeInTheDocument();
    expect(within(kpiCell("Closed Leads")).getByText("3,182")).toBeInTheDocument();
  });

  it("switches every timeframe-driven figure at once", async () => {
    const user = userEvent.setup();
    await renderPage();

    await pickTimeframe(user, "Weekly");

    // KPI strip, chart total and chart subtitle all follow the header.
    expect(within(kpiCell("Total ad spend")).getByText("£33,410")).toBeInTheDocument();
    expect(within(kpiCell("Total leads")).getByText("5,842")).toBeInTheDocument();
    expect(screen.getByText(/^Weekly · Lead volume/)).toBeInTheDocument();
  });

  it("colours a falling CPL as good and a falling lead count as bad", async () => {
    const user = userEvent.setup();
    await renderPage();

    // Monthly CPL is down 3.3% — cheaper leads, so green.
    expect(within(kpiCell("Average CPL")).getByText("3.3%").className).toContain("text-pd-success");

    await pickTimeframe(user, "Daily");

    // Daily leads are down 2.1% — fewer leads, so red.
    expect(within(kpiCell("Total leads")).getByText("2.1%").className).toContain("text-pd-danger");
    // And a rising CPL is red too.
    expect(within(kpiCell("Average CPL")).getByText("2.7%").className).toContain("text-pd-danger");
  });

  it("re-ranks the leaderboard when the metric changes", async () => {
    const user = userEvent.setup();
    await renderPage();

    const leaderboard = screen.getByRole("heading", { name: "Top performing clients" }).closest("section");
    const firstRowBefore = within(leaderboard).getAllByRole("listitem")[0];
    expect(within(firstRowBefore).getByText("The Body Room")).toBeInTheDocument();

    await user.click(within(leaderboard).getByRole("button", { name: /Rank clients by/ }));
    await user.click(screen.getByRole("option", { name: "Revenue" }));

    const firstRowAfter = within(leaderboard).getAllByRole("listitem")[0];
    expect(within(firstRowAfter).getByText("Tylaesthetics")).toBeInTheDocument();
    expect(within(firstRowAfter).getByText("£298k")).toBeInTheDocument();
  });

  it("shows the derived diagnostic for the failing stage", async () => {
    await renderPage();

    expect(screen.getByText("Problem found: close rate")).toBeInTheDocument();
    expect(screen.getByText(/the drop is at the closing stage/)).toBeInTheDocument();
  });

  it("swaps rail panels without stacking two scroll areas", async () => {
    const user = userEvent.setup();
    await renderPage();

    expect(screen.getByText("Pause 2 underperforming ads")).toBeInTheDocument();
    expect(screen.queryByText("Rotated in new creative set")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Activity/ }));

    expect(screen.getByText("Rotated in new creative set")).toBeInTheDocument();
    expect(screen.queryByText("Pause 2 underperforming ads")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });

  it("moves an applied suggestion into the activity feed", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /Do it for me: Refresh ad creative/ }));

    expect(screen.queryByText("Refresh ad creative")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("Refresh ad creative")).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("removes a dismissed suggestion without recording an action", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: /Dismiss: Raise daily budget/ }));
    expect(screen.queryByText("Raise daily budget £20")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.queryByText("Raise daily budget £20")).not.toBeInTheDocument();
  });

  it("puts the chart tabs and rail toggle in one tab stop each", async () => {
    await renderPage();

    const radios = screen.getAllByRole("radio");
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
  });

  it("names each chart point for readers who can't see the tooltip", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "Aug 2025: 1,404" })).toBeInTheDocument();
  });
});
