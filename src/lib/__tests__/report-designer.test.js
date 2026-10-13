import { describe, expect, it } from "vitest"
import { parseMrkdwn, scheduleLabel } from "@/lib/report-designer"

describe("scheduleLabel", () => {
  it("says when and what a daily report covers", () => {
    expect(scheduleLabel({ frequency: "daily", time: "9:00 AM" })).toBe("Daily at 9:00 AM · covers yesterday")
  })
  it("names the day for a weekly report", () => {
    expect(scheduleLabel({ frequency: "weekly", day: "Friday", time: "8:00 AM" }))
      .toBe("Every Friday at 8:00 AM · covers the last 7 days")
  })
  it("is empty without a schedule", () => {
    expect(scheduleLabel(null)).toBe("")
  })
})

describe("parseMrkdwn", () => {
  it("splits bold, italic and plain runs per line", () => {
    expect(parseMrkdwn("💰 *Ad spend:* £180\n_none_")).toEqual([
      { quote: false, segs: [{ text: "💰 " }, { text: "Ad spend:", bold: true }, { text: " £180" }] },
      { quote: false, segs: [{ text: "none", italic: true }] },
    ])
  })
  it("reads strikethrough, code, links, quotes and Slack's escaping", () => {
    const [line, quote] = parseMrkdwn("~old~ `x` <https://a.io|site> R&amp;D\n&gt; note")
    expect(line.segs).toEqual([
      { text: "old", strike: true }, { text: " " }, { text: "x", code: true }, { text: " " },
      { text: "site", href: "https://a.io" }, { text: " R&D" },
    ])
    expect(quote).toEqual({ quote: true, segs: [{ text: "note" }] })
  })
  it("leaves an unmatched asterisk alone", () => {
    expect(parseMrkdwn("5 * 3")).toEqual([{ quote: false, segs: [{ text: "5 * 3" }] }])
  })
})
