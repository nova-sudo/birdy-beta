import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useSuggestions } from "../use-suggestions"

const apiRequest = vi.fn()
const apply = vi.fn()
const dismiss = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/app/dashboard/usePortfolioData", () => ({ applySuggestionRequest: (...a) => apply(...a), dismissSuggestionRequest: (...a) => dismiss(...a) }))
vi.mock("@/lib/agents-api", () => ({ revalidateAgentWork: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn() }) }))

const wrapper = ({ children }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
const SUMMARY = { suggestions: [{ id: "1", title: "Pause Body Sculpting", client: "Aura", severity: "HIGH" }, { id: "2", title: "Refresh the creative", client: "Fallon Physique" }], activity: [] }

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve(SUMMARY) })
})

describe("useSuggestions", () => {
  it("moves a dismissed suggestion out of the list and into the history", async () => {
    dismiss.mockResolvedValue(true)
    const { result } = renderHook(() => useSuggestions(), { wrapper })
    await waitFor(() => expect(result.current.suggestions).toHaveLength(2))
    await act(() => result.current.dismiss(result.current.suggestions[1]))
    expect(dismiss).toHaveBeenCalledWith("2")
    expect(result.current.suggestions.map((s) => s.id)).toEqual(["1"])
    expect(result.current.history[0]).toMatchObject({ what: "Refresh the creative", client: "Fallon Physique", mode: "Dismissed" })
  })

  it("puts a suggestion back, with no history entry, when dismissing fails", async () => {
    dismiss.mockResolvedValue(false)
    const { result } = renderHook(() => useSuggestions(), { wrapper })
    await waitFor(() => expect(result.current.suggestions).toHaveLength(2))
    await act(() => result.current.dismiss(result.current.suggestions[0]))
    expect(result.current.suggestions).toHaveLength(2)
    expect(result.current.history).toEqual([])
  })

  it("records an applied suggestion as approved, and leaves a refused one where it was", async () => {
    apply.mockResolvedValueOnce({ ok: true, succeeded: ["ad1"] })
    const { result } = renderHook(() => useSuggestions(), { wrapper })
    await waitFor(() => expect(result.current.suggestions).toHaveLength(2))
    await act(() => result.current.apply(result.current.suggestions[0]))
    expect(result.current.history[0]).toMatchObject({ what: "Pause Body Sculpting", mode: "Approved" })
    apply.mockResolvedValueOnce({ ok: false, blocked_reason: { message: "Ad account disconnected" } })
    await act(() => result.current.apply(result.current.suggestions[0]))
    expect(result.current.suggestions.map((s) => s.id)).toEqual(["2"])
    expect(result.current.history).toHaveLength(1)
  })
})
