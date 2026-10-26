import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"
import { WorkItem } from "../WorkItem"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const PAUSE = {
  id: "s1",
  status: "open",
  agent_id: "ag1",
  rule_kind: "pause_over_target",
  rule_mode: "ask",
  has_action: true,
  client: "Tylaesthetics",
  title: "Pause “Summer BBL – Video 3”",
  description: "£48 CPL vs £22 target",
  stats: [{ label: "Spent", value: "£312", bad: true }],
  blocked_reason: null,
  auto_failed: false,
  undone_at: null,
}

const NO_SPEND = {
  ...PAUSE,
  id: "s2",
  rule_kind: "flag_no_spend",
  rule_mode: "flag",
  has_action: false,
  title: "“Lipo – Broad” spent £0 for 26 hrs",
}

const calls = (path, method) =>
  vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
})

describe("WorkItem", () => {
  it("Approve calls apply and marks done", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true, outcome: "applied", succeeded: ["ad1"], failed: [] }))
    const onDecided = vi.fn()
    render(<WorkItem item={PAUSE} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    expect(calls("/api/dashboard/suggestions/s1/apply", "POST")).toHaveLength(1)
    expect(await screen.findByText("Done in Meta")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(PAUSE, "approved"))
  })

  it("Deny requires a reason before Confirm is enabled, then posts reason_code and note", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true }))
    const onDecided = vi.fn()
    render(<WorkItem item={PAUSE} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Deny" }))
    const confirm = screen.getByRole("button", { name: "Confirm" })
    expect(confirm).toBeDisabled()

    for (const label of [
      "Still learning, give it longer",
      "Client wants it on",
      "Creative is stale",
      "Target is wrong",
      "Something else",
    ]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument()
    }

    await userEvent.click(screen.getByRole("radio", { name: "Creative is stale" }))
    await userEvent.type(screen.getByRole("textbox"), "New video goes live Monday")
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)

    const posts = calls("/api/dashboard/suggestions/s1/deny", "POST")
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0][1].body)).toEqual({ reason_code: "creative_stale", note: "New video goes live Monday" })
    expect(await screen.findByText("Denied")).toBeInTheDocument()
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(PAUSE, "denied"))
  })

  it("flag item shows Got it/Dismiss", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true }))
    const { unmount } = render(<WorkItem item={NO_SPEND} onDecided={vi.fn()} />)

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Deny" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Got it" }))
    expect(calls("/api/dashboard/suggestions/s2/apply", "POST")).toHaveLength(1)
    expect(await screen.findByText("Noted")).toBeInTheDocument()
    unmount()

    render(<WorkItem item={{ ...NO_SPEND, id: "s3" }} onDecided={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(calls("/api/dashboard/suggestions/s3", "DELETE")).toHaveLength(1)
    expect(await screen.findByText("Dismissed")).toBeInTheDocument()
  })

  it("flag-mode item with an action shows only Got it, which dismisses", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true }))
    const item = { ...PAUSE, id: "s4", rule_mode: "flag" }
    render(<WorkItem item={item} onDecided={vi.fn()} />)

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Got it" }))

    expect(calls("/api/dashboard/suggestions/s4", "DELETE")).toHaveLength(1)
    expect(calls("/api/dashboard/suggestions/s4/apply", "POST")).toHaveLength(0)
    expect(await screen.findByText("Noted")).toBeInTheDocument()
  })

  it("Got it on a flag-mode item with nothing to write applies it and settles as Noted", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true, outcome: "applied", succeeded: [], failed: [] }))
    const onDecided = vi.fn()
    const item = { ...NO_SPEND, id: "s5", rule_mode: "flag", has_action: false }
    render(<WorkItem item={item} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Got it" }))

    expect(calls("/api/dashboard/suggestions/s5/apply", "POST")).toHaveLength(1)
    expect(await screen.findByText("Noted")).toBeInTheDocument()
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(item, "handled"))
  })

  it("a failed deny keeps the reason and note for the retry", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ detail: "Applying right now — try again in a moment" }, 409))
    render(<WorkItem item={PAUSE} onDecided={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: "Deny" }))
    await userEvent.click(screen.getByRole("radio", { name: "Target is wrong" }))
    await userEvent.type(screen.getByRole("textbox"), "Client moved the target")
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))

    expect(await screen.findByText(/Applying right now/)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Target is wrong" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("textbox")).toHaveValue("Client moved the target")
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled()

    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true }))
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))
    const posts = calls("/api/dashboard/suggestions/s1/deny", "POST")
    expect(posts).toHaveLength(2)
    expect(JSON.parse(posts[1][1].body)).toEqual({ reason_code: "target_wrong", note: "Client moved the target" })
    expect(await screen.findByText("Denied")).toBeInTheDocument()
  })

  it("blocked item shows reason", async () => {
    const item = {
      ...PAUSE,
      blocked_reason: { code: "daily_cap", message: "Already paused 3 ads for this client today." },
    }
    render(<WorkItem item={item} onDecided={vi.fn()} />)

    expect(screen.getByText("Already paused 3 ads for this client today.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled()
  })

  it("an apply the guardrails block stays open and shows the reason", async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      res({ ok: false, outcome: "blocked", succeeded: [], failed: [], blocked_reason: { code: "protected", message: "This ad is tagged Evergreen." } })
    )
    const onDecided = vi.fn()
    render(<WorkItem item={PAUSE} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    expect(await screen.findByText("This ad is tagged Evergreen.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled()
    expect(onDecided).not.toHaveBeenCalled()
  })

  it("failed apply rolls back and shows Retry", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ detail: "Meta said: ad account disabled" }, 502))
    const onDecided = vi.fn()
    render(<WorkItem item={PAUSE} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Approve" }))

    expect(await screen.findByText(/ad account disabled/)).toBeInTheDocument()
    expect(screen.queryByText("Done in Meta")).not.toBeInTheDocument()
    const retry = screen.getByRole("button", { name: "Retry" })
    expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument()
    expect(onDecided).not.toHaveBeenCalled()

    vi.mocked(apiRequest).mockResolvedValue(res({ ok: true, outcome: "applied", succeeded: ["ad1"], failed: [] }))
    await userEvent.click(retry)
    expect(await screen.findByText("Done in Meta")).toBeInTheDocument()
    expect(calls("/api/dashboard/suggestions/s1/apply", "POST")).toHaveLength(2)
  })
})
