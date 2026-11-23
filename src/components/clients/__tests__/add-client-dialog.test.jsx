import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/cache", () => ({ clearCache: vi.fn() }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { AddClientDialog } from "../add-client/add-client-dialog"

const reply = (body, { ok = true, status = 200 } = {}) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
const LOCATIONS = [{ locationId: "loc_1", name: "Glow Leeds" }, { locationId: "loc_2", name: "Glow York" }]
const ACCOUNTS = [{ id: "act_1", name: "Glow Ads", currency: "GBP" }, { id: "act_2", name: "Shared Ads", currency: "GBP" }]
const CAMPAIGNS = [{ id: "c1", name: "Body Sculpting", effective_status: "ACTIVE" }, { id: "c2", name: "Taken one", effective_status: "PAUSED", claimed_by: { group_id: "g9", name: "Healthy Glow" } }]
const GROUPS = [{ id: "g9", name: "Healthy Glow", ghl_location_id: "loc_2", meta_ad_account_id: "act_2", meta_campaign_ids: null }]

let created
function serve({ locations = LOCATIONS, accounts = ACCOUNTS, campaigns = CAMPAIGNS, create = () => reply({ client_group: { id: "new" } }), locationsFail = false, campaignsFail = false } = {}) {
  created = null
  apiRequest.mockImplementation((url, options) => {
    if (url === "/api/subaccount/locations") return locationsFail ? reply({ detail: "GoHighLevel is not connected." }, { ok: false, status: 500 }) : reply({ locations })
    if (url === "/api/facebook/adaccounts") return reply({ data: { data: accounts } })
    if (/\/api\/facebook\/adaccounts\/.+\/campaigns/.test(url)) return campaignsFail ? reply({ detail: "Meta timed out." }, { ok: false, status: 502 }) : reply({ campaigns })
    if (url === "/api/client-groups" && options?.method === "POST") { created = JSON.parse(options.body); return create() }
    return reply({})
  })
}

const onOpenChange = vi.fn()
const onCreated = vi.fn()
const onImportInstead = vi.fn()
const open = () => render(<AddClientDialog open onOpenChange={onOpenChange} clientGroups={GROUPS} onCreated={onCreated} onImportInstead={onImportInstead} />)
const next = () => userEvent.click(screen.getByRole("button", { name: "Continue" }))
const pick = async (role, name) => userEvent.click(await screen.findByRole(role, { name }))

async function toStep(n) {
  await userEvent.type(screen.getByLabelText("Client name"), "Glow Aesthetics")
  if (n === 1) return
  await next(); await pick("radio", /Glow Leeds/)
  if (n === 2) return
  // The Meta step's two pages: the ad account, then its campaigns.
  await next(); await pick("radio", /Glow Ads/); await next(); await screen.findByRole("checkbox", { name: /All campaigns/ })
  if (n === 3) return
  await next(); await pick("radio", /Hot Prospector/)
  if (n === 4) return
  await next(); await screen.findByRole("radio", { name: /Ask later/ })
}

beforeEach(() => { vi.clearAllMocks(); serve() })

describe("Add client: the steps and their rules", () => {
  it("needs a name before it will continue", async () => {
    open()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Client name"), "   ")
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Client name"), "Glow")
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
  })

  it("needs a sub-account when the agency has any, and labels ones already used", async () => {
    open(); await toStep(1); await next()
    expect(await screen.findByRole("radio", { name: /Glow York/ })).toHaveTextContent("Used by Healthy Glow")
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    await pick("radio", /Glow Leeds/)
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
  })

  it("passes straight through a step whose list is empty", async () => {
    serve({ locations: [] })
    open(); await toStep(1); await next()
    expect(await screen.findByText(/No GoHighLevel sub-accounts found/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
  })

  it("offers all campaigns on an ad account nobody else uses", async () => {
    open(); await toStep(3)
    expect(screen.getByRole("checkbox", { name: /All campaigns/ })).toBeChecked()
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
  })

  it("requires its own campaigns on an ad account another client uses, and blocks campaigns already taken", async () => {
    open(); await toStep(2); await next()
    await pick("radio", /Shared Ads/); await next()
    expect(await screen.findByRole("checkbox", { name: /Body Sculpting/ })).toBeInTheDocument()
    expect(screen.getByText(/Healthy Glow keeps the rest/)).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: /All campaigns/ })).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /Taken one/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    expect(screen.getByText("Pick at least one campaign to continue.")).toBeInTheDocument()
    await pick("checkbox", /Body Sculpting/)
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
  })

  it("needs a call provider, and defaults the lead source to Ask later", async () => {
    open(); await toStep(3); await next()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    await pick("radio", /Hot Prospector/); await next()
    expect(await screen.findByRole("radio", { name: /Ask later/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("button", { name: "Add client" })).toBeEnabled()
  })

  it("keeps earlier answers when going back", async () => {
    open(); await toStep(4)
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("checkbox", { name: /All campaigns/ })).toBeChecked()
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("radio", { name: /Glow Ads/ })).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("radio", { name: /Glow Leeds/ })).toHaveAttribute("aria-checked", "true")
  })

  it("offers the bulk import from the first step", async () => {
    open()
    await userEvent.click(screen.getByRole("button", { name: "Import instead" }))
    expect(onImportInstead).toHaveBeenCalledOnce()
  })
})

