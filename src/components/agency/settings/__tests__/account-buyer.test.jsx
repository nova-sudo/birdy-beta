import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/components/by/__tests__/jsdom";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("../slack-report", () => ({ SlackReport: () => null }));

import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { AccountSection } from "../account-section";
import { MediaBuyerSection } from "../media-buyer-section";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const writes = () => apiRequest.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");

beforeEach(() => vi.clearAllMocks());

describe("Account", () => {
  const integrations = { slack: { installed: false }, checking: false, updateSlack: vi.fn() };

  it("saves the profile with the old payload, only when changed and sent", async () => {
    apiRequest.mockImplementation(async () => ok({ name: "Hadley", email: "h@example.invalid", default_currency: "GBP", timezone: "Europe/London" }));
    const user = userEvent.setup();
    render(<AccountSection integrations={integrations} />);
    const name = await screen.findByLabelText("Name");
    await waitFor(() => expect(name).toHaveValue("Hadley"));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.clear(name);
    await user.type(name, "Hadley Stone ");
    expect(writes()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe("/api/user/profile");
    expect(JSON.parse(writes()[0][1].body)).toEqual({ name: "Hadley Stone", default_currency: "GBP", timezone: "Europe/London" });
    expect(toast.success).toHaveBeenCalledWith("Settings saved");
  });

  it("checks the new password twice before sending it", async () => {
    apiRequest.mockImplementation(async () => ok({ name: "Hadley", email: "h@example.invalid" }));
    const user = userEvent.setup();
    render(<AccountSection integrations={integrations} />);
    await user.click(screen.getByRole("button", { name: /Change password/ }));
    await user.type(screen.getByLabelText("Current password"), "old-pass-1");
    await user.type(screen.getByLabelText("New password"), "new-pass-123");
    await user.type(screen.getByLabelText("Confirm new password"), "new-pass-124");
    await user.click(screen.getByRole("button", { name: /Update password/ }));
    expect(writes()).toEqual([]);
  });
});

describe("Media Buyer", () => {
  function serve(on) {
    apiRequest.mockImplementation(async (path, init) => {
      if (path === "/api/capabilities" && init?.method === "PUT") return ok({ media_buying: JSON.parse(init.body).media_buying });
      if (path === "/api/capabilities") return ok({ media_buying: on });
      if (path === "/api/dashboard/settings") return ok({ strictness: "balanced" });
      return ok({});
    });
  }

  it("shows strictness only while the analyst is on", async () => {
    serve(false);
    const user = userEvent.setup();
    render(<MediaBuyerSection />);
    const sw = await screen.findByRole("switch", { name: "Media Buying Analyst" });
    await waitFor(() => expect(sw).toBeEnabled());
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
    await user.click(sw);
    await waitFor(() => expect(writes()).toEqual([["/api/capabilities", { method: "PUT", body: JSON.stringify({ media_buying: true }) }]]));
    expect(await screen.findByRole("radiogroup")).toBeInTheDocument();
  });

  it("saves a strictness only when one is picked", async () => {
    serve(true);
    const user = userEvent.setup();
    render(<MediaBuyerSection />);
    const lenient = await screen.findByRole("radio", { name: /Lenient/ });
    await waitFor(() => expect(lenient).toBeEnabled());
    expect(writes()).toEqual([]);
    await user.click(lenient);
    await waitFor(() => expect(writes()).toEqual([["/api/dashboard/settings", { method: "PUT", body: JSON.stringify({ strictness: "lenient" }) }]]));
  });
});
