import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { CallsTable, LeadsTable } from "../client-tables"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
// The lead modal itself is tested on its own; here it only says which lead it shows.
vi.mock("@/components/agency/lead/lead-modal", () => ({
  LeadModal: ({ contactId, name, onClose }) => (contactId ? <div role="dialog" aria-label={`Lead: ${name}`} data-contact={contactId}><button onClick={onClose}>Close</button></div> : null),
}))

const data = (rows, over = {}) => ({ rows, total: rows.length, loading: false, error: false, retry: vi.fn(), ...over })
const LEADS = [
  { id: "c1", name: "Leanne Turner", stage: "closed", stageNote: "Lead booked", campaign: "SOUP - CBO", ad: "Timelapse", source: "Facebook", tags: ["hifu"], type: "lead", statuses: ["won"], added: "2026-11-04T18:31:00", calls: 3, value: 349 },
  { id: "c2", name: "Hannah Lewis", stage: "crm", stageNote: "", campaign: "", ad: "", source: "Website", tags: ["hifu", "cold lead"], type: "contact", statuses: [], added: "2026-11-03T13:05:00", calls: 0, value: 0 },
  { id: "c3", name: "Leah Fenwick", stage: "called", stageNote: "", campaign: "Body Sculpting", ad: "", source: "", added: "2026-11-05T09:00:00", calls: 1, value: 0 },
]
const names = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)

beforeEach(() => vi.clearAllMocks())

describe("Leads table", () => {
  it("lists leads newest first with stage, source, calls and value", () => {
    render(<LeadsTable data={data(LEADS)} />)
    expect(names()).toEqual(["Leah Fenwick", "Leanne Turner", "Hannah Lewis"])
    const row = screen.getByRole("row", { name: /Leanne Turner/ })
    expect(row).toHaveTextContent("ClosedLead booked")
    expect(row).toHaveTextContent("SOUP - CBOTimelapse")
    expect(row).toHaveTextContent("4 Nov · 18:31")
    expect(row).toHaveTextContent("£349")
    // No campaign or ad: the CRM's own source stands in.
    expect(screen.getByRole("row", { name: /Hannah Lewis/ })).toHaveTextContent("Website")
    expect(screen.getByRole("row", { name: /Hannah Lewis/ })).toHaveTextContent("None")
  })

  it("counts each stage on its tab and narrows to it", async () => {
    render(<LeadsTable data={data(LEADS)} />)
    const tabs = screen.getByRole("tablist", { name: "Leads by stage" })
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["All3", "In CRM1", "Called1", "Closed1", "Lost"])
    await userEvent.click(within(tabs).getByRole("tab", { name: /^Called/ }))
    expect(names()).toEqual(["Leah Fenwick"])
    await userEvent.click(within(tabs).getByRole("tab", { name: /^Lost/ }))
    expect(screen.getByRole("heading", { name: "No leads match" })).toBeInTheDocument()
  })

  it("searches names and where a lead came from, sorts by a header, and opens a lead", async () => {
    render(<LeadsTable data={data(LEADS)} />)
    await userEvent.type(screen.getByRole("searchbox", { name: "Search leads" }), "timelapse")
    expect(names()).toEqual(["Leanne Turner"])
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search leads" }))
    await userEvent.click(screen.getByRole("button", { name: /^Name/ }))
    expect(names()).toEqual(["Hannah Lewis", "Leah Fenwick", "Leanne Turner"])
    await userEvent.click(screen.getByRole("row", { name: /Hannah Lewis/ }))
    // A lead opens over the table, not on a page of its own.
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Lead: Hannah Lewis" })).toHaveAttribute("data-contact", "c2")
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("opens a lead from the keyboard through its name", async () => {
    render(<LeadsTable data={data(LEADS)} />)
    screen.getByRole("button", { name: "Leah Fenwick" }).focus()
    await userEvent.keyboard("{Enter}")
    expect(screen.getByRole("dialog", { name: "Lead: Leah Fenwick" })).toHaveAttribute("data-contact", "c3")
  })

  it("narrows by source, type, opportunity and tag from one menu, and the tab counts follow", async () => {
    render(<LeadsTable data={data(LEADS)} />)
    await userEvent.click(screen.getByRole("button", { name: "Filters" }))
    expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Source", "Type", "Opportunity", "Tag"])
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "hifu" }))
    // The menu stays open, so a second filter can be set straight away.
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Website" }))
    expect(screen.getByRole("menuitemcheckbox", { name: "Website" })).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{Escape}")
    expect(names()).toEqual(["Hannah Lewis"])
    expect(screen.getByRole("button", { name: "Filters, 2 on" })).toBeInTheDocument()
    expect(within(screen.getByRole("tablist", { name: "Leads by stage" })).getAllByRole("tab")[0]).toHaveTextContent("All1")
    await userEvent.click(screen.getByRole("button", { name: "Filters, 2 on" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Clear all filters" }))
    expect(names()).toHaveLength(3)
  })

  it("says how many are not shown when the list is capped", () => {
    render(<LeadsTable data={data(LEADS, { total: 1200 })} />)
    expect(screen.getByText("Showing the newest 3 of 1,200 leads.")).toBeInTheDocument()
  })

  it("shows loading, a failure with retry, and an empty range", async () => {
    const loading = render(<LeadsTable data={data([], { loading: true })} />)
    expect(screen.getByLabelText("Loading leads")).toBeInTheDocument()
    loading.unmount()
    const failed = data([], { error: true })
    const view = render(<LeadsTable data={failed} />)
    await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }))
    expect(failed.retry).toHaveBeenCalled()
    view.unmount()
    render(<LeadsTable data={data([])} />)
    expect(screen.getByRole("heading", { name: "No leads in this range" })).toBeInTheDocument()
  })
})

describe("Calls table", () => {
  const CALLS = [
    { id: "k1", name: "Leanne Turner", caller: "Priya", outcome: "answered", when: "2026-11-04T19:27:00", seconds: 412, recording: "https://x/r.mp3" },
    { id: "k2", name: "Leanne Turner", caller: "", outcome: "none", when: "2026-11-04T18:37:00", seconds: 0, recording: "" },
  ]
  it("lists calls with who rang, how it went and how long it lasted", () => {
    render(<CallsTable data={data(CALLS)} />)
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent("Leanne TurnerPriyaAnswered4 Nov · 19:276:52")
    expect(rows[1]).toHaveTextContent("No answer")
  })
  it("plays a recording in place only when asked", async () => {
    render(<CallsTable data={data(CALLS)} />)
    expect(document.querySelector("audio")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Play the recording of the call with Leanne Turner, 6:52" }))
    expect(document.querySelector("audio")).toHaveAttribute("src", "https://x/r.mp3")
  })
  it("says a client has no call centre instead of showing no calls", () => {
    render(<CallsTable data={data([], { unavailable: true })} />)
    expect(screen.getByRole("heading", { name: "No call centre connected" })).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
