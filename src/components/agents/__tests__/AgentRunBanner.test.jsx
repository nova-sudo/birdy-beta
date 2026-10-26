import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { AgentRunBanner } from "../AgentRunBanner"

const res = (body) => ({ ok: true, status: 200, json: async () => body })

const renderWith = (agents) => {
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockResolvedValue(res(agents))
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <AgentRunBanner />
    </SWRConfig>
  )
}

describe("AgentRunBanner", () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset())

  it("asks to reconnect Meta when the last run was skipped for the token", async () => {
    renderWith([{ id: "ag1", status: "active", last_run: { status: "skipped_token" } }])
    expect(await screen.findByText("Reconnect Meta so your agent can run")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to Settings" })).toHaveAttribute("href", "/settings?tab=integrations")
  })

  it("stays hidden after a normal run", async () => {
    renderWith([{ id: "ag1", status: "active", last_run: { status: "ok" } }])
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(screen.queryByText("Reconnect Meta so your agent can run")).not.toBeInTheDocument()
  })
})
