import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import SalesHubPage from "../page"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: vi.fn() }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"

// ─── The Sales Hub for a client who doesn't call anyone ─────────────────────
// Hadley's ask, in her words: "on the sales page, internally within the tool,
// it would show it as 'not available' because they don't use that and give me
// the option to link a sales tool."
//
// Everything on this screen — the six tiles, the trend chart, all four tables
// — is Hot Prospector data. For a client whose `call_log_provider` is "none"
// every one of those renders correctly and says nothing true: six zeroes and
// four empty tables that look like a bad week rather than an absent source.

function group({ id, name, provider }) {
  return {
    id,
    name,
    client_status: "Active",
    call_log_provider: provider,
    hotprospector: {
      // Deliberately populated. If the screen goes grey it has to be because
      // of the provider, not because there was nothing to add up.
      call_stats: { total_calls: 120, leads_with_calls: 40, transfers: 3, total_leads: 90 },
      daily_calls: [{ date: "2026-09-01", calls: 120, inbound: 40, talk_min: 60, called: 40 }],
    },
  }
}

function mockGroups(groups) {
  vi.mocked(useClientGroups).mockReturnValue({
    clientGroups: groups,
    loading: false,
    error: null,
    datePreset: "last_7d",
    setDatePreset: vi.fn(),
    refresh: vi.fn(),
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(() =>
    Promise.resolve({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) })
  )
})

describe("Sales Hub without a call centre", () => {
  it("says the call centre is not available and offers to link one", async () => {
    mockGroups([group({ id: "a", name: "Quiet Co", provider: "none" })])
    render(<SalesHubPage />)

    await waitFor(() =>
      expect(screen.getAllByText(/call centre not/i).length).toBeGreaterThan(0)
    )
    expect(screen.getAllByRole("link", { name: "Link a sales tool" })[0]).toHaveAttribute(
      "href",
      "/settings?tab=integrations"
    )
  })

  it("keeps the six tile labels but replaces every figure", async () => {
    // The labels stay because the reader still needs to know which figures
    // Birdy would be showing them; the numbers go because there is no source.
    mockGroups([group({ id: "a", name: "Quiet Co", provider: "none" })])
    render(<SalesHubPage />)

    await waitFor(() => expect(screen.getByText("Total calls")).toBeInTheDocument())

    const tile = screen.getByText("Total calls").closest("div.flex")
    expect(within(tile).getByText(/Not available/)).toBeInTheDocument()
    // The cached 120 calls must not surface anywhere on the screen.
    expect(document.body.textContent).not.toContain("120")
  })

  it("dims the tile's icon chip along with its figure", async () => {
    // The tile's tone is what says "this is the calls one, this is the
    // talk-time one". Left lit beside a grey dash it reads as a live figure
    // that has gone momentarily missing — the opposite of the truth.
    mockGroups([group({ id: "a", name: "Quiet Co", provider: "none" })])
    render(<SalesHubPage />)

    await waitFor(() => expect(screen.getByText("Total calls")).toBeInTheDocument())

    const tile = screen.getByText("Total calls").closest("div.flex")
    expect(tile.querySelector(".bg-pd-neutral-badge")).not.toBeNull()
    expect(tile.querySelector(".bg-pd-info-bg")).toBeNull()
  })

  it("draws the real figures when a dialler is connected", async () => {
    mockGroups([group({ id: "a", name: "Loud Co", provider: "hotprospector" })])
    render(<SalesHubPage />)

    // Two of them once the chart is drawn: its title and the tile beside it.
    await waitFor(() => expect(screen.getAllByText("Total calls").length).toBeGreaterThan(0))

    expect(screen.queryByRole("link", { name: "Link a sales tool" })).toBeNull()
    expect(screen.getAllByText("120").length).toBeGreaterThan(0)
  })

  it("treats a group with no stored provider as connected", async () => {
    // The field only started being projected with this change. A missing value
    // means "we don't know", and greying a client's real figures because a
    // payload was stale is worse than the zero this replaces.
    mockGroups([group({ id: "a", name: "Legacy Co", provider: undefined })])
    render(<SalesHubPage />)

    await waitFor(() => expect(screen.getAllByText("Total calls").length).toBeGreaterThan(0))
    expect(screen.queryByRole("link", { name: "Link a sales tool" })).toBeNull()
  })

  it("keeps a mixed portfolio's real numbers", async () => {
    // One client without a dialler does not make the portfolio's sums untrue —
    // they are true of fewer clients. Only the all-none case has nothing
    // behind it.
    mockGroups([
      group({ id: "a", name: "Quiet Co", provider: "none" }),
      group({ id: "b", name: "Loud Co", provider: "hotprospector" }),
    ])
    render(<SalesHubPage />)

    await waitFor(() => expect(screen.getAllByText("Total calls").length).toBeGreaterThan(0))
    expect(screen.queryByRole("link", { name: "Link a sales tool" })).toBeNull()
  })
})
