import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { MemberAnalyzeDialog } from "../MemberAnalyzeDialog"

// The run store is module-level and keyed by name, so each test uses its own agent.
let seq = 0
const member = () => ({ id: `m${++seq}`, name: `Agent ${seq}` })

const estimate = (calls_found) => ({
  calls_found,
  requested: calls_found,
  estimated_credits: 12,
  total_minutes: 30,
  already_transcribed: 0,
})

const call = (n, outcome) => ({
  call_id: `c${n}`,
  lead_name: `Lead ${n}`,
  started_at: "2026-10-21T10:00:00Z",
  duration_seconds: 65,
  summary: `Booked something.\nOUTCOME: ${outcome}`,
})

function mockApi({ found = 10, batches }) {
  const posts = []
  vi.mocked(apiRequest).mockImplementation(async (url, init) => {
    if (url.includes("/member/estimate")) return { ok: true, json: async () => estimate(found) }
    posts.push(JSON.parse(init.body))
    return batches(posts.length, posts[posts.length - 1])
  })
  return posts
}

beforeEach(() => vi.clearAllMocks())

const open = async (user, m) => {
  render(<MemberAnalyzeDialog member={m} />)
  await user.click(screen.getByRole("button", { name: /analyze/i }))
  return screen.findByRole("dialog")
}

describe("MemberAnalyzeDialog", () => {
  it("renders a dash for a member with no name", () => {
    render(<MemberAnalyzeDialog member={{ id: "x", name: "—" }} />)
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("step 1 shows the cost before the confirm button can be used", async () => {
    const user = userEvent.setup()
    mockApi({ found: 10, batches: () => ({ ok: true, json: async () => ({}) }) })
    const dialog = await open(user, member())

    expect(dialog).toHaveAttribute("data-ds", "dialog")
    expect(await within(dialog).findByText(/~12 credits/)).toBeInTheDocument()
    expect(within(dialog).getByText(/30 min of audio/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /analyze 10 calls/i })).toBeEnabled()
    expect(apiRequest).not.toHaveBeenCalledWith("/api/call-analysis/member/analyze", expect.anything())
  })

  it("runs in batches of 15 up to the requested count, then shows results", async () => {
    const user = userEvent.setup()
    const posts = mockApi({
      found: 40,
      batches: (n, body) => ({
        ok: true,
        json: async () => ({
          calls: Array.from({ length: body.limit }, (_, i) => call(n * 100 + i, i === 0 ? "appointment_set" : "voicemail")),
          counts: { selected: body.limit, failed: 0, remaining: 5 },
          next_before: `b${n}`,
        }),
      }),
    })
    const m = member()
    const dialog = await open(user, m)
    const count = within(dialog).getByLabelText(/last how many calls/i)
    await user.clear(count)
    await user.type(count, "40")
    await within(dialog).findByText(/~12 credits/)
    await user.click(within(dialog).getByRole("button", { name: /analyze 40 calls/i }))

    await within(dialog).findByText("Calls analyzed")
    expect(posts.map((p) => p.limit)).toEqual([15, 15, 10])
    expect(posts.map((p) => p.before)).toEqual([null, "b1", "b2"])
    expect(posts[0].agent_name).toBe(m.name)
    expect(within(dialog).getByText("Appointments set").previousSibling).toHaveTextContent("3")
    expect(within(dialog).getByText(/Lead 100/)).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
  })

  it("shows progress while running, and closing the dialog keeps it running", async () => {
    const user = userEvent.setup()
    let release
    mockApi({
      found: 10,
      batches: () => new Promise((resolve) => { release = resolve }),
    })
    const m = member()
    const dialog = await open(user, m)
    await within(dialog).findByText(/~12 credits/)
    await user.click(within(dialog).getByRole("button", { name: /analyze 10 calls/i }))

    const bar = await within(dialog).findByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuemax", "10")
    expect(within(dialog).getByText(/Analyzing calls… 0\/10/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Run in background" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    // The trigger shows the live count rather than "Analyze".
    expect(screen.getByRole("button", { name: /0\/10/ })).toBeInTheDocument()

    await act(async () =>
      release({
        ok: true,
        json: async () => ({ calls: [call(1, "connected")], counts: { selected: 10, failed: 0, remaining: 0 }, next_before: null }),
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`Call analysis for ${m.name} is ready`, expect.anything()))

    // Reopening re-attaches to the finished run.
    await user.click(screen.getByRole("button", { name: /analyze/i }))
    expect(await screen.findByText("Calls analyzed")).toBeInTheDocument()
  })

  it("surfaces a failed run with a way to try again", async () => {
    const user = userEvent.setup()
    mockApi({ found: 10, batches: () => ({ ok: false, status: 402, json: async () => ({}) }) })
    const dialog = await open(user, member())
    await within(dialog).findByText(/~12 credits/)
    await user.click(within(dialog).getByRole("button", { name: /analyze 10 calls/i }))

    expect(await within(dialog).findByText("Out of Birdy Credits — top up to run analyses.")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Try again" }))
    expect(await within(dialog).findByLabelText(/last how many calls/i)).toBeInTheDocument()
  })
})
