import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { BirdsEye } from "../birds-eye"

const push = vi.fn()
const replace = vi.fn()
const route = { search: "" }
const hook = { args: null, result: null }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(route.search),
}))
vi.mock("@/app/dashboard/usePortfolioData", () => ({ usePortfolioData: (args) => { hook.args = args; return hook.result } }))
vi.mock("@/components/shell/account-menu", () => ({ useStoredUser: () => ({ name: "Hadley Stone", email: "" }) }))

const series = (values) => ({ values, labels: values.map((_, i) => `${i + 1} Nov`), tooltipLabels: values.map((_, i) => `${i + 1} Nov 2026`) })
const row = (id, name, spend, leads) => ({ id, name, spend, leads, closes: 1 })
const totals = (over = {}) => ({
  spend: 2888, leads: 962, closes: 29, cpl: 3, clientCount: 33,
  funnelCached: 1, funnelLeads: 962, funnelInCrm: 771, funnelCalled: 280, funnelCloses: 29,
  rows: [row("a", "Aura", 50, 4), row("b", "Beauty Hub MCR", 139, 100), row("c", "Healthy Glow", 254, 152)],
  ...over,
})
const result = (over = {}) => ({
  current: totals(),
  previous: totals({ spend: 2977, leads: 971, closes: 62, funnelLeads: 971, funnelInCrm: 1017, funnelCalled: 369, funnelCloses: 62 }),
  client: null,
  clientCount: 33,
  chartMetrics: {
    leads: { total: "962", ...series([146, 134, 130]) },
    spend: { total: "£2,888", valuePrefix: "£", ...series([400, 410, 390]) },
    calls: { total: "310", ...series([40, 50, 45]) },
    closes: { total: "29", ...series([4, 5, 3]) },
    cpl: { total: "£3.00", valuePrefix: "£", ...series([3, 2.9, 3.1]) },
  },
  hasCallCentre: true, hasClients: true, hasComparison: true, loading: false, seriesLoading: false, error: null,
  ...over,
})
const AURA = { id: "a", name: "Aura", client_status: "Active", health: "Critical", targets: { cpl: 6 }, facebook: { campaigns: [{ id: "1", name: "Timelapse", spend: 36, results: 3 }, { id: "2", name: "Body Sculpting", spend: 10, results: 5 }] } }

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  hook.result = result()
})

