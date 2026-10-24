import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { CallAnalysisButton } from "../CallAnalysisSheet"

const ROW = {
  id: "l1-0",
  caller_name: "Sarah Whitmore",
  agent_name: "Priya Shah",
  direction: "outbound",
  duration: 252,
  call_time: "2026-10-21T14:32:00Z",
  to_number: "+441111",
  recording_url: "https://rec.example/1.mp3",
}

const ANALYSIS = [
  "WHAT HAPPENED: Priya booked a consultation.",
  "WHAT WENT WRONG: Discounted too early.",
  "COACHING: Anchor on aftercare first.",
  "OUTCOME: appointment_set",
].join("\n")

let resolveAnalyze
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(
    () => new Promise((resolve) => { resolveAnalyze = resolve })
  )
})
afterEach(() => vi.useRealTimers())

const finish = (body = { analysis: ANALYSIS }, init = { ok: true, status: 200 }) =>
  act(async () => resolveAnalyze({ ...init, json: async () => body }))

describe("CallAnalysisButton", () => {
  it("shows a dash when the call has no recording", () => {
    render(<CallAnalysisButton row={{ ...ROW, recording_url: null }} />)
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("opens a ds Sheet in the Transcribing state while the request runs", async () => {
    const user = userEvent.setup()
    render(<CallAnalysisButton row={ROW} />)
    await user.click(screen.getByRole("button", { name: /analyze this call/i }))

    const sheet = await screen.findByRole("dialog")
    expect(sheet).toHaveAttribute("data-ds", "sheet")
    expect(sheet).toHaveTextContent("Call analysis — Sarah Whitmore")
    expect(sheet).toHaveTextContent("Priya Shah")
    expect(screen.getByText("Transcribing", { selector: "[data-step]" })).toHaveAttribute("aria-current", "step")

    const [url, init] = vi.mocked(apiRequest).mock.calls[0]
    expect(url).toBe("/api/call_logs/analyze")
    expect(JSON.parse(init.body)).toEqual({
      recording_url: ROW.recording_url,
      agent_name: "Priya Shah",
      lead_name: "Sarah Whitmore",
      direction: "outbound",
      duration_seconds: 252,
    })
  })

  it("moves on to Reviewing after a while", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CallAnalysisButton row={ROW} />)
    await user.click(screen.getByRole("button", { name: /analyze this call/i }))
    await screen.findByRole("dialog")

    await act(async () => vi.advanceTimersByTime(9000))
    expect(screen.getByText("Reviewing", { selector: "[data-step]" })).toHaveAttribute("aria-current", "step")
  })

  it("shows the live sections and the outcome badge, and no Score", async () => {
    const user = userEvent.setup()
    render(<CallAnalysisButton row={ROW} />)
    await user.click(screen.getByRole("button", { name: /analyze this call/i }))
    await screen.findByRole("dialog")
    await finish()

    expect(await screen.findByText("What happened")).toBeInTheDocument()
    expect(screen.getByText("Priya booked a consultation.")).toBeInTheDocument()
    expect(screen.getByText("What went wrong")).toBeInTheDocument()
    expect(screen.getByText("Coaching")).toBeInTheDocument()
    expect(screen.getByText("appointment set")).toBeInTheDocument()
    expect(screen.queryByText(/score/i)).toBeNull()
    expect(toast.success).toHaveBeenCalledWith("Call analysis ready", expect.anything())
  })

  it("reopens a finished analysis without asking the backend again", async () => {
    const user = userEvent.setup()
    render(<CallAnalysisButton row={ROW} />)
    await user.click(screen.getByRole("button", { name: /analyze this call/i }))
    await screen.findByRole("dialog")
    await finish()
    await screen.findByText("What happened")

    await user.click(screen.getAllByRole("button", { name: "Close" }).at(-1))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await user.click(screen.getByRole("button", { name: /view ai analysis/i }))
    expect(await screen.findByText("What happened")).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("keeps running when the sheet is closed, and does not pop it open on completion", async () => {
    const user = userEvent.setup()
    render(<CallAnalysisButton row={ROW} />)
    await user.click(screen.getByRole("button", { name: /analyze this call/i }))
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await finish()
    expect(toast.success).toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("explains an out-of-credits failure and closes the sheet", async () => {
    const user = userEvent.setup()
    render(<CallAnalysisButton row={ROW} />)
    await user.click(screen.getByRole("button", { name: /analyze this call/i }))
    await screen.findByRole("dialog")
    await finish({}, { ok: false, status: 402 })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't analyze this call", {
        description: "Out of Birdy Credits — top up to run analyses.",
      })
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
