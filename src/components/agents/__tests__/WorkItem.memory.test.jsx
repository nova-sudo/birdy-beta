import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }))

import { apiRequest } from "@/lib/api"
import { WorkItem } from "../WorkItem"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const ITEM = {
  id: "s1",
  status: "open",
  agent_id: "ag1",
  rule_kind: "revive_winner",
  rule_mode: "ask",
  has_action: true,
  client: "Tylaesthetics",
  title: "Revive “Summer BBL – Video 3”",
  description: "",
  stats: [],
  blocked_reason: null,
  auto_failed: false,
  undone_at: null,
}

async function deny() {
  render(<WorkItem item={ITEM} onDecided={vi.fn()} />)
  await userEvent.click(screen.getByRole("button", { name: "Deny" }))
  await userEvent.click(screen.getByRole("radio", { name: "Something else" }))
  await userEvent.click(screen.getByRole("button", { name: "Confirm" }))
}

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  toastMock.mockClear()
})

describe("WorkItem deny toast", () => {
  it("says what Birdy will remember when the deny returns a memory", async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      res({ ok: true, memory: { id: "m1", text: "Don't revive the summer promo", kind: "fact", filter: null } })
    )
    await deny()
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith("Denied. Birdy will remember: Don't revive the summer promo", {
        description: ITEM.title,
      })
    )
  })

  it("keeps the plain toast when nothing was remembered", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true, memory: null }))
    await deny()
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith("Denied. Birdy will remember why.", { description: ITEM.title })
    )
  })
})
