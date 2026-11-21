import { describe, it, expect } from "vitest"
import {
  callLabel, callStats, clientLeadsHref, fieldsOf, findHits, firstReplySeconds, funnelStage, leadStatus, leadTiles,
  dialerName, localStamp, markParts, platformLabel, stamp, span, stageNote, tagsNewestFirst, talk, threadItems, touchWhen, transcriptText,
} from "../lead-view"

const NOW = new Date("2026-11-20T12:00:00Z")
const detail = (extra = {}) => ({
  contact: { id: "c1", name: "Kim Jones", first_name: "Kim", date_added: "2026-11-18T10:00:00Z", group_id: "g1" },
  opportunities: [],
  calls: [],
  engagement: {},
  ...extra,
})

describe("leadStatus and funnelStage", () => {
  it("reads the first opportunity's status", () => {
    expect(leadStatus([])).toBeNull()
    expect(leadStatus([{ status: "won" }])).toBe("won")
    expect(leadStatus([{ status: "WEIRD" }])).toBe("open")
  })

  it("puts the lead in the furthest stage, like the Leads table", () => {
    expect(funnelStage(detail())).toBe("crm")
    expect(funnelStage(detail({ calls: [{ id: "x" }] }))).toBe("called")
    expect(funnelStage(detail({ opportunities: [{ status: "lost" }, { status: "won" }] }))).toBe("closed")
    expect(funnelStage(detail({ opportunities: [{ status: "lost" }, { status: "abandoned" }], calls: [{ id: "x" }] }))).toBe("lost")
    expect(funnelStage(detail({ opportunities: [{ status: "lost" }, { status: "open" }] }))).toBe("crm")
  })

  it("names the pipeline stage when there is one", () => {
    expect(stageNote(detail({ opportunities: [{ status: "open" }, { status: "open", stage_name: "Booked" }] }))).toBe("Booked")
    expect(stageNote(detail())).toBe("")
  })
})

describe("span and talk", () => {
  it("writes spans the short way", () => {
    expect(span(40)).toBe("40s")
    expect(span(12 * 60)).toBe("12m")
    expect(span(933 * 60)).toBe("15h 33m")
    expect(span(3120 * 60)).toBe("2d 4h")
    expect(span(-1)).toBeNull()
    expect(span(null)).toBeNull()
  })
  it("writes talk time", () => {
    expect(talk(525)).toBe("8m 45s")
    expect(talk(40)).toBe("40s")
  })
})

describe("touchWhen", () => {
  it("says today, yesterday, else the date", () => {
    const at = (iso) => touchWhen(iso, NOW)
    expect(at("2026-11-20T09:12:00")).toBe("Today 09:12")
    expect(at("2026-11-19T15:45:00")).toBe("Yesterday 15:45")
    expect(at("2026-11-03T10:00:00")).toBe("3 Nov, 10:00")
    expect(at(null)).toBe("—")
  })
})

describe("leadTiles", () => {
  const items = [{ kind: "message", channel: "SMS", direction: "inbound", at: "2026-11-20T09:12:00" }]

  it("an open lead leads with how long it has been open, then the last touch, then the value", () => {
    const tiles = leadTiles(detail({ opportunities: [{ status: "open", monetary_value: 0 }] }), items, NOW)
    expect(tiles.map((t) => t.key)).toEqual(["time", "touch", "value"])
    expect(tiles[0]).toMatchObject({ label: "Open for", value: "2d 2h" })
    expect(tiles[1]).toMatchObject({ value: "Today 09:12", note: "SMS from Kim" })
    expect(tiles[2]).toMatchObject({ label: "Deal value", value: "—", note: "If won" })
  })

  it("a won lead leads with the value and its time to close", () => {
    const won = detail({ opportunities: [{ status: "won", monetary_value: 1250.5, last_status_change_at: "2026-11-19T10:00:00Z" }], engagement: { time_to_close_seconds: 86400 } })
    const tiles = leadTiles(won, [], NOW)
    expect(tiles.map((t) => t.key)).toEqual(["value", "time", "touch"])
    expect(tiles[0]).toMatchObject({ value: "1,250.5", note: "Closed 19 Nov" })
    expect(tiles[1]).toMatchObject({ label: "Time to close", value: "1d 0h" })
    expect(tiles[2]).toMatchObject({ value: "None yet", note: "No messages or calls" })
  })

  it("a lost lead shows the lost value, muted, and how long until it was lost", () => {
    const lost = detail({ opportunities: [{ status: "lost", monetary_value: 300, last_status_change_at: "2026-11-18T13:30:00Z" }] })
    const [value, time] = leadTiles(lost, [], NOW)
    expect(value).toMatchObject({ label: "Lost value", tone: "danger", note: "Lost 18 Nov" })
    expect(time).toMatchObject({ label: "Lost after", value: "3h 30m" })
  })

  it("says when there is no opportunity", () => {
    expect(leadTiles(detail(), [], NOW).find((t) => t.key === "value").note).toBe("No opportunity yet")
  })
})

describe("threadItems", () => {
  it("merges calls and messages oldest first, with a day and a key on each", () => {
    const items = threadItems(
      [{ id: "k1", started_at: "2026-11-19T10:00:00Z", direction: "outbound" }],
      [{ id: "m1", date: "2026-11-19T09:00:00Z", body: "Hi" }, { id: "m2", date: null, body: "dateless" }],
    )
    expect(items.map((i) => i.key)).toEqual(["message-m1", "call-k1"])
    expect(items[0].at).toBe("2026-11-19T09:00:00Z")
    expect(items[1].day).toMatch(/Thursday, 19 November/)
  })
})

