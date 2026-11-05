import { describe, it, expect, vi } from "vitest"

// Final review I2: an open tab must not keep showing yesterday's work list.
vi.mock("swr", () => ({ default: vi.fn(() => ({})) }))
vi.mock("swr/infinite", () => ({ default: vi.fn(() => ({})) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))

import useSWR from "swr"
import { useAgentWork } from "@/lib/agents-api"

describe("useAgentWork freshness", () => {
  it("refetches on focus with a short dedupe window", () => {
    useAgentWork("ag1")
    const [key, , config] = vi.mocked(useSWR).mock.calls.at(-1)
    expect(key).toMatch(/ag1\/work$/)
    expect(config.revalidateOnFocus).toBe(true)
    expect(config.dedupingInterval).toBeLessThanOrEqual(60 * 1000)
  })
})
