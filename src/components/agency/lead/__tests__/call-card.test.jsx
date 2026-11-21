import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { CallCard } from "../call-card"

const ghlCall = {
  id: "ghl:m1", key: "call-ghl:m1", ghl_message_id: "m1", source: "ghl", direction: "outbound", status: "completed", duration_seconds: 42,
  started_at: "2026-07-17T10:00:00+00:00", recording_url: null,
  recording_path: "/api/leads/contact/c1/calls/m1/recording", transcript_path: "/api/leads/contact/c1/calls/m1/transcript",
}
const play = () => screen.getByRole("button", { name: "Play recording: Outbound · 42s" })

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => "blob:rec")
  globalThis.URL.revokeObjectURL = vi.fn()
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
})

describe("a GoHighLevel call's recording", () => {
  it("loads the audio only when Play is pressed, then plays it", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(["x"]) })
    const { container } = render(<CallCard call={ghlCall} open={false} onToggle={() => {}} />)
    expect(apiRequest).not.toHaveBeenCalled()
    await userEvent.click(play())
    await waitFor(() => expect(container.querySelector("audio")).toHaveAttribute("src", "blob:rec"))
    expect(apiRequest).toHaveBeenCalledWith(ghlCall.recording_path)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it("says there is none on 404, and to reconnect on 409", async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 404 })
    const { unmount } = render(<CallCard call={ghlCall} open={false} onToggle={() => {}} />)
    await userEvent.click(play())
    expect(await screen.findByText("No recording for this call.")).toBeInTheDocument()
    unmount()
    apiRequest.mockResolvedValueOnce({ ok: false, status: 409 })
    render(<CallCard call={ghlCall} open={false} onToggle={() => {}} />)
    await userEvent.click(play())
    expect(await screen.findByText(/Reconnect GoHighLevel to play call recordings/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/settings")
  })

  it("keeps Play to retry after a failure", async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 502 })
    render(<CallCard call={ghlCall} open={false} onToggle={() => {}} />)
    await userEvent.click(play())
    expect(await screen.findByText("Couldn’t load the recording.")).toBeInTheDocument()
    expect(play()).toBeEnabled()
  })

  it("plays a dialer's recording URL as it is", async () => {
    const call = { ...ghlCall, recording_path: undefined, transcript_path: undefined, recording_url: "https://example.com/r.mp3" }
    const { container } = render(<CallCard call={call} open={false} onToggle={() => {}} />)
    await userEvent.click(play())
    expect(container.querySelector("audio")).toHaveAttribute("src", "https://example.com/r.mp3")
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe("a GoHighLevel call's transcript", () => {
  it("is fetched the first time it opens, and handed to the search", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200, json: async () => ({ transcript: "Hi there\nHello" }) })
    const onTranscript = vi.fn()
    const { rerender } = render(<CallCard call={ghlCall} open={false} onToggle={() => {}} onTranscript={onTranscript} />)
    expect(apiRequest).not.toHaveBeenCalled()
    rerender(<CallCard call={ghlCall} open onToggle={() => {}} onTranscript={onTranscript} />)
    expect(await screen.findByText(/Hi there/)).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith(ghlCall.transcript_path)
    expect(onTranscript).toHaveBeenCalledWith("Hi there\nHello")
    rerender(<CallCard call={ghlCall} open={false} onToggle={() => {}} onTranscript={onTranscript} />)
    rerender(<CallCard call={ghlCall} open onToggle={() => {}} onTranscript={onTranscript} />)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("says when there is none", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200, json: async () => ({ transcript: null }) })
    render(<CallCard call={ghlCall} open onToggle={() => {}} />)
    expect(await screen.findByText("No transcript for this call.")).toBeInTheDocument()
  })

  it("offers a retry after a failure", async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 502 })
    apiRequest.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ transcript: "Second time" }) })
    render(<CallCard call={ghlCall} open onToggle={() => {}} />)
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Second time")).toBeInTheDocument()
  })
})

describe("a call nobody answered", () => {
  it("shows what happened, with nothing to play or read", () => {
    render(<CallCard call={{ id: "x", key: "call-x", direction: "outbound", status: "no-answer" }} open={false} onToggle={() => {}} />)
    expect(screen.getByText("Outbound · No answer")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })
})
