// Client settings: choose which campaigns of a shared Meta ad account a group owns.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock("sonner", () => ({ toast }))

const { MetaCampaignsDialog } = await import("@/components/clients/MetaCampaignsDialog")

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body })
const fail = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) })

const CAMPAIGNS = [
  { id: "c1", name: "Spring Sale", effective_status: "ACTIVE", claimed_by: null },
  { id: "c2", name: "Brand Awareness", effective_status: "PAUSED", claimed_by: null },
]

const group = (extra = {}) => ({
  id: "g1",
  name: "Acme",
  meta_ad_account_id: "act_123",
  meta_campaign_ids: ["c1"],
  meta_scope: { mode: "selected", selected: 1, total: 2, shared: true, unassigned: [] },
  ...extra,
})

let patchResponse
beforeEach(() => {
  apiRequest.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
  patchResponse = ok({ meta_campaign_ids: ["c1", "c2"], converted: [], meta_scope: {} })
  apiRequest.mockImplementation(async (url, opts) => {
    if (opts?.method === "PATCH") return patchResponse
    return ok({ campaigns: CAMPAIGNS })
  })
})

function setup(g = group()) {
  const onSaved = vi.fn()
  const onOpenChange = vi.fn()
  render(<MetaCampaignsDialog open group={g} onOpenChange={onOpenChange} onSaved={onSaved} />)
  return { user: userEvent.setup(), onSaved, onOpenChange }
}

const patchCall = () => apiRequest.mock.calls.find(([, o]) => o?.method === "PATCH")
const save = (user) => user.click(screen.getByRole("button", { name: /save campaigns/i }))

describe("MetaCampaignsDialog", () => {
  it("saves the ticked ids via PATCH", async () => {
    const { user, onSaved, onOpenChange } = setup()
    await user.click(await screen.findByRole("checkbox", { name: /brand awareness/i }))
    await save(user)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [url, opts] = patchCall()
    expect(url).toBe("/api/client-groups/g1/meta-campaigns")
    expect(JSON.parse(opts.body)).toEqual({ campaign_ids: ["c1", "c2"] })
    expect(toast.success).toHaveBeenCalledWith("Campaigns saved — Meta data is refreshing")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("sends null when All campaigns is chosen on an unshared account", async () => {
    const { user, onSaved } = setup(
      group({ meta_scope: { mode: "selected", selected: 1, total: 2, shared: false, unassigned: [] } })
    )
    await user.click(await screen.findByRole("checkbox", { name: /all campaigns/i }))
    await save(user)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(JSON.parse(patchCall()[1].body)).toEqual({ campaign_ids: null })
  })

  it("hides All campaigns on a shared account", async () => {
    setup()
    await screen.findByText("Spring Sale")
    expect(screen.queryByRole("checkbox", { name: /all campaigns/i })).toBeNull()
  })

  it("won't save an empty selection", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("checkbox", { name: /spring sale/i }))
    expect(screen.getByRole("button", { name: /save campaigns/i })).toBeDisabled()
    expect(screen.getByText(/pick at least one campaign/i)).toBeInTheDocument()
  })

  it("shows the 409 detail and stays open", async () => {
    patchResponse = fail(409, "Globex already uses Spring Sale")
    const { user, onSaved, onOpenChange } = setup()
    await screen.findByText("Spring Sale")
    await save(user)

    expect(await screen.findByText("Globex already uses Spring Sale")).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("toasts each group that was converted to keep the rest", async () => {
    patchResponse = ok({
      meta_campaign_ids: ["c1"],
      converted: [{ id: "g2", name: "Globex" }],
      meta_scope: {},
    })
    const { user, onSaved } = setup()
    await screen.findByText("Spring Sale")
    await save(user)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith("Campaigns saved — Meta data is refreshing")
    expect(toast.info).toHaveBeenCalledWith("Globex now keeps the remaining campaigns")
  })
})