describe("Bird's Eye for the agency", () => {
  it("opens on the last 7 days for the whole agency, with a greeting and the biggest movement", () => {
    render(<BirdsEye />)
    expect(hook.args).toMatchObject({ preset: "last_7d", clientId: null, chartMetric: "leads" })
    expect(screen.getByRole("heading", { level: 1, name: "Agency Ops" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Good (morning|afternoon|evening), Hadley\.$/)
    expect(screen.getByText("Last 7 days · 33 clients")).toBeInTheDocument()
    expect(screen.getByText("Closes are down 53% on the previous 7 days")).toBeInTheDocument()
  })

  it("shows the four tiles, with the call share and where it came from", () => {
    render(<BirdsEye />)
    expect(screen.getByText("Leads called")).toBeInTheDocument()
    expect(screen.getByLabelText("£2,888")).toBeInTheDocument()
    expect(screen.getByLabelText("29%")).toBeInTheDocument()
    expect(screen.getByText("280 of 962 · down from 38%")).toBeInTheDocument()
    expect(screen.getByText("down from 62")).toBeInTheDocument()
  })

  it("greys the tabs that are not built, and opens today's Ask Birdy for Chat", async () => {
    render(<BirdsEye />)
    const views = screen.getByRole("tablist", { name: "Agency Ops views" })
    expect(within(views).getByRole("tab", { name: "Bird's Eye" })).toHaveAttribute("aria-selected", "true")
    expect(within(views).getByRole("tab", { name: "Dashboard" })).toBeDisabled()
    expect(within(views).getByRole("tab", { name: "Suggestions" })).toBeDisabled()
    await userEvent.click(within(views).getByRole("tab", { name: "Chat" }))
    expect(push).toHaveBeenCalledWith("/ask-birdy")
  })

  it("switches the chart between leads, spend, calls and closed", async () => {
    render(<BirdsEye />)
    const figures = screen.getByRole("tablist", { name: "Chart figure" })
    expect(within(figures).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Leads", "Ad spend", "Calls", "Closed"])
    expect(screen.getByRole("img", { name: "Meta leads per day, last 7 days" })).toBeInTheDocument()
    await userEvent.click(within(figures).getByRole("tab", { name: "Ad spend" }))
    expect(hook.args.chartMetric).toBe("spend")
    expect(screen.getByRole("img", { name: "Ad spend per day, last 7 days" })).toBeInTheDocument()
    expect(screen.getByText("1 Nov 2026: £400")).toBeInTheDocument()
  })

  it("ranks clients by cost per lead, each linking to its own Bird's Eye", () => {
    render(<BirdsEye />)
    const list = screen.getByRole("heading", { name: "Top performing clients" }).parentElement
    expect(within(list).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Beauty Hub MCR", "/dashboard?client=b"], ["Healthy Glow", "/dashboard?client=c"], ["Aura", "/dashboard?client=a"],
    ])
  })

  it("draws the funnel and says where leads were lost", () => {
    render(<BirdsEye />)
    const funnel = screen.getByRole("heading", { name: "Performance funnel" }).parentElement
    expect(within(funnel).getAllByRole("listitem").map((li) => li.textContent.replace(/\s+/g, " "))).toEqual([
      expect.stringContaining("Meta leads962"), expect.stringContaining("In CRM771"), expect.stringContaining("Called280"), expect.stringContaining("Closed29"),
    ])
    expect(within(funnel).getByRole("alert")).toHaveTextContent("Problem found: close rate")
  })

  it("keeps the range in the address", async () => {
    route.search = "range=last_30d"
    render(<BirdsEye />)
    expect(hook.args.preset).toBe("last_30d")
    expect(screen.getByText("Last 30 days · 33 clients")).toBeInTheDocument()
    // No previous period for this range, so no movement is claimed.
    hook.result = result({ previous: null })
    await userEvent.click(screen.getByRole("button", { name: "Date range: Last 30 days" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Today" }))
    expect(replace).toHaveBeenCalledWith("/dashboard?range=today")
  })

  it("greys the calls step and says so when nobody has a call centre", async () => {
    hook.result = result({ hasCallCentre: false })
    render(<BirdsEye />)
    expect(screen.getByText("No client has a call centre")).toBeInTheDocument()
    expect(screen.getByText("No call centre")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: "Calls" }))
    expect(screen.getByRole("heading", { name: "No call data" })).toBeInTheDocument()
  })

  it("shows the loading shape, a failure and an empty agency", () => {
    hook.result = result({ loading: true })
    const { unmount } = render(<BirdsEye />)
    expect(screen.getByLabelText("Loading figures")).toBeInTheDocument()
    unmount()
    hook.result = result({ error: "HTTP 500" })
    const failed = render(<BirdsEye />)
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load these figures.")
    failed.unmount()
    hook.result = result({ hasClients: false })
    render(<BirdsEye />)
    expect(screen.getByRole("heading", { name: "No active clients yet" })).toBeInTheDocument()
  })
})

describe("Bird's Eye inside one client", () => {
  beforeEach(() => {
    route.search = "client=a"
    hook.result = result({ client: AURA, current: totals({ spend: 50, leads: 4, cpl: 12.5, closes: 1 }), previous: null })
  })

  it("narrows every figure to that client and says so in the header", () => {
    render(<BirdsEye />)
    expect(hook.args.clientId).toBe("a")
    expect(screen.getByText("Aura", { selector: "b" }).parentElement).toHaveTextContent("Scoped to Aura · At risk")
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open client page" })).toHaveAttribute("href", "/clients/a")
  })

  it("leads with cost per lead against the client's limit, and charts it instead of calls", () => {
    render(<BirdsEye />)
    expect(screen.getByLabelText("£12.50")).toBeInTheDocument()
    expect(screen.getByText("limit £6.00")).toBeInTheDocument()
    expect(within(screen.getByRole("tablist", { name: "Chart figure" })).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Leads", "Ad spend", "CPL", "Closed"])
  })

  it("lists the client's campaigns by cost per lead, cheapest first", () => {
    render(<BirdsEye />)
    const card = screen.getByRole("heading", { name: "Aura’s campaigns, by cost per lead" }).parentElement
    expect(within(card).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Body Sculpting.*£2\.00$/), expect.stringMatching(/^Timelapse.*£12\.00$/),
    ])
  })

  it("explains a client that is missing or inactive instead of showing zeroes", () => {
    hook.result = result({ client: null })
    const { unmount } = render(<BirdsEye />)
    expect(screen.getByRole("heading", { name: "This client isn’t in your account" })).toBeInTheDocument()
    unmount()
    hook.result = result({ client: { ...AURA, client_status: "Inactive" } })
    render(<BirdsEye />)
    expect(screen.getByRole("heading", { name: "Aura is inactive" })).toBeInTheDocument()
  })
})
