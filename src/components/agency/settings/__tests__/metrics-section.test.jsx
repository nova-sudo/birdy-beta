import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/components/by/__tests__/jsdom";

let params = new URLSearchParams("section=metrics");
vi.mock("next/navigation", () => ({ useSearchParams: () => params, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const send = vi.fn();
vi.mock("@/components/agency/chat/use-agent-chat", () => ({ useAgentChat: (opts) => ({ messages: [], loading: false, send, opts }) }));
vi.mock("@/components/agency/chat/thread", () => ({ ChatThread: () => <div>thread</div> }));

import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { MetricsSection } from "../metrics/metrics-section";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const FIELDS = {
  base_metrics: [
    { id: "meta_spend", label: "Meta Spend", category: "Meta Ads", level: "group", description: "Amount spent." },
    { id: "ghl_booked", label: "Booked Calls", category: "GoHighLevel", level: "group" },
    { id: "acct", label: "Account Balance", category: "Meta Ads", level: "account" },
  ],
  tags: [],
};
const CUSTOM = { id: "custom_1", name: "Cost per call", description: "", dashboards: ["clients"], formula_display: "Meta Spend / Booked Calls", formula_parts: [{ type: "metric", value: "meta_spend" }, { type: "operator", value: "/" }, { type: "metric", value: "ghl_booked" }], format_type: "currency", aggregation: "total" };

function serve({ hidden = [], fail = false, customs = [CUSTOM] } = {}) {
  apiRequest.mockImplementation(async (path, init) => {
    const method = init?.method ?? "GET";
    if (fail && method === "GET") return { ok: false, status: 500, json: async () => ({}) };
    if (path === "/api/custom-metrics/available-fields") return ok(FIELDS);
    if (path === "/api/custom-metrics" && method === "GET") return ok({ custom_metrics: customs });
    if (path === "/api/custom-metrics" && method === "POST") return ok({ metric: { id: "custom_new" } });
    if (path === "/api/user/hidden-metrics" && method === "GET") return ok({ hidden });
    if (path === "/api/user/hidden-metrics" && method === "PUT") return ok({ hidden: JSON.parse(init.body).hidden ? [JSON.parse(init.body).metric_id] : [] });
    return ok({});
  });
}
const writes = () => apiRequest.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");

beforeEach(() => {
  vi.clearAllMocks();
  params = new URLSearchParams("section=metrics");
  window.history.replaceState(null, "", "/settings?section=metrics");
});

describe("MetricsSection", () => {
  it("loads the catalogue, formulas and hidden list, and sends nothing", async () => {
    serve();
    render(<MetricsSection />);
    expect(await screen.findByText("Meta Spend")).toBeInTheDocument();
    expect(screen.getByText("Cost per call")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/api/custom-metrics/available-fields");
    expect(apiRequest).toHaveBeenCalledWith("/api/user/hidden-metrics");
    expect(writes()).toEqual([]);
  });

  it("opens the tab and search from the address, and keeps them there", async () => {
    serve();
    params = new URLSearchParams("section=metrics&tab=custom");
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Cost per call");
    expect(screen.queryByText("Meta Spend", { selector: "span" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: /Search metric names/ }), "zzz");
    expect(await screen.findByText(/No custom formulas match/)).toBeInTheDocument();
    expect(window.location.search).toBe("?section=metrics&tab=custom&q=zzz");
  });

  it("hides a metric only when its eye is pressed, and puts it back if the save fails", async () => {
    serve();
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Meta Spend");
    await user.click(screen.getByRole("button", { name: "Hide Meta Spend" }));
    expect(apiRequest).toHaveBeenCalledWith("/api/user/hidden-metrics", expect.objectContaining({ method: "PUT", body: JSON.stringify({ metric_id: "meta_spend", hidden: true }) }));
    expect(await screen.findByRole("button", { name: "Show Meta Spend" })).toBeInTheDocument();

    apiRequest.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await user.click(screen.getByRole("button", { name: "Show Meta Spend" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Show Meta Spend" })).toBeInTheDocument();
  });

  it("creates a formula with the old payload, only on Save", async () => {
    serve({ customs: [] });
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Meta Spend");
    await user.click(screen.getByRole("button", { name: "New formula" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "CPA");
    await user.click(within(dialog).getByRole("button", { name: "Add metric" }));
    // Account-level metrics cannot go in a formula.
    expect(within(dialog).queryByRole("option", { name: /Account Balance/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("option", { name: /Meta Spend/ }));
    await user.click(within(dialog).getByRole("button", { name: "Divide" }));
    await user.type(within(dialog).getByLabelText("A number to add"), "2{Enter}");
    await user.click(within(dialog).getByLabelText("Client Groups"));
    expect(writes()).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Save formula" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const [path, init] = writes()[0];
    expect(path).toBe("/api/custom-metrics");
    expect(JSON.parse(init.body)).toEqual({
      name: "CPA", description: "", dashboards: ["clients"], format_type: "integer", aggregation: "total",
      formula_display: "Meta Spend / 2",
      formula_parts: [{ type: "metric", value: "meta_spend" }, { type: "operator", value: "/" }, { type: "number", value: 2, label: "2" }],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("CPA")).toBeInTheDocument();
  });

  it("refuses a taken name without saving", async () => {
    serve();
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Meta Spend");
    await user.click(screen.getByRole("button", { name: "New formula" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "cost per call");
    await user.click(within(dialog).getByRole("button", { name: "Save formula" }));
    expect(within(dialog).getByText(/already a metric called/)).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("edits with PATCH and duplicates under a free name", async () => {
    serve();
    params = new URLSearchParams("section=metrics&tab=custom");
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Cost per call");
    await user.click(screen.getByRole("button", { name: "Edit Cost per call" }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Average" }));
    await user.click(within(dialog).getByRole("button", { name: "Update formula" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe("/api/custom-metrics/custom_1");
    expect(writes()[0][1].method).toBe("PATCH");
    expect(JSON.parse(writes()[0][1].body)).toMatchObject({ aggregation: "average", formula_display: "Meta Spend / Booked Calls" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Duplicate Cost per call" }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Cost per call (copy)");
  });

  it("deletes only after the confirm", async () => {
    serve();
    params = new URLSearchParams("section=metrics&tab=custom");
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Cost per call");
    await user.click(screen.getByRole("button", { name: "Delete Cost per call" }));
    expect(writes()).toEqual([]);
    await user.click(await screen.findByRole("button", { name: "Delete formula" }));
    await waitFor(() => expect(writes()).toEqual([["/api/custom-metrics/custom_1", { method: "DELETE" }]]));
    await waitFor(() => expect(screen.queryByText("Cost per call")).not.toBeInTheDocument());
  });

  it("says so when the catalogue cannot load, and retries", async () => {
    serve({ fail: true });
    const user = userEvent.setup();
    render(<MetricsSection />);
    expect(await screen.findByText(/Couldn’t load your metrics/)).toBeInTheDocument();
    serve();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Meta Spend")).toBeInTheDocument();
  });

  it("asks Birdy on the custom metrics page and opens the conversation", async () => {
    serve();
    const user = userEvent.setup();
    render(<MetricsSection />);
    await screen.findByText("Meta Spend");
    await user.type(screen.getByRole("textbox", { name: /Ask Birdy to add or change a metric/ }), "cost per show{Enter}");
    expect(send).toHaveBeenCalledWith("cost per show");
    expect(screen.getByRole("complementary", { name: /Ask Birdy about metrics/ })).toBeInTheDocument();
  });
});
