// Client settings → Integrations: saving Meta campaigns starts a refresh the
// card must show, rather than "Last Refresh: Never".

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("next/image", () => ({ default: (p) => <img alt={p.alt} /> }))

const { default: IntegrationsContent } = await import("@/components/integrations/IntegrationsContent")

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body })

const group = {
  id: "g1",
  name: "Acme",
  meta_ad_account_id: "act_123",
  meta_campaign_ids: ["c1"],
  meta_scope: { mode: "selected", selected: 1, total: 2, shared: true, unassigned: [] },
  last_meta_refresh: null,
}

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockImplementation(async (url, opts) => {
    if (opts?.method === "PATCH") return ok({ converted: [] })
    if (url.includes("/refresh-status")) return ok({ meta_refresh_status: "running" })
    return ok({
      campaigns: [
        { id: "c1", name: "Spring Sale", effective_status: "ACTIVE", claimed_by: null },
        { id: "c2", name: "Brand Awareness", effective_status: "PAUSED", claimed_by: null },
      ],
    })
  })
})

describe("IntegrationsContent", () => {
  it("shows the Meta refresh as running after campaigns are saved", async () => {
    const onCampaignsSaved = vi.fn()
    const user = userEvent.setup()
    render(<IntegrationsContent group={group} onCampaignsSaved={onCampaignsSaved} />)
    expect(screen.queryByText("Refreshing…")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Edit" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(await within(dialog).findByRole("checkbox", { name: /brand awareness/i }))
    await user.click(within(dialog).getByRole("button", { name: /save campaigns/i }))

    await waitFor(() => expect(onCampaignsSaved).toHaveBeenCalled())
    expect(screen.getByText("Refreshing…")).toBeTruthy()
    expect(screen.getByRole("button", { name: /refreshing/i }).disabled).toBe(true)
  })
})
