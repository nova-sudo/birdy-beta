/**
 * The two things the rest of the migration assumes.
 *
 * The freshness window (dedupingInterval) is what makes navigation instant,
 * but it would be a bug if it also swallowed a deliberate refresh — several
 * places refetch straight after a write, and a topped-up credit balance that
 * still reads zero for five minutes is worse than the spinner we removed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import useSWR, { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useClientGroups } from "@/lib/useClientGroups"

const FRESH_FOR_MS = 5 * 60 * 1000

let cache

function wrapper({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        provider: () => cache,
        dedupingInterval: FRESH_FOR_MS,
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}

beforeEach(() => {
  cache = new Map()
  apiRequest.mockReset()
  let n = 0
  apiRequest.mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          url.includes("client-groups")
            ? { client_groups: [{ id: "g1", name: "Aura Dental" }], meta: null }
            : { n: ++n }
        ),
    })
  )
})

describe("the freshness window", () => {
  it("does not refetch a key that is still fresh", async () => {
    const first = renderHook(() => useSWR("/api/thing"), { wrapper })
    await waitFor(() => expect(first.result.current.data).toEqual({ n: 1 }))

    first.unmount()
    const second = renderHook(() => useSWR("/api/thing"), { wrapper })

    expect(second.result.current.data).toEqual({ n: 1 })
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("still refetches when something asks it to", async () => {
    const { result } = renderHook(() => useSWR("/api/thing"), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }))

    // Inside the window a mount would be a no-op. An explicit mutate() — what
    // every refresh() in the app ends up calling — must go to the network.
    await act(async () => {
      await result.current.mutate()
    })

    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ n: 2 })
  })
})

describe("prefetchAfterLogin", () => {
  it("lets the first mount paint without a request of its own", async () => {
    // Against SWR's real default cache, which is what prefetch.js writes to —
    // seeding a bare Map looks the same from outside but carries none of the
    // bookkeeping the freshness window reads, so it would still revalidate.
    const { prefetchAfterLogin } = await import("@/lib/prefetch")
    const { queryKeys } = await import("@/lib/query-keys")
    const { DEFAULT_DATE_PRESET } = await import("@/lib/constants")

    await prefetchAfterLogin()
    const afterPrefetch = apiRequest.mock.calls.length

    function defaultCacheWrapper({ children }) {
      return (
        <SWRConfig value={{ fetcher, dedupingInterval: FRESH_FOR_MS, revalidateOnFocus: false }}>
          {children}
        </SWRConfig>
      )
    }

    const { result } = renderHook(
      () => useClientGroups(DEFAULT_DATE_PRESET),
      { wrapper: defaultCacheWrapper }
    )

    // Figures on screen from the first frame. SWR still revalidates behind
    // this — prefilling the cache doesn't suppress that, which is why the
    // hooks report loading as "nothing to show" rather than passing SWR's
    // isLoading straight through. What the prefetch buys is the absence of a
    // spinner, not the absence of a request.
    expect(result.current.loading).toBe(false)
    expect(result.current.clientGroups).toHaveLength(1)
    expect(afterPrefetch).toBeGreaterThan(0)
  })
})
