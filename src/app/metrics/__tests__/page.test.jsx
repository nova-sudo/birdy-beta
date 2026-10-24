import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MetricsHub from "../page"
import { PageHeaderProvider } from "@/components/page-header"
import { ConfirmHost } from "@/components/ds"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
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
    if (options?.method === "DELETE") return ok({})
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

function Harness() {
  return (
    <PageHeaderProvider>
      <ConfirmHost />
      <MetricsHub />
    </PageHeaderProvider>
  )
}

// The table and its mobile cards are both in the DOM; the table is the one under test.
const table = () => screen.getByRole("table")
const rowNames = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((tr) => within(tr).getAllByRole("cell")[0].textContent)

describe("Metrics Hub", () => {
  it("renders the PageHeader with the search and create controls", async () => {
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    const header = document.querySelector('[data-ds="page-header"]')
    expect(within(header).getByRole("heading", { name: "Metrics Hub" })).toBeInTheDocument()
    expect(within(header).getByLabelText("Search metrics")).toBeInTheDocument()
    expect(within(header).getByRole("button", { name: "Create metric" })).toBeInTheDocument()
  })

  it("lists the catalogue in a ds DataTable with ds tabs", async () => {
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    expect(document.querySelector('[data-ds="data-table"]')).toBeInTheDocument()
    expect(document.querySelector('[data-ds="segmented-tabs"]')).toBeInTheDocument()
  })

  it("badges each metric with the source it comes from", async () => {
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    // Both Meta categories carry the one badge; the derived ratio is Birdy's.
    expect(within(table()).getAllByText("Meta Ads")).toHaveLength(2)
    expect(within(table()).getAllByText("GoHighLevel")).toHaveLength(1)
    // Call-centre metrics name their dialler, not the department.
    expect(within(table()).getAllByText("HotProspector")).toHaveLength(1)
    // Conversion Rate from the catalog, plus ROAS, which Birdy ships itself.
    expect(within(table()).getAllByText("Birdy")).toHaveLength(2)
    expect(within(table()).getAllByText("Custom Formula")).toHaveLength(1)
  })

  it("lists ROAS as a Birdy metric the catalog never sent", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.click(screen.getByRole("tab", { name: "Birdy Metrics" }))
    expect(rowNames()).toEqual(["Conversion Rate", "ROAS"])
  })

  it("offers a Birdy metric show/hide only — never a delete", async () => {
    render(<Harness />)
    await screen.findAllByText("ROAS")

    expect(within(table()).getByRole("button", { name: "Hide ROAS" })).toBeInTheDocument()
    expect(within(table()).queryByRole("button", { name: "Delete ROAS" })).not.toBeInTheDocument()
    expect(within(table()).queryByRole("button", { name: "Edit ROAS" })).not.toBeInTheDocument()
  })

  it("filters to one source per tab", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.click(screen.getByRole("tab", { name: "Meta Metrics" }))
    expect(rowNames().sort()).toEqual(["Campaign Spend", "Meta Spend"])

    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))
    expect(rowNames()).toEqual(["CPA (SOUP)"])
  })

  it("names the controls column for what its rows can do", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    expect(within(table()).getByText("Show / hide")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))
    expect(within(table()).getByText("Controls")).toBeInTheDocument()
    expect(within(table()).getByRole("button", { name: "Edit CPA (SOUP)" })).toBeInTheDocument()
    expect(within(table()).getByRole("button", { name: "Duplicate CPA (SOUP)" })).toBeInTheDocument()
    expect(within(table()).getByRole("button", { name: "Delete CPA (SOUP)" })).toBeInTheDocument()
  })

  it("shows a note where there is one and a dash where there isn't", async () => {
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    expect(within(table()).getAllByText("CPA + PPS Fee").length).toBeGreaterThan(0)
    expect(within(table()).getAllByText("–").length).toBeGreaterThan(0)
  })

  it("persists the show/hide eye", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.click(within(table()).getByRole("button", { name: "Hide Meta Spend" }))

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/user/hidden-metrics",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ metric_id: "meta_spend", hidden: true }),
        })
      )
    )
    expect(await within(table()).findByRole("button", { name: "Show Meta Spend" })).toBeInTheDocument()
  })

  it("puts the hidden row back where it was when the write fails", async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation((url, options) =>
      url.includes("/api/user/hidden-metrics") && options?.method === "PUT"
        ? Promise.resolve({ ok: false, status: 500 })
        : mockApi(url, options)
    )
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.click(within(table()).getByRole("button", { name: "Hide Meta Spend" }))
    expect(await within(table()).findByRole("button", { name: "Hide Meta Spend" })).toBeInTheDocument()
  })

  it("searches names and notes, not the source label", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.type(screen.getByLabelText("Search metrics"), "PPS")
    expect(rowNames()).toEqual(["CPA (SOUP)"])
  })

  it("asks before deleting a custom formula, then deletes it", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")
    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))

    await user.click(within(table()).getByRole("button", { name: "Delete CPA (SOUP)" }))
    await user.click(await screen.findByRole("button", { name: "Delete" }))

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/custom-metrics/cpa", expect.objectContaining({ method: "DELETE" }))
    )
  })

  it("keeps the formula builder: a custom metric opens Edit with its formula controls", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")
    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))

    await user.click(within(table()).getByRole("button", { name: "Edit CPA (SOUP)" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Edit Metric")).toBeInTheDocument()
    expect(within(dialog).getByText("Calculation Logic")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Update Metric" })).toBeInTheDocument()
  })

  it("shows an ErrorState with retry when the catalogue cannot load", async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation(() => Promise.reject(new Error("offline")))
    render(<Harness />)

    const retry = await screen.findByRole("button", { name: /retry|try again/i })
    expect(document.querySelector('[data-ds="error-state"]')).toBeInTheDocument()

    apiRequest.mockImplementation(mockApi)
    await user.click(retry)
    expect((await screen.findAllByText("Meta Spend")).length).toBeGreaterThan(0)
  })

  it("shows an EmptyState when a search matches nothing", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.type(screen.getByLabelText("Search metrics"), "zzzz")
    expect(document.querySelector('[data-ds="empty-state"]')).toBeInTheDocument()
  })
})

