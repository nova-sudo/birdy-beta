import { describe, it, expect } from "vitest"
import { withGhlCalls } from "../lead-detail"

// Calls made in GoHighLevel, folded into the lead's calls (moved here from the old lead page's component tests).

const ghlCall = {
  id: "ghl:m1",
  ghl_message_id: "m1",
  source: "ghl",
  direction: "outbound",
  status: "completed",
  duration_seconds: 42,
  started_at: "2026-07-17T10:00:00+00:00",
  recording_url: null,
}

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

describe("one call seen by both dialers", () => {
  const ghl = { ...ghlCall, started_at: "2026-10-25T13:00:00Z", duration_seconds: 300 }

  it("drops a GHL call that matches a logged call", () => {
    const detail = { calls: [{ id: "hp1", direction: "outbound", started_at: "2026-10-25T13:00:30Z", recording_url: "https://x/r" }], engagement: { touchpoints: 1 } }
    const out = withGhlCalls(detail, [ghl], "c1")
    expect(out).toBe(detail)
  })

  it("matches a webhook row stamped on arrival after the call", () => {
    const detail = { calls: [{ id: "w1", direction: "outbound", started_at: "2026-10-25T13:06:00Z", started_at_estimated: true }] }
    expect(withGhlCalls(detail, [ghl], "c1")).toBe(detail)
  })

  it("matches GHL stamping the call at its end", () => {
    // HotProspector: 13:30 (to the minute), 341s. GHL logged it at 13:36:18.
    const detail = { calls: [{ id: "hp1", direction: "outbound", started_at: "2026-10-27T13:30:00Z", duration_seconds: 341 }] }
    expect(withGhlCalls(detail, [{ ...ghl, started_at: "2026-10-27T13:36:18Z" }], "c1")).toBe(detail)
    // Logged after that call ended, or before it started: another call.
    expect(withGhlCalls(detail, [{ ...ghl, started_at: "2026-10-27T13:40:00Z" }], "c1").calls).toHaveLength(2)
    expect(withGhlCalls(detail, [{ ...ghl, started_at: "2026-10-27T13:28:30Z" }], "c1").calls).toHaveLength(2)
  })

  it("keeps a GHL call with no logged twin", () => {
    const detail = { calls: [{ id: "hp1", direction: "inbound", started_at: "2026-10-25T13:00:10Z" }], engagement: {} }
    expect(withGhlCalls(detail, [ghl], "c1").calls.map((c) => c.id)).toEqual(["hp1", "ghl:m1"])
  })
})
