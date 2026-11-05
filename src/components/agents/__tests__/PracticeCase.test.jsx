import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"
import { PracticeCase, followUpMessage } from "../PracticeCase"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const LIVE = {
  case_id: "c1",
  rule_kind: "pause_over_target",
  client_name: "Tylaesthetics",
  title: "Pause “Botox – Static 4”",
  facts: [
    { label: "Spend", value: "€71" },
    { label: "CPL", value: "€71 vs €22 target" },
  ],
  options: ["Pause", "Leave it", "Flag"],
  birdy_answer: "Pause",
  why: "Over 1.5× target after €60.",
}

const PAUSED = {
  ...LIVE,
  case_id: "c2",
  rule_kind: "revive_winner",
  title: "Revive “Peel – Carousel”",
  options: ["Revive", "Leave it"],
  birdy_answer: "Revive",
  why: "Beat target and creative is under 90 days.",
}

const calls = (path) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && init?.method === "POST")

let answerBody
beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  answerBody = { agreed: true, birdy_answer: "Pause", why: LIVE.why }
  vi.mocked(apiRequest).mockImplementation((path) => {
    if (path === "/api/agents/ag1/practice/c1") return Promise.resolve(res(answerBody))
    if (path === "/api/agents/ag1/practice/c1/resolve") return Promise.resolve(res({ resolution: "user_right" }))
    return Promise.resolve(res({}, 404))
  })
})

describe("PracticeCase", () => {
  it("hides Birdy's answer until the user answers", async () => {
    const onAnswered = vi.fn()
    render(<PracticeCase agentId="ag1" case={LIVE} onAnswered={onAnswered} />)
    expect(screen.getByText("Tylaesthetics", { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/€71 vs €22 target/)).toBeInTheDocument()
    expect(screen.queryByText(LIVE.why)).not.toBeInTheDocument()
    expect(screen.queryByText(/Birdy agrees/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(await screen.findByText(/Birdy agrees/)).toBeInTheDocument()
    expect(screen.getByText(LIVE.why)).toBeInTheDocument()
    expect(JSON.parse(calls("/api/agents/ag1/practice/c1")[0][1].body)).toEqual({ answer: "Pause" })
    expect(onAnswered).toHaveBeenCalledWith(answerBody)
    // Answered: the options are gone.
    expect(screen.queryByRole("button", { name: "Leave it" })).not.toBeInTheDocument()
  })

  it("mismatch offers both resolutions and posts resolve", async () => {
    answerBody = { agreed: false, birdy_answer: "Pause", why: LIVE.why }
    const onAskFollowUp = vi.fn()
    const onResolved = vi.fn()
    render(
      <PracticeCase
        agentId="ag1"
        case={LIVE}
        onAnswered={vi.fn()}
        onResolved={onResolved}
        onAskFollowUp={onAskFollowUp}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Leave it" }))
    expect(await screen.findByText(/Birdy would have: Pause/)).toBeInTheDocument()
    expect(screen.getByText(LIVE.why, { exact: false })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Birdy is right" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "I am, update the rule" }))
    await waitFor(() => expect(calls("/api/agents/ag1/practice/c1/resolve")).toHaveLength(1))
    expect(JSON.parse(calls("/api/agents/ag1/practice/c1/resolve")[0][1].body)).toEqual({ resolution: "user_right" })
    await waitFor(() => expect(onAskFollowUp).toHaveBeenCalledWith(LIVE, "Leave it"))
    expect(onResolved).toHaveBeenCalledWith("user_right")
    expect(screen.queryByRole("button", { name: "Birdy is right" })).not.toBeInTheDocument()
  })

  it("Birdy is right resolves as birdy_right without a follow-up", async () => {
    answerBody = { agreed: false, birdy_answer: "Pause", why: LIVE.why }
    const onAskFollowUp = vi.fn()
    vi.mocked(apiRequest).mockImplementation((path) =>
      Promise.resolve(
        res(path.endsWith("/resolve") ? { resolution: "birdy_right" } : answerBody)
      )
    )
    render(<PracticeCase agentId="ag1" case={LIVE} onAnswered={vi.fn()} onAskFollowUp={onAskFollowUp} />)
    await userEvent.click(screen.getByRole("button", { name: "Flag" }))
    await userEvent.click(await screen.findByRole("button", { name: "Birdy is right" }))
    await waitFor(() =>
      expect(JSON.parse(calls("/api/agents/ag1/practice/c1/resolve")[0][1].body)).toEqual({ resolution: "birdy_right" })
    )
    expect(onAskFollowUp).not.toHaveBeenCalled()
  })

  it("live ad shows Pause/Leave it/Flag, paused ad shows Revive/Leave it", () => {
    const { unmount } = render(<PracticeCase agentId="ag1" case={LIVE} onAnswered={vi.fn()} />)
    const names = () => screen.getAllByRole("button").map((b) => b.textContent)
    expect(names()).toEqual(["Pause", "Leave it", "Flag"])
    unmount()
    render(<PracticeCase agentId="ag1" case={PAUSED} onAnswered={vi.fn()} />)
    expect(names()).toEqual(["Revive", "Leave it"])
  })

  it("an already answered case says so, drops its options and re-syncs", async () => {
    vi.mocked(apiRequest).mockImplementation(() =>
      Promise.resolve(res({ detail: "This case is already answered" }, 409))
    )
    const onStale = vi.fn()
    render(<PracticeCase agentId="ag1" case={LIVE} onAnswered={vi.fn()} onStale={onStale} />)
    await userEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(await screen.findByText(/already answered/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(onStale).toHaveBeenCalledWith(LIVE)
  })

  it("a follow-up the chat could not take offers Send to Birdy", async () => {
    answerBody = { agreed: false, birdy_answer: "Pause", why: LIVE.why }
    const onAskFollowUp = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<PracticeCase agentId="ag1" case={LIVE} onAnswered={vi.fn()} onAskFollowUp={onAskFollowUp} />)
    await userEvent.click(screen.getByRole("button", { name: "Leave it" }))
    await userEvent.click(await screen.findByRole("button", { name: "I am, update the rule" }))
    expect(await screen.findByText(/Couldn't send this to the chat/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Send to Birdy" }))
    expect(await screen.findByText("Birdy will ask about it in the chat")).toBeInTheDocument()
    expect(onAskFollowUp).toHaveBeenCalledTimes(2)
    expect(onAskFollowUp).toHaveBeenLastCalledWith(LIVE, "Leave it")
    // Resolve was posted once; the retry only re-sends the message.
    expect(calls("/api/agents/ag1/practice/c1/resolve")).toHaveLength(1)
  })

  it("puts Who's right? on its own line after why", async () => {
    answerBody = { agreed: false, birdy_answer: "Pause", why: LIVE.why }
    render(<PracticeCase agentId="ag1" case={LIVE} onAnswered={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Flag" }))
    expect(await screen.findByText("Who's right?")).toBeInTheDocument()
    expect(screen.getByText(LIVE.why).tagName).toBe("P")
  })

  it("builds the follow-up chat message", () => {
    expect(followUpMessage(LIVE, "Leave it")).toBe(
      "Practice case c1: I chose Leave it. Spend: €71, CPL: €71 vs €22 target"
    )
  })
})