describe("Metrics Hub: create, duplicate, paginate", () => {
  const posts = () => apiRequest.mock.calls.filter(([url, o]) => url === "/api/custom-metrics" && o?.method === "POST")
  const withCreate = () =>
    apiRequest.mockImplementation((url, options) =>
      url === "/api/custom-metrics" && options?.method === "POST" ? ok({ metric: { id: "new1" } }) : mockApi(url, options)
    )

  it("creates a formula by hand: the name, the dashboard and the formula go out in one POST, and the row appears", async () => {
    withCreate()
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.click(screen.getByRole("button", { name: "Create metric" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("tab", { name: "Manual" }))
    // Nothing to save until it has a name.
    expect(within(dialog).getByRole("button", { name: "Save Metric" })).toBeDisabled()

    await user.type(within(dialog).getByLabelText("Metric Name"), "Cost per booking")
    await user.click(within(dialog).getByRole("checkbox", { name: "Client Groups" }))
    await user.click(within(dialog).getByRole("button", { name: "Save Metric" }))

    await waitFor(() => expect(posts()).toHaveLength(1))
    const body = JSON.parse(posts()[0][1].body)
    expect(body).toMatchObject({ name: "Cost per booking", dashboards: ["clients"], format_type: "integer", aggregation: "total" })
    expect(Array.isArray(body.formula_parts)).toBe(true)

    // The dialog closes and the new formula is listed.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))
    expect(rowNames()).toContain("Cost per booking")
  })

  it("refuses a name an existing formula already has", async () => {
    withCreate()
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")

    await user.click(screen.getByRole("button", { name: "Create metric" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("tab", { name: "Manual" }))
    await user.type(within(dialog).getByLabelText("Metric Name"), "cpa (soup)")

    expect(within(dialog).getByText(/already exists/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Save Metric" })).toBeDisabled()
    expect(posts()).toHaveLength(0)
  })

  it("duplicates a formula into a new row under a fresh name, leaving the source alone", async () => {
    withCreate()
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Spend")
    await user.click(screen.getByRole("tab", { name: "Custom Formulas" }))

    await user.click(within(table()).getByRole("button", { name: "Duplicate CPA (SOUP)" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Duplicate Metric")).toBeInTheDocument()
    // Pre-filled with a unique suggestion, the source's dashboards carried over.
    expect(within(dialog).getByLabelText("Metric Name")).toHaveValue("CPA (SOUP) (copy)")

    await user.click(within(dialog).getByRole("button", { name: "Save Duplicate" }))

    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(posts()[0][1].body)).toMatchObject({ name: "CPA (SOUP) (copy)", dashboards: ["clients"] })
    expect(apiRequest.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(false)
    await waitFor(() => expect(rowNames()).toEqual(["CPA (SOUP)", "CPA (SOUP) (copy)"]))
  })

  it("pages a long catalogue: 15 to a page, next and previous move between them", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `meta_m${String(i).padStart(2, "0")}`,
      label: `Meta Metric ${String(i).padStart(2, "0")}`,
      category: "Meta Ads",
      level: "group",
    }))
    apiRequest.mockImplementation((url, options) =>
      url.includes("/available-fields") ? ok({ base_metrics: many, tags: [] }) : mockApi(url, options)
    )
    const user = userEvent.setup()
    render(<Harness />)
    await screen.findAllByText("Meta Metric 00")

    // 20 + ROAS + the custom formula = 22 metrics.
    expect(rowNames()).toHaveLength(15)
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Go to previous page" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument()
    expect(rowNames()).toHaveLength(7)
    expect(screen.getByRole("button", { name: "Go to next page" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Go to previous page" }))
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
    expect(rowNames()).toHaveLength(15)
  })
})
