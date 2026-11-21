import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/components/by/__tests__/jsdom";

let params = new URLSearchParams("");
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => params, useRouter: () => ({ replace, push: vi.fn() }) }));
let integrations = { passingThrough: false, needsYou: 0 };
vi.mock("../use-integrations", () => ({ useIntegrations: () => integrations }));
vi.mock("../connections-section", () => ({ ConnectionsSection: () => <p>connections body</p> }));
vi.mock("../plan-section", () => ({ PlanSection: () => <p>plan body</p> }));
vi.mock("../account-section", () => ({ AccountSection: () => <p>account body</p> }));
vi.mock("../media-buyer-section", () => ({ MediaBuyerSection: () => <p>buyer body</p> }));
vi.mock("../alerts/alerts-section", () => ({ AlertsSection: () => <p>alerts body</p> }));
vi.mock("../metrics/metrics-section", () => ({ MetricsSection: () => <p>metrics body</p> }));

import { SettingsScreen } from "../settings-screen";

beforeEach(() => {
  vi.clearAllMocks();
  params = new URLSearchParams("");
  integrations = { passingThrough: false, needsYou: 0 };
});

describe("SettingsScreen", () => {
  it("opens on Connections", () => {
    render(<SettingsScreen />);
    expect(screen.getByRole("tab", { name: "Connections" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("connections body")).toBeVisible();
    expect(screen.queryByText("metrics body")).not.toBeInTheDocument();
  });

  it("opens the section the address names, and the old ?tab= values", () => {
    params = new URLSearchParams("section=metrics");
    const { unmount } = render(<SettingsScreen />);
    expect(screen.getByText("metrics body")).toBeInTheDocument();
    unmount();
    params = new URLSearchParams("tab=billing");
    render(<SettingsScreen />);
    expect(screen.getByRole("tab", { name: "Plan & credits" })).toHaveAttribute("aria-selected", "true");
  });

  it("changes section through the address", async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    await user.click(screen.getByRole("tab", { name: "Alerts" }));
    expect(replace).toHaveBeenCalledWith("/settings?section=alerts", { scroll: false });
  });

  it("counts connections that need reconnecting on their tab", () => {
    integrations = { passingThrough: false, needsYou: 1 };
    render(<SettingsScreen />);
    expect(screen.getByRole("tab", { name: /Connections/ })).toHaveTextContent("1");
  });

  it("paints nothing but a skeleton while an OAuth hop passes through", () => {
    integrations = { passingThrough: true, needsYou: 0 };
    render(<SettingsScreen />);
    expect(screen.getByRole("status", { name: "Finishing up" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
