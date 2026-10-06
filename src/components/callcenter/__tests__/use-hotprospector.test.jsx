import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── "Call centre not available" once HotProspector is connected ───────────
// Clients imported before HotProspector was connected were set to "no call
// centre" and stayed that way: the panel's only action, "Link a sales tool",
// led to a HotProspector that was already linked. With it connected, the panel
// now offers to switch the clients in view.

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { apiRequest } from "@/lib/api"
import { CallCentreUnavailable } from "../CallCentreUnavailable"
import { groupsWithoutCallCentre } from "@/lib/call-centre-availability"

function hp(connected) {
  vi.mocked(apiRequest).mockImplementation((url, opts = {}) => {
    if (url === "/api/hotprospector/status") return Promise.resolve({ ok: true, json: async () => ({ connected }) })
    if (opts.method === "PATCH") return Promise.resolve({ ok: true, json: async () => ({ updated: 2 }) })
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("CallCentreUnavailable", () => {
  it("still points at Settings while HotProspector isn't connected", async () => {
    hp(false)
    render(<CallCentreUnavailable groupIds={["g1"]} />)
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/hotprospector/status"))
    expect(screen.getByRole("link", { name: "Link a sales tool" })).toHaveAttribute("href", "/settings?tab=integrations")
    expect(screen.queryByRole("button", { name: /Use HotProspector/ })).toBeNull()
  })

  it("offers to switch the clients in view once HotProspector is connected", async () => {
    hp(true)
    const onSwitched = vi.fn()
    const user = userEvent.setup()
    render(<CallCentreUnavailable groupIds={["g1", "g2"]} onSwitched={onSwitched} />)

    const button = await screen.findByRole("button", { name: "Use HotProspector for these 2 clients" })
    expect(screen.queryByRole("link", { name: "Link a sales tool" })).toBeNull()
    await user.click(button)

    await waitFor(() => expect(onSwitched).toHaveBeenCalled())
    const patch = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === "PATCH")
    expect(patch[0]).toBe("/api/client-groups/call-log-provider")
    expect(JSON.parse(patch[1].body)).toEqual({ group_ids: ["g1", "g2"], provider: "hotprospector" })
  })

  it("says 'this client' for one", async () => {
    hp(true)
    render(<CallCentreUnavailable groupIds={["g1"]} />)
    expect(await screen.findByRole("button", { name: "Use HotProspector for this client" })).toBeInTheDocument()
  })
})

describe("groupsWithoutCallCentre", () => {
  const groups = [
    { id: "a", call_log_provider: "none" },
    { id: "b", call_log_provider: "hotprospector" },
    { id: "c", call_log_provider: "none" },
  ]
  it("lists the clients in view that have no call centre", () => {
    expect(groupsWithoutCallCentre(groups, "all")).toEqual(["a", "c"])
    expect(groupsWithoutCallCentre(groups, "c")).toEqual(["c"])
    expect(groupsWithoutCallCentre(groups, "b")).toEqual([])
  })
})
