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
      [{ text: "💰 " }, { text: "Ad spend:", bold: true }, { text: " £180" }],
      [{ text: "none", italic: true }],
    ])
  })
  it("leaves an unmatched asterisk alone", () => {
    expect(parseMrkdwn("5 * 3")).toEqual([[{ text: "5 * 3" }]])
  })
})
