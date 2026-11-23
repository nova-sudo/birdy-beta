import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig, useSWRConfig } from "swr"
import { fetcher } from "@/lib/fetcher"
import { useSetup } from "@/lib/use-setup"

const replies = {}
let gate = null
vi.mock("@/lib/api", () => ({
  apiRequest: async (url) => {
    if (url.startsWith("/api/client-groups") && gate) await gate
    const body = url.startsWith("/api/client-groups") ? { client_groups: replies.clients } : replies[url] ?? {}
    return { ok: true, status: 200, json: async () => body }
  },
}))

const wrapper = ({ children }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>{children}</SWRConfig>
)

beforeEach(() => {
  gate = null
  replies["/api/onboarding/status"] = { completed: false, name: "Sam", agency_name: "Northside", default_currency: "GBP", data: { sales_tool: "ghl" } }
  replies["/api/status"] = { facebook: { connected: true }, gohighlevel: { agency: { connected: true } } }
  replies["/api/billing/status"] = { subscribed: true }
  replies.clients = [{ id: "a", name: "Cloud Nine", status: "active" }]
})

describe("useSetup", () => {
  it("stays ready, with the clients it had, while the clients reload", async () => {
    const { result } = renderHook(() => ({ setup: useSetup(), swr: useSWRConfig() }), { wrapper })
    await waitFor(() => expect(result.current.setup.ready).toBe(true))
    expect(result.current.setup.steps.client).toBe("done")

    // Saving targets (or adding a client) clears every cached client list and reloads it.
    let release
    gate = new Promise((r) => { release = r })
    replies.clients = [{ id: "a", name: "Cloud Nine", status: "active", targets: { cpa: 45 } }]
    act(() => { result.current.swr.mutate((k) => typeof k === "string" && k.startsWith("/api/client-groups"), undefined, { revalidate: true }) })

    // The page never goes back to its loading state, and nothing it shows goes missing meanwhile.
    expect(result.current.setup.ready).toBe(true)
    expect(result.current.setup.facts.clients.map((g) => g.name)).toEqual(["Cloud Nine"])
    expect(result.current.setup.steps.client).toBe("done")

    await act(async () => { release() })
    await waitFor(() => expect(result.current.setup.steps.targets).toBe("done"))
    expect(result.current.setup.ready).toBe(true)
  })

  it("isn't ready before the clients have loaded once", async () => {
    gate = new Promise(() => {})
    const { result } = renderHook(() => useSetup(), { wrapper })
    await waitFor(() => expect(result.current.facts.onboarding).not.toBeNull())
    expect(result.current.ready).toBeFalsy()
  })
})
