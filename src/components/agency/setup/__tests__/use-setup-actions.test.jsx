import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import "@/components/by/__tests__/jsdom"
import { useSetupActions } from "../use-setup-actions"

const replies = {}
const handoff = vi.fn()
vi.mock("@/lib/oauth-handoff", () => ({ setOAuthHandoff: (p) => handoff(p) }))
vi.mock("@/lib/api", () => ({
  apiRequest: async (url, opts = {}) => {
    const [status, body] = replies[`${opts.method || "GET"} ${url}`] ?? [200, {}]
    return { ok: status < 400, status, json: async () => body }
  },
}))

beforeEach(() => { vi.clearAllMocks(); for (const k of Object.keys(replies)) delete replies[k] })

describe("useSetupActions", () => {
  it.each([["ghl", "/api/connect"], ["meta", "/api/connect/facebook"], ["slack", "/api/connect/slack"]])("leaves for %s's login after parking the way back", async (id, url) => {
    replies[`GET ${url}`] = [200, { auth_url: `https://${id}.example/auth` }]
    const go = vi.fn()
    const { result } = renderHook(() => useSetupActions(vi.fn(), { go }))
    await act(() => result.current.startOAuth(id))
    expect(handoff).toHaveBeenCalledWith("/welcome")
    expect(go).toHaveBeenCalledWith(`https://${id}.example/auth`)
    expect(result.current.pending[id]).toBe("connecting")
  })

  it("stays put and says why when there is no login to go to", async () => {
    replies["GET /api/connect/slack"] = [200, {}]
    const go = vi.fn()
    const { result } = renderHook(() => useSetupActions(vi.fn(), { go }))
    await act(() => result.current.startOAuth("slack"))
    expect(go).not.toHaveBeenCalled()
    expect(result.current.pending.slack).toBe("error")
  })

  it("reports a rejected Hot Prospector key", async () => {
    replies["POST /api/hotprospector/connect"] = [400, { detail: "Invalid API key" }]
    const refresh = vi.fn()
    const { result } = renderHook(() => useSetupActions(refresh))
    let ok
    await act(async () => { ok = await result.current.connectHp("u", "k") })
    expect(ok).toBe(false)
    expect(result.current.errors.hp).toBe("Invalid API key")
    expect(refresh).not.toHaveBeenCalled()
  })

  it("throws when answers can't be saved, so the step can say so", async () => {
    replies["PUT /api/onboarding/state"] = [500, {}]
    const { result } = renderHook(() => useSetupActions(vi.fn()))
    await expect(result.current.saveAnswers({ sales_tool: "ghl" })).rejects.toThrow(/Couldn’t save/)
  })
})