describe("calls", () => {
  it("labels a call by direction and length, or what happened", () => {
    expect(callLabel({ direction: "outbound", status: "completed", duration_seconds: 365 })).toBe("Outbound · 6m 05s")
    expect(callLabel({ direction: "inbound", status: "no-answer" })).toBe("Inbound · No answer")
    expect(callLabel({ status: "busy" })).toBe("Call · Busy")
  })
  it("counts answered, direction and talk time", () => {
    expect(callStats([
      { direction: "outbound", status: "completed", duration_seconds: 60 },
      { direction: "inbound", status: "answered", duration_seconds: 30 },
      { direction: "outbound", status: "no-answer", duration_seconds: 5 },
    ])).toEqual({ total: 3, answered: 2, inbound: 1, outbound: 2, talkSeconds: 90 })
  })
  it("reads dialer transcripts in any shape", () => {
    expect(transcriptText("Hi")).toBe("Hi")
    expect(transcriptText([{ speaker: "Agent", text: "Hello" }, "Bye"])).toBe("Agent: Hello\nBye")
    expect(transcriptText({ text: "T" })).toBe("T")
    expect(transcriptText(null)).toBe("")
  })
})

describe("firstReplySeconds", () => {
  it("is the time to the team's first outbound item after the lead arrived", () => {
    const items = [
      { direction: "inbound", at: "2026-11-18T10:05:00Z" },
      { direction: "outbound", at: "2026-11-18T10:20:00Z" },
    ]
    expect(firstReplySeconds(items, "2026-11-18T10:00:00Z")).toBe(1200)
    expect(firstReplySeconds(items.slice(0, 1), "2026-11-18T10:00:00Z")).toBeNull()
    expect(firstReplySeconds(items, "")).toBeNull()
  })
})

describe("thread search", () => {
  const items = [
    { key: "message-1", kind: "message", subject: "Price", body: "The price is fine. Price!" },
    { key: "call-1", kind: "call", direction: "outbound", status: "completed", duration_seconds: 60, transcript: "What price?" },
    { key: "call-2", kind: "call", direction: "inbound", status: "completed", duration_seconds: 30, transcript_path: "/x" },
  ]

  it("finds every match in thread order, across subjects, bodies and transcripts", () => {
    const { hits, start } = findHits(items, "  PRICE ")
    expect(hits).toEqual([
      { key: "message-1", field: "subject" },
      { key: "message-1", field: "body" },
      { key: "message-1", field: "body" },
      { key: "call-1", field: "transcript" },
    ])
    expect(start.get("message-1|body")).toBe(1)
    expect(start.get("call-1|transcript")).toBe(3)
  })

  it("searches a GoHighLevel transcript once it has been fetched", () => {
    expect(findHits(items, "refund").hits).toHaveLength(0)
    expect(findHits(items, "refund", { "call-2": "A refund please" }).hits).toEqual([{ key: "call-2", field: "transcript" }])
    expect(fieldsOf(items[2], {})).toEqual([["card", "Inbound · 30s"], ["transcript", ""]])
  })

  it("returns nothing for an empty search", () => {
    expect(findHits(items, " ").hits).toEqual([])
  })

  it("splits text around its matches and numbers them", () => {
    expect(markParts("a Price, price", "price", 4)).toEqual([{ text: "a " }, { text: "Price", hit: 4 }, { text: ", " }, { text: "price", hit: 5 }])
    expect(markParts("text", "price", undefined)).toEqual([{ text: "text" }])
    expect(markParts("text", "", 0)).toEqual([{ text: "text" }])
  })
})

describe("journey times", () => {
  it("writes a stamp in the 24-hour clock, and reads a local clock as written", () => {
    expect(stamp("2026-11-21T11:20:00")).toBe("21 Nov, 11:20")
    expect(stamp(null)).toBe("")
    expect(localStamp("2026-11-24T12:48:00")).toBe("24 Nov, 12:48")
    expect(localStamp("2026-13-24T12:48")).toBe("")
    expect(localStamp("soon")).toBe("")
  })
})

describe("small labels", () => {
  it("names the platform", () => {
    expect(platformLabel({ platform: "fb" })).toBe("Meta · Facebook")
    expect(platformLabel({ platform: "ig", is_organic: true })).toBe("Meta · Instagram · organic")
    expect(platformLabel({ platform: "facebook" })).toBe("Meta")
    expect(platformLabel({ platform: "tiktok" })).toBe("Tiktok")
    expect(platformLabel({})).toBe("—")
  })
  it("lists tags newest first, automation counters last, without changing the original", () => {
    const tags = ["a", "sms 1", "b", "no answer 2"]
    expect(tagsNewestFirst(tags)).toEqual(["b", "a", "no answer 2", "sms 1"])
    expect(tags).toEqual(["a", "sms 1", "b", "no answer 2"])
  })
  it("names the dialer", () => {
    expect(dialerName("hotprospector")).toBe("HotProspector")
    expect(dialerName("ghl")).toBe("")
    expect(dialerName("aircall")).toBe("Aircall")
    expect(dialerName(null)).toBe("")
  })
  it("goes back to the client's leads, or to Leads without a client", () => {
    expect(clientLeadsHref("g 1")).toBe("/dashboard/table?client=g%201")
    expect(clientLeadsHref(null)).toBe("/media-buyer/table?level=leads")
  })
})
