import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/components/by/__tests__/jsdom";

let params = new URLSearchParams("");
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => params, useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("../lead-tracking", () => ({ LeadTracking: () => null }));
vi.mock("../connect-ai", () => ({ ConnectAI: () => null }));

import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { useIntegrations } from "../use-integrations";
import { ConnectionsSection } from "../connections-section";

function Harness() {
  return <ConnectionsSection integrations={useIntegrations()} />;
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const day = 864e5;
function serve(overrides = {}) {
  const answers = {
    "/api/status": { gohighlevel: { agency: { connected: true, expires_at: new Date(Date.now() + 20 * day).toISOString() } }, facebook: { connected: true, token_expired: true, expires_at: new Date(Date.now() - day).toISOString() } },
    "/api/hotprospector/status": { connected: false },
    "/api/integrations/slack/status": { installed: false },
    "/api/connect/facebook": { auth_url: "https://facebook.example/oauth" },
    "/api/connect/slack": { auth_url: "https://slack.example/oauth" },
    "/api/connect/slack?real=true": { auth_url: "https://slack.com/oauth" },
    "/api/hotprospector/connect": { groups_count: 4 },
    ...overrides,
  };
  apiRequest.mockImplementation(async (path) => ok(answers[path] ?? {}));
}
const calls = () => apiRequest.mock.calls.map(([p, init]) => `${init?.method ?? "GET"} ${p}`);
const writes = () => calls().filter((c) => !c.startsWith("GET"));

const realLocation = window.location;
beforeEach(() => {
  vi.clearAllMocks();
  params = new URLSearchParams("");
  localStorage.clear();
  document.cookie = "facebook_tokens=; path=/; max-age=0";
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, href: "http://localhost/settings" } });
});
afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("Connections", () => {
  it("shows each connection's state from the backend, and sends nothing", async () => {
    serve();
    render(<Harness />);
    expect(await screen.findByRole("button", { name: /Reconnect/ })).toBeInTheDocument();
    expect(screen.getByText(/Reconnect to keep ad spend and leads updating/)).toBeInTheDocument();
    expect(calls()).toEqual(["GET /api/status", "GET /api/hotprospector/status", "GET /api/integrations/slack/status"]);
    expect(writes()).toEqual([]);
  });

  it("leaves for Meta's consent screen on Reconnect", async () => {
    serve();
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /Reconnect/ }));
    await waitFor(() => expect(window.location.href).toBe("https://facebook.example/oauth"));
    expect(calls()).toContain("GET /api/connect/facebook");
  });

  it("offers a sandbox account the test workspace or a real one", async () => {
    serve({ "/api/integrations/slack/status": { installed: false, sandbox_account: true } });
    const user = userEvent.setup();
    render(<Harness />);
    expect(await screen.findByRole("button", { name: "Use test workspace" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect real Slack" }));
    await waitFor(() => expect(window.location.href).toBe("https://slack.com/oauth"));
    expect(calls()).toContain("GET /api/connect/slack?real=true");
  });

  it("marks a sandbox account's test workspace", async () => {
    serve({ "/api/integrations/slack/status": { installed: true, sandbox_account: true, test_workspace: true, team_name: "Tester Sandbox Workspace" } });
    render(<Harness />);
    expect(await screen.findByText("Tester Sandbox Workspace (test)")).toBeInTheDocument();
  });

  it("leaves for Slack's consent screen on Connect", async () => {
    serve();
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("button", { name: /Reconnect/ });
    const slackConnect = screen.getAllByRole("button", { name: "Connect" }).at(-1);
    await user.click(slackConnect);
    await waitFor(() => expect(window.location.href).toBe("https://slack.example/oauth"));
  });

  it("connects HotProspector only when the dialog is sent", async () => {
    serve();
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("button", { name: /Reconnect/ });
    await user.click(screen.getAllByRole("button", { name: "Connect" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Connect HotProspector" });
    await user.type(within(dialog).getByLabelText("API UID"), "uid-1");
    await user.type(within(dialog).getByLabelText("API Key"), "key-1");
    expect(writes()).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(writes()).toEqual(["POST /api/hotprospector/connect"]));
    const body = apiRequest.mock.calls.find(([p]) => p === "/api/hotprospector/connect")[1].body;
    expect(JSON.parse(body)).toEqual({ api_uid: "uid-1", api_key: "key-1" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("removes a connection only after the confirm", async () => {
    serve({ "/api/status": { gohighlevel: { agency: { connected: true } }, facebook: { connected: false } } });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^Remove GoHighLevel/ }));
    expect(writes()).toEqual([]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes, remove it" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatch(/^DELETE /);
  });

  it("banks Meta's OAuth callback without asking the backend", async () => {
    const tokens = encodeURIComponent(JSON.stringify({ access_token: "t", scope: "ads_read,read_insights", expires_in: 3600 }));
    params = new URLSearchParams(`tokens=${tokens}&status=success`);
    serve();
    render(<Harness />);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Connection Successful", { description: "Meta connected successfully." }));
    expect(document.cookie).toContain("facebook_tokens=");
    expect(JSON.parse(localStorage.getItem("facebookIntegration"))).toMatchObject({ connected: true });
    expect(calls()).not.toContain("GET /api/status");
  });

  it("shows a provider's refusal", async () => {
    params = new URLSearchParams("status=error&error=access_denied&error_description=User%20cancelled");
    serve();
    render(<Harness />);
    expect(await screen.findByText("access_denied: User cancelled")).toBeInTheDocument();
  });
});
