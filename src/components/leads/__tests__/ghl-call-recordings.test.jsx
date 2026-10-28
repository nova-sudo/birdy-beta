import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { withGhlCalls } from "@/lib/lead-detail"
import { CallMedia } from "../LeadCallsTab"

const ghlCall = {
  id: "ghl:m1",
  ghl_message_id: "m1",
  source: "ghl",
  direction: "outbound",
  status: "completed",
  duration_seconds: 42,
  started_at: "2026-07-17T10:00:00+00:00",
  recording_url: null,
  recording_path: "/api/leads/contact/c1/calls/m1/recording",
  transcript_path: "/api/leads/contact/c1/calls/m1/transcript",
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => "blob:rec")
  globalThis.URL.revokeObjectURL = vi.fn()
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
})

describe("withGhlCalls", () => {
  const detail = { calls: [{ id: "hp1", direction: "outbound", status: "no-answer" }], engagement: { touchpoints: 1, dials: 1, answered: 0 } }

  it("adds GHL calls with backend paths and counts them", () => {
    const out = withGhlCalls(detail, [{ ...ghlCall, recording_path: undefined, transcript_path: undefined }], "c 1")
    expect(out.calls.map((c) => c.id)).toEqual(["hp1", "ghl:m1"])
    expect(out.calls[1].recording_path).toBe("/api/leads/contact/c%201/calls/m1/recording")
    expect(out.calls[1].transcript_path).toBe("/api/leads/contact/c%201/calls/m1/transcript")
    expect(out.engagement).toEqual({ touchpoints: 2, dials: 2, answered: 1 })
  })

  it("returns the detail untouched without GHL calls", () => {
    expect(withGhlCalls(detail, [], "c1")).toBe(detail)
  })
})

describe("GHL call recording", () => {
  it("loads the audio only when play is pressed, then plays it", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(["x"]) })
    const { container } = render(<CallMedia call={ghlCall} />)

    expect(apiRequest).not.toHaveBeenCalled()
    expect(container.querySelector("audio")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Play recording" }))

    await waitFor(() => expect(container.querySelector("audio")).toHaveAttribute("src", "blob:rec"), { timeout: 3000 })
    expect(apiRequest).toHaveBeenCalledWith(ghlCall.recording_path)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it("says No recording when GHL has none", async () => {
    apiRequest.mockResolvedValue({ ok: false, status: 404 })
    render(<CallMedia call={ghlCall} />)
    fireEvent.click(screen.getByRole("button", { name: "Play recording" }))
    expect(await screen.findByText("No recording")).toBeInTheDocument()
  })

  it("asks to reconnect on 409", async () => {
    apiRequest.mockResolvedValue({ ok: false, status: 409 })
    render(<CallMedia call={ghlCall} />)
    fireEvent.click(screen.getByRole("button", { name: "Play recording" }))
    expect(await screen.findByText(/Reconnect GoHighLevel to play call recordings/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/settings")
  })

  it("keeps the button to retry after a failure", async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 502 })
    render(<CallMedia call={ghlCall} />)
    fireEvent.click(screen.getByRole("button", { name: "Play recording" }))
    expect(await screen.findByText("Couldn't load the recording.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Play recording" })).toBeEnabled()
  })
})

describe("GHL call transcript", () => {
  const open = (container) => {
    const details = container.querySelector("details")
    details.open = true
    fireEvent(details, new Event("toggle"))
  }

  it("fetches the transcript the first time it opens", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200, json: async () => ({ transcript: "Hi there\nHello" }) })
    const { container } = render(<CallMedia call={ghlCall} />)
    open(container)
    expect(await screen.findByText(/Hi there/)).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith(ghlCall.transcript_path)
  })

  it("says when there is no transcript", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200, json: async () => ({ transcript: null }) })
    const { container } = render(<CallMedia call={ghlCall} />)
    open(container)
    expect(await screen.findByText("No transcript for this call.")).toBeInTheDocument()
  })
})
