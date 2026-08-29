import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MetricsHub from "../page"
import { PageHeaderControls, PageHeaderProvider, PageHeaderTitle } from "@/components/page-header"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
// The create dialog mounts a live chat; the catalog table is what's under test.
vi.mock("@/components/chat/ChatConversation", () => ({ default: () => null }))

import { apiRequest } from "@/lib/api"

const baseMetrics = [
  { id: "meta_spend", label: "Meta Spend", category: "Meta Ads", level: "group" },
  { id: "spend", label: "Campaign Spend", category: "Campaigns", level: "campaign" },
  { id: "ghl_contacts", label: "GHL Contacts", category: "GoHighLevel", level: "group" },
  { id: "hp_total_calls", label: "Total Calls", category: "Call Center", level: "group" },
  { id: "conversion_rate", label: "Conversion Rate", category: "Calculated", level: "group" },
]

let hidden = []

function ok(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

function mockApi(url, options) {
  if (url.includes("/available-fields")) {
    return ok({ base_metrics: baseMetrics, tags: ["VIP"] })
  }
  if (url.includes("/api/user/hidden-metrics")) {
    if (options?.method === "PUT") {
      const { metric_id, hidden: h } = JSON.parse(options.body)
      hidden = h ? [...hidden, metric_id] : hidden.filter((m) => m !== metric_id)
    }
    return ok({ hidden })
  }
  if (url.includes("/api/custom-metrics")) {
    return ok({
      custom_metrics: [
        { id: "cpa", name: "CPA (SOUP)", description: "CPA + PPS Fee", dashboards: ["clients"] },
      ],
    })
  }
  return ok({})
}

beforeEach(() => {
  hidden = []
  apiRequest.mockReset()
  apiRequest.mockImplementation(mockApi)
})

// Stands in for the global top bar: the page publishes its title and its
// search/create controls into it, so a bare render would show neither.
function Harness() {
  return (
    <PageHeaderProvider>
      <header>
        <PageHeaderTitle />
        <PageHeaderControls />
      </header>
      <MetricsHub />
    </PageHeaderProvider>
  )
}

const table = () => document.getElementById("metrics-table")
const rowNames = () =>
  [...table().querySelectorAll(".flex-1 > div:first-child")].map((el) => el.textContent)

describe("Metrics Hub", () => {
  it("puts its title and controls in the global bar, not on the page", async () => {
    render(<Harness />)
    await screen.findByText("Meta Spend")

    const bar = document.querySelector("header")
    expect(within(bar).getByRole("heading", { name: "Metrics Hub" })).toBeInTheDocument()
    expect(within(bar).getByLabelText("Search metrics")).toBeInTheDocument()
    expect(within(bar).getByRole("button", { name: "Create a custom metric" })).toBeInTheDocument()
  })

  it("badges each metric with the source it comes from", async () => {
    render(<Harness />)
    await screen.findByText("Meta Spend")

    // Both Meta categories carry the one badge; the derived ratio is Birdy's.
    expect(within(table()).getAllByText("Meta Ads")).toHaveLength(2)
    expect(within(table()).getAllByText("GoHighLevel")).toHaveLength(1)
    expect(within(table()).getAllByText("Sales")).toHaveLength(1)
    expect(within(table()).getAllByText("Birdy")).toHaveLength(1)
    expect(within(table()).getAllByText("Custom Formula")).toHaveLength(1)
  })

  it("filters to one source per tab", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findByText("Meta Spend")

    await user.click(screen.getByRole("tab", { name: "Meta Metrics" }))
    expect(rowNames()).toEqual(["Meta Spend", "Campaign Spend"])

    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))
    expect(rowNames()).toEqual(["CPA (SOUP)"])
  })

  it("names the controls column for what its rows can do", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findByText("Meta Spend")

    expect(screen.getByText("SHOW / HIDE")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))
    expect(screen.getByText("CONTROLS")).toBeInTheDocument()
  })

  it("shows a note where there is one and a dash where there isn't", async () => {
    render(<Harness />)
    await screen.findByText("Meta Spend")

    expect(within(table()).getAllByText("CPA + PPS Fee").length).toBeGreaterThan(0)
    expect(within(table()).getAllByText("\u2013").length).toBeGreaterThan(0)
  })

  it("persists the show/hide eye", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findByText("Meta Spend")

    await user.click(screen.getByRole("button", { name: "Hide Meta Spend" }))

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/user/hidden-metrics",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ metric_id: "meta_spend", hidden: true }),
        })
      )
    )
    expect(await screen.findByRole("button", { name: "Show Meta Spend" })).toBeInTheDocument()
  })

  it("puts the hidden row back where it was when the write fails", async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation((url, options) =>
      url.includes("/api/user/hidden-metrics") && options?.method === "PUT"
        ? Promise.resolve({ ok: false, status: 500 })
        : mockApi(url, options)
    )
    render(<Harness />)
    await screen.findByText("Meta Spend")

    await user.click(screen.getByRole("button", { name: "Hide Meta Spend" }))
    expect(await screen.findByRole("button", { name: "Hide Meta Spend" })).toBeInTheDocument()
  })

  it("searches names and notes, not the source label", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findByText("Meta Spend")

    await user.type(screen.getByLabelText("Search metrics"), "PPS")
    expect(rowNames()).toEqual(["CPA (SOUP)"])
  })
})
