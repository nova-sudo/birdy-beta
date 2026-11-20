import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { MAX_IMPORT_SELECTION } from "@/lib/import-review"
import { ImportDialog } from "../import-dialog"

const reply = (body, { ok = true, status = 200 } = {}) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
const account = (location_id, name, extra = {}) => ({ location_id, name, already_imported: false, leads_recent_90: true, leads_recent_7: false, last_lead_at: "2026-11-01T00:00:00Z", status_default: "active", fb_match: null, ...extra })
const REVIEW = {
  prep: { status: "done" },
  fb_accounts: [{ id: "act_1", name: "Aura Ads", currency: "GBP" }, { id: "act_2", name: "Plush Ads", currency: "GBP" }],
  accounts: [
    account("loc_1", "Aura", { fb_match: { id: "act_1", name: "Aura Ads", currency: "GBP" }, leads_recent_7: true }),
    account("loc_2", "Plush", { leads_recent_7: true }),
    account("loc_3", "Quiet Clinic", { status_default: "inactive" }),
    account("loc_4", "Zed Skin"),
  ],
}

let sent
function serve({ review = REVIEW, result = () => reply({ imported: [{ location_id: "loc_1" }, { location_id: "loc_2" }] }) } = {}) {
  sent = null
  apiRequest.mockImplementation((url, options) => {
    if (url === "/api/onboarding/prepare-review") return reply({})
    if (url === "/api/onboarding/subaccounts-review") return reply(typeof review === "function" ? review() : review)
    if (url === "/api/onboarding/import-subaccounts") { sent = JSON.parse(options.body); return result() }
    return reply({})
  })
}

const onOpenChange = vi.fn()
const onImported = vi.fn()
const open = async () => {
  render(<ImportDialog open onOpenChange={onOpenChange} onImported={onImported} />)
  return screen.findByRole("dialog", { name: "Import clients from GoHighLevel" })
}
const importButton = () => screen.getByRole("button", { name: /^Import \d+ clients?$/ })

beforeEach(() => { vi.clearAllMocks(); serve() })

describe("Import: reading", () => {
  it("shows progress while Birdy is still reading, and no table", async () => {
    serve({ review: { prep: { status: "running", done: 16, total: 42 }, accounts: [] } })
    await open()
    expect(await screen.findByText("16 of 42 sub-accounts checked")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(importButton()).toBeDisabled()
  })

  it("says there is nothing left when every sub-account is already in", async () => {
    serve({ review: { prep: { status: "done" }, accounts: [account("loc_1", "Aura", { already_imported: true })] } })
    await open()
    expect(await screen.findByText(/nothing left to import/)).toBeInTheDocument()
    expect(importButton()).toBeDisabled()
  })
})

describe("Import: reviewing", () => {
  it("pre-ticks sub-accounts with a recent lead and lists them first", async () => {
    await open()
    const rows = await screen.findAllByRole("row")
    expect(within(rows[1]).getByRole("checkbox")).toBeChecked()
    expect(within(rows[1]).getByDisplayValue("Aura")).toBeInTheDocument()
    expect(within(rows[2]).getByDisplayValue("Plush")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Import Zed Skin" })).not.toBeChecked()
    expect(importButton()).toHaveTextContent("Import 2 clients")
  })

  it("flags a sub-account with no ad account and says how many will import without ad data", async () => {
    await open()
    await screen.findByRole("table")
    expect(screen.getByRole("button", { name: "Meta ad account for Plush" })).toHaveTextContent("No matching ad account")
    expect(screen.getByText("1 selected sub-account has no ad account and will import without ad data.")).toBeInTheDocument()
  })

  it("hides inactive sub-accounts until asked, and says how many", async () => {
    await open()
    await screen.findByRole("table")
    expect(screen.queryByDisplayValue("Quiet Clinic")).not.toBeInTheDocument()
    expect(screen.getByText(/1 inactive hidden/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("switch", { name: "Hide inactive" }))
    expect(screen.getByDisplayValue("Quiet Clinic")).toBeInTheDocument()
  })

  it("never unticks rows a search hides, and says they are hidden", async () => {
    await open()
    await userEvent.type(await screen.findByRole("searchbox"), "zed")
    expect(screen.queryByDisplayValue("Aura")).not.toBeInTheDocument()
    expect(screen.getByText(/2 selected rows hidden by this search/)).toBeInTheDocument()
    expect(importButton()).toHaveTextContent("Import 2 clients")
  })

  it("says so when the search matches nothing", async () => {
    await open()
    await userEvent.type(await screen.findByRole("searchbox"), "nope")
    expect(screen.getByText("No sub-account or ad account matches “nope”.")).toBeInTheDocument()
  })

  it("stops further ticks at the selection limit but still lets one be unticked", async () => {
    const many = Array.from({ length: MAX_IMPORT_SELECTION }, (_, i) => account(`l${i}`, `Clinic ${i}`, { leads_recent_7: true }))
    serve({ review: { prep: { status: "done" }, fb_accounts: [], accounts: [...many, account("extra", "Extra")] } })
    await open()
    await screen.findByRole("table")
    expect(screen.getByRole("checkbox", { name: "Import Extra" })).toBeDisabled()
    expect(screen.getByText(/untick one to pick another/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("checkbox", { name: "Import Clinic 0" }))
    expect(screen.getByRole("checkbox", { name: "Import Extra" })).toBeEnabled()
  })
})

describe("Import: sending", () => {
  it("sends the ticked rows with their edits", async () => {
    await open()
    const name = await screen.findByRole("textbox", { name: "Name in Birdy for Plush" })
    await userEvent.clear(name)
    await userEvent.type(name, "Plush Aesthetics")
    await userEvent.click(screen.getByRole("button", { name: "Meta ad account for Plush" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Plush Ads" }))
    await userEvent.click(importButton())
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.accounts).toEqual([
      { location_id: "loc_1", name: "Aura", meta_ad_account_id: "act_1", ad_account_currency: "GBP", client_status: "Active", lead_collection_method: "unknown" },
      { location_id: "loc_2", name: "Plush Aesthetics", meta_ad_account_id: "act_2", ad_account_currency: "GBP", client_status: "Active", lead_collection_method: "unknown" },
    ])
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onImported).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalledWith("Importing 2 clients. Their data is syncing now.")
  })

  it("says how many were skipped because the plan is full", async () => {
    serve({ result: () => reply({ imported: [{ location_id: "loc_1" }], skipped_limit: [{ location_id: "loc_2" }] }) })
    await open(); await screen.findByRole("table")
    await userEvent.click(importButton())
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("1 client skipped: your plan’s client limit is full."))
    expect(onImported).toHaveBeenCalledOnce()
  })

  it("says they are already in Birdy when nothing new came in, and does not refresh", async () => {
    serve({ result: () => reply({ imported: [], skipped_existing: [{ location_id: "loc_1" }] }) })
    await open(); await screen.findByRole("table")
    await userEvent.click(importButton())
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Those clients are already in Birdy."))
    expect(onImported).not.toHaveBeenCalled()
  })

  it("stays open and says nothing was added when the import is refused", async () => {
    serve({ result: () => reply({ detail: "GoHighLevel is not connected." }, { ok: false, status: 400 }) })
    await open(); await screen.findByRole("table")
    await userEvent.click(importButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("GoHighLevel is not connected.")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(importButton()).toBeEnabled()
  })
})