const back = () => userEvent.click(screen.getByRole("button", { name: "Back" }))

describe("Add client: the Meta step’s two pages", () => {
  it("shows only the ad accounts first, then the campaigns of the chosen one", async () => {
    open(); await toStep(2); await next()
    expect(await screen.findByRole("radio", { name: /Glow Ads/ })).toBeInTheDocument()
    expect(screen.getByText("Meta · 1 of 2: ad account")).toBeInTheDocument()
    expect(screen.queryByText(/Campaigns in/)).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    await pick("radio", /Glow Ads/)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    await next()
    expect(await screen.findByRole("checkbox", { name: /All campaigns/ })).toBeChecked()
    expect(screen.getByText("Meta · 2 of 2: campaigns")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Campaigns in Glow Ads" })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /Glow Ads/ })).not.toBeInTheDocument()
  })

  it("goes back from the campaigns page to the ad accounts with the account and campaigns kept", async () => {
    open(); await toStep(3)
    await pick("checkbox", /Body Sculpting/)
    expect(screen.getByRole("checkbox", { name: /All campaigns/ })).not.toBeChecked()
    await back()
    expect(await screen.findByRole("radio", { name: /Glow Ads/ })).toHaveAttribute("aria-checked", "true")
    // Re-picking the same account keeps its campaigns.
    await pick("radio", /Glow Ads/); await next()
    expect(await screen.findByRole("checkbox", { name: /Body Sculpting/ })).toBeChecked()
    await back(); await back()
    expect(await screen.findByRole("radio", { name: /Glow Leeds/ })).toHaveAttribute("aria-checked", "true")
  })

  it("resets the campaign choice when the ad account changes", async () => {
    open(); await toStep(3)
    await pick("checkbox", /Body Sculpting/)
    await back(); await pick("radio", /Shared Ads/); await next()
    expect(await screen.findByRole("checkbox", { name: /Body Sculpting/ })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    await back(); await pick("radio", /Glow Ads/); await next()
    expect(await screen.findByRole("checkbox", { name: /All campaigns/ })).toBeChecked()
  })

  it("skips the campaigns page when the agency has no ad accounts", async () => {
    serve({ accounts: [] })
    open(); await toStep(2); await next()
    expect(await screen.findByText(/No Meta ad accounts found/)).toBeInTheDocument()
    expect(screen.queryByText(/1 of 2/)).not.toBeInTheDocument()
    await next()
    expect(await screen.findByRole("radio", { name: /Hot Prospector/ })).toBeInTheDocument()
    await back()
    expect(await screen.findByText(/No Meta ad accounts found/)).toBeInTheDocument()
  })

  it("says plainly what a failed campaign list means: every campaign for an unshared account", async () => {
    serve({ campaignsFail: true })
    open(); await toStep(2); await next(); await pick("radio", /Glow Ads/); await next()
    expect(await screen.findByRole("alert")).toHaveTextContent("Meta timed out.")
    expect(screen.getByText(/This client will use every campaign/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
  })

  it("blocks a shared account whose campaigns fail to load, and says why", async () => {
    serve({ campaignsFail: true })
    open(); await toStep(2); await next(); await pick("radio", /Shared Ads/); await next()
    expect(await screen.findByText(/Campaigns must load before you continue/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  it("says so when every campaign of a shared account is taken", async () => {
    serve({ campaigns: [CAMPAIGNS[1]] })
    open(); await toStep(2); await next(); await pick("radio", /Shared Ads/); await next()
    expect(await screen.findByText(/Every campaign in this ad account already belongs to another client/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })
})

describe("Add client: creating", () => {
  it("sends what today’s wizard sends, then closes and refreshes", async () => {
    open(); await toStep(5)
    await pick("radio", /Meta Instant Forms/)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(created).toEqual({
      name: "Glow Aesthetics", ghl_location_id: "loc_1", meta_ad_account_id: "act_1", hotprospector_group_id: null, ad_account_currency: "GBP",
      meta_campaign_ids: null, call_log_provider: "hotprospector", lead_collection_method: "instant_form", notes: "",
    })
    expect(onCreated).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalledOnce()
  })

  it("sends only the chosen campaigns for a shared ad account", async () => {
    open(); await toStep(2); await next()
    await pick("radio", /Shared Ads/); await next(); await pick("checkbox", /Body Sculpting/)
    await next(); await pick("radio", /GoHighLevel/); await next()
    await userEvent.click(await screen.findByRole("button", { name: "Add client" }))
    await waitFor(() => expect(created).not.toBeNull())
    expect(created).toMatchObject({ meta_ad_account_id: "act_2", meta_campaign_ids: ["c1"], call_log_provider: "ghl", lead_collection_method: "unknown" })
  })

  it("sends the same payload after going back and forth between the Meta pages", async () => {
    open(); await toStep(3)
    await pick("checkbox", /Body Sculpting/)
    await back(); await next(); await next()
    await pick("radio", /GoHighLevel/); await next()
    await userEvent.click(await screen.findByRole("button", { name: "Add client" }))
    await waitFor(() => expect(created).not.toBeNull())
    expect(created).toEqual({
      name: "Glow Aesthetics", ghl_location_id: "loc_1", meta_ad_account_id: "act_1", hotprospector_group_id: null, ad_account_currency: "GBP",
      meta_campaign_ids: ["c1"], call_log_provider: "ghl", lead_collection_method: "unknown", notes: "",
    })
  })

  it("sends no ad account or campaigns when the agency has none", async () => {
    serve({ accounts: [] })
    open(); await toStep(2); await next(); await screen.findByText(/No Meta ad accounts found/)
    await next(); await pick("radio", /Hot Prospector/); await next()
    await userEvent.click(await screen.findByRole("button", { name: "Add client" }))
    await waitFor(() => expect(created).not.toBeNull())
    expect(created).toMatchObject({ meta_ad_account_id: null, ad_account_currency: null, meta_campaign_ids: null })
  })

  it("says the plan is full and points to billing, keeping the dialog open", async () => {
    serve({ create: () => reply({ detail: { code: "CLIENT_LIMIT_REACHED" } }, { ok: false, status: 402 }) })
    open(); await toStep(5)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    expect(await screen.findByText(/client limit is full/)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Go to billing" }))
    expect(push).toHaveBeenCalledWith("/billing")
  })

  it("names the client that already uses the account and offers to change it", async () => {
    serve({ create: () => reply({ detail: 'A client group named "Healthy Glow" already uses this location.' }, { ok: false, status: 409 }) })
    open(); await toStep(5)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("already linked to “Healthy Glow”")
    await userEvent.click(within(alert).getByRole("button", { name: "Change GoHighLevel" }))
    expect(await screen.findByRole("radio", { name: /Glow Leeds/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("sends Change Meta to the ad account page", async () => {
    serve({ create: () => reply({ detail: 'A client group named "Healthy Glow" already uses this ad account.' }, { ok: false, status: 409 }) })
    open(); await toStep(5)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    await userEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Change Meta" }))
    expect(await screen.findByRole("radio", { name: /Glow Ads/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("Meta · 1 of 2: ad account")).toBeInTheDocument()
  })

  it("stays open with the answers kept when the server refuses for another reason", async () => {
    serve({ create: () => reply({ detail: "Meta is not connected." }, { ok: false, status: 400 }) })
    open(); await toStep(5)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Meta is not connected.")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole("button", { name: "Add client" })).toBeEnabled()
  })

  it("says nothing was created when the request cannot be sent", async () => {
    serve({ create: () => Promise.reject(new Error("offline")) })
    open(); await toStep(5)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("nothing was created")
  })
})

describe("Add client: a list that will not load", () => {
  it("says so and retries", async () => {
    serve({ locationsFail: true })
    open(); await toStep(1); await next()
    expect(await screen.findByRole("alert")).toHaveTextContent("GoHighLevel is not connected.")
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    serve()
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("radio", { name: /Glow Leeds/ })).toBeInTheDocument()
  })
})
