/**
 * Pure data helpers behind the /contacts/[contactId] lead detail page.
 *
 * Dates use midday UTC so the local-day grouping and the "Friday, 17 July"
 * label come out the same in any timezone from UTC-11 to UTC+11.
 */
import { describe, it, expect } from "vitest"
import {
  leadTitle,
  statusPill,
  formatDuration,
  cameFrom,
  threadDays,
  initials,
} from "@/lib/lead-detail"

describe("leadTitle", () => {
  it("uses the name when present", () => {
    expect(leadTitle({ name: "Amina Yusuf", phone: "07393 421825" })).toBe("Amina Yusuf")
  })

  it("falls back to the phone when the name is empty", () => {
    expect(leadTitle({ name: "", phone: "07393 421825" })).toBe("07393 421825")
  })

  it("falls back to 'Unknown lead' when there is neither name nor phone", () => {
    expect(leadTitle({ name: null, phone: null })).toBe("Unknown lead")
    expect(leadTitle({})).toBe("Unknown lead")
  })
})

describe("statusPill", () => {
  it("returns null when there are no opportunities", () => {
    expect(statusPill([])).toBeNull()
    expect(statusPill(null)).toBeNull()
    expect(statusPill(undefined)).toBeNull()
  })

  it("labels with the first opportunity's stage_name", () => {
    expect(statusPill([{ status: "open", stage_name: "Booked consult" }])).toEqual({
      label: "Booked consult",
      tone: "open",
    })
  })

  it("falls back to the status for the label when stage_name is missing", () => {
    expect(statusPill([{ status: "won", stage_name: null }])).toEqual({
      label: "won",
      tone: "won",
    })
  })

  it("only looks at the first (newest) opportunity", () => {
    const pill = statusPill([
      { status: "lost", stage_name: "Lost deal" },
      { status: "won", stage_name: "Signed" },
    ])
    expect(pill).toEqual({ label: "Lost deal", tone: "lost" })
  })

  it("maps won to won, lost and abandoned to lost, open to open", () => {
    expect(statusPill([{ status: "won", stage_name: "x" }]).tone).toBe("won")
    expect(statusPill([{ status: "lost", stage_name: "x" }]).tone).toBe("lost")
    expect(statusPill([{ status: "abandoned", stage_name: "x" }]).tone).toBe("lost")
    expect(statusPill([{ status: "open", stage_name: "x" }]).tone).toBe("open")
  })

  it("maps any other status to neutral", () => {
    expect(statusPill([{ status: "on_hold", stage_name: "Paused" }]).tone).toBe("neutral")
    expect(statusPill([{ status: undefined, stage_name: "Paused" }]).tone).toBe("neutral")
  })
})

describe("formatDuration", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(36)).toBe("0:36")
    expect(formatDuration(272)).toBe("4:32")
    expect(formatDuration(3599)).toBe("59:59")
  })

  it("formats an hour and over as Xh Ym", () => {
    expect(formatDuration(3600)).toBe("1h 0m")
    expect(formatDuration(9240)).toBe("2h 34m")
  })

  it("gives an em dash for null or undefined", () => {
    expect(formatDuration(null)).toBe("—")
    expect(formatDuration(undefined)).toBe("—")
  })
})

describe("cameFrom", () => {
  it("names the ad platform and ad when attribution has an ad_name", () => {
    expect(
      cameFrom({
        contact: { source: "Website" },
        attribution: { ad_name: "Spring Offer 2026", platform: "meta" },
      }),
    ).toBe("Meta · Spring Offer 2026")
  })

  it("falls back to contact.source when there is no attribution", () => {
    expect(cameFrom({ contact: { source: "Referral" }, attribution: null })).toBe("Referral")
  })

  it("falls back to contact.source when attribution has no ad_name", () => {
    expect(
      cameFrom({ contact: { source: "Referral" }, attribution: { ad_name: "" } }),
    ).toBe("Referral")
  })

  it("gives an em dash when there is neither attribution nor source", () => {
    expect(cameFrom({ contact: { source: null }, attribution: null })).toBe("—")
  })
})

describe("threadDays", () => {
  const call = (id, started_at) => ({
    id,
    direction: "inbound",
    status: "completed",
    duration_seconds: 60,
    started_at,
    recording_url: null,
  })

  it("returns an empty list for no calls", () => {
    expect(threadDays([])).toEqual([])
  })

  it("groups two calls on different days into two groups, oldest day first", () => {
    // Given newest first, as the API may return them.
    const days = threadDays([
      call("b", "2026-07-18T12:00:00+00:00"),
      call("a", "2026-07-17T12:00:00+00:00"),
    ])

    expect(days.map((d) => d.day)).toEqual(["Friday, 17 July", "Saturday, 18 July"])
    expect(days[0].items).toEqual([{ kind: "call", ...call("a", "2026-07-17T12:00:00+00:00") }])
    expect(days[1].items).toEqual([{ kind: "call", ...call("b", "2026-07-18T12:00:00+00:00") }])
  })

  it("puts several calls on the same day in one group, oldest item first", () => {
    const days = threadDays([
      call("late", "2026-07-17T12:30:00+00:00"),
      call("early", "2026-07-17T11:30:00+00:00"),
    ])

    expect(days).toHaveLength(1)
    expect(days[0].day).toBe("Friday, 17 July")
    expect(days[0].items.map((i) => i.id)).toEqual(["early", "late"])
  })

  it("tags every item with kind 'call' and keeps the call fields", () => {
    const [group] = threadDays([call("only", "2026-07-17T12:00:00+00:00")])
    expect(group.items[0]).toMatchObject({
      kind: "call",
      id: "only",
      direction: "inbound",
      duration_seconds: 60,
    })
  })
})

describe("threadDays with messages", () => {
  const call = { id: "c1", direction: "outbound", started_at: "2026-07-17T12:30:00+00:00" }
  const msg = (id, date) => ({ id, channel: "SMS", direction: "inbound", body: "hi", date })

  it("merges calls and messages in time order, tagged by kind", () => {
    const days = threadDays([call], [msg("m2", "2026-07-17T13:00:00+00:00"), msg("m1", "2026-07-17T12:00:00+00:00")])
    expect(days).toHaveLength(1)
    expect(days[0].items.map((i) => [i.kind, i.id])).toEqual([
      ["message", "m1"],
      ["call", "c1"],
      ["message", "m2"],
    ])
  })

  it("groups a message-only thread by day", () => {
    const days = threadDays(undefined, [msg("a", "2026-07-17T12:00:00+00:00"), msg("b", "2026-07-18T12:00:00+00:00")])
    expect(days.map((d) => d.day)).toEqual(["Friday, 17 July", "Saturday, 18 July"])
  })
})

describe("initials", () => {
  it("takes up to two letters", () => {
    expect(initials("Rebecca Becirspahic")).toBe("RB")
    expect(initials("amina")).toBe("A")
    expect(initials("Mary Jane Watson")).toBe("MJ")
  })
  it("gives ? when empty", () => {
    expect(initials("")).toBe("?")
    expect(initials(null)).toBe("?")
    expect(initials("   ")).toBe("?")
  })
})
