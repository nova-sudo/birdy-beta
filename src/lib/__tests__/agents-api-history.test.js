import { describe, it, expect, vi } from "vitest"

let options
vi.mock("swr", () => ({
  default: (_key, _fetcher, opts) => {
    options = opts
    return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() }
  },
}))
vi.mock("swr/infinite", () => ({ default: vi.fn() }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))

import { historySettled, useAgentHistory } from "../agents-api"

const c = (status) => ({ client_group_id: status, name: status, status, error: null })

describe("history polling", () => {
  it("polls every 10s while a client is pending or running", () => {
    useAgentHistory("ag1")
    expect(options.refreshInterval(undefined)).toBe(10_000)
    expect(options.refreshInterval({ total: 3, ready: 1, clients: [c("ready"), c("running"), c("pending")] })).toBe(10_000)
  })

  it("stops once every client is ready or errored", () => {
    useAgentHistory("ag1")
    expect(options.refreshInterval({ total: 2, ready: 2, clients: [c("ready"), c("ready")] })).toBe(0)
    expect(options.refreshInterval({ total: 3, ready: 2, clients: [c("ready"), c("ready"), c("error")] })).toBe(0)
    expect(options.refreshInterval({ total: 2, ready: 0, clients: [c("error"), c("error")] })).toBe(0)
  })

  it("treats missing history as not settled", () => {
    expect(historySettled(undefined)).toBe(false)
  })
})
