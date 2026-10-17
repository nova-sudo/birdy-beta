// Campaign checklist for sharing one Meta ad account between client groups.
// value null = every campaign; an array = only those ids.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))

const { MetaCampaignPicker } = await import("@/components/clients/MetaCampaignPicker")

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status = 502) => ({ ok: false, status, json: async () => ({ detail: "Meta failed" }) })

const CAMPAIGNS = [
  { id: "c1", name: "Spring Sale", effective_status: "ACTIVE", claimed_by: null },
  { id: "c2", name: "Brand Awareness", effective_status: "PAUSED", claimed_by: { group_id: "g1", name: "Acme" } },
  { id: "c3", name: "Retargeting", effective_status: "ACTIVE", claimed_by: { group_id: "g2", name: "Globex" } },
]

function setup(props = {}) {
  const onChange = vi.fn()
  render(
    <MetaCampaignPicker adAccountId="act_123" groupId="g1" value={null} onChange={onChange} {...props} />
  )
  return { user: userEvent.setup(), onChange }
}

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockResolvedValue(ok({ campaigns: CAMPAIGNS }))
})

describe("MetaCampaignPicker", () => {
  it("defaults to All campaigns when optional and value is null", async () => {
    setup()
    const all = await screen.findByRole("checkbox", { name: /all campaigns/i })
    expect(all).toHaveAttribute("aria-checked", "true")
    expect(apiRequest.mock.calls[0][0]).toBe("/api/facebook/adaccounts/act_123/campaigns")
    expect(screen.getByRole("checkbox", { name: /spring sale/i })).toHaveAttribute("aria-checked", "false")
  })

  it("hides All campaigns and starts empty when required", async () => {
    setup({ required: true })
    await screen.findByText("Spring Sale")
    expect(screen.queryByRole("checkbox", { name: /all campaigns/i })).toBeNull()
    expect(screen.getByRole("checkbox", { name: /spring sale/i })).toHaveAttribute("aria-checked", "false")
  })

  it("disables a campaign claimed by another group and shows its name", async () => {
    setup()
    const row = await screen.findByRole("checkbox", { name: /retargeting/i })
    expect(row).toBeDisabled()
    expect(row).toHaveTextContent("Globex")
  })

  it("keeps this group's own claimed campaigns selectable", async () => {
    setup({ value: ["c2"] })
    const row = await screen.findByRole("checkbox", { name: /brand awareness/i })
    expect(row).toBeEnabled()
    expect(row).toHaveAttribute("aria-checked", "true")
  })

  it("shows Removed in Meta for a selected id missing from Meta", async () => {
    const { user, onChange } = setup({ value: ["c1", "gone"] })
    const row = await screen.findByRole("checkbox", { name: /removed in meta/i })
    expect(row).toHaveAttribute("aria-checked", "true")
    await user.click(row)
    expect(onChange).toHaveBeenCalledWith(["c1"])
  })

  it("filters rows by search text", async () => {
    const { user } = setup()
    await screen.findByText("Spring Sale")
    await user.type(screen.getByPlaceholderText(/search campaigns/i), "spring")
    expect(screen.getByText("Spring Sale")).toBeInTheDocument()
    expect(screen.queryByText("Brand Awareness")).toBeNull()
  })

  it("shows an error with Retry when loading fails", async () => {
    apiRequest.mockResolvedValueOnce(fail())
    const { user } = setup()
    expect(await screen.findByText(/meta failed/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /retry/i }))
    expect(await screen.findByText("Spring Sale")).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it("calls onChange with the ticked ids", async () => {
    const { user, onChange } = setup({ value: ["c1"] })
    await user.click(await screen.findByRole("checkbox", { name: /brand awareness/i }))
    expect(onChange).toHaveBeenCalledWith(["c1", "c2"])
    expect(screen.getByText("1 of 3 selected")).toBeInTheDocument()
  })

  it("sets null when All campaigns is ticked", async () => {
    const { user, onChange } = setup({ value: ["c1"] })
    await user.click(await screen.findByRole("checkbox", { name: /all campaigns/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("renders the share note", async () => {
    setup({ shareNote: "The rest stay with Acme" })
    expect(await screen.findByText("The rest stay with Acme")).toBeInTheDocument()
  })

  it("ignores a stale fetch that resolves after the ad account changed", async () => {
    let resolveOld
    apiRequest.mockImplementation((path) =>
      path.includes("act_1")
        ? new Promise((r) => { resolveOld = r })
        : Promise.resolve(ok({ campaigns: [{ id: "n1", name: "New Account Camp", effective_status: "ACTIVE", claimed_by: null }] }))
    )
    const onChange = vi.fn()
    const { rerender } = render(
      <MetaCampaignPicker adAccountId="act_1" groupId="g1" value={null} onChange={onChange} />
    )
    rerender(<MetaCampaignPicker adAccountId="act_2" groupId="g1" value={null} onChange={onChange} />)
    expect(await screen.findByText("New Account Camp")).toBeInTheDocument()
    await act(async () => {
      resolveOld(ok({ campaigns: CAMPAIGNS }))
    })
    expect(screen.getByText("New Account Camp")).toBeInTheDocument()
    expect(screen.queryByText("Spring Sale")).toBeNull()
  })
})
