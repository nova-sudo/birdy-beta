import { describe, it, expect } from "vitest"
import { clockWords, dayWords, nextRun, weekdaysWords, whenWords, zoneCity, zonedToUtc } from "../report-schedule"

describe("report schedule", () => {
  it("finds today's run when its time is still ahead, in the schedule's own zone", () => {
    // 06:00 UTC on Fri 20 Nov 2026 is 06:00 in London (GMT).
    const now = new Date("2026-11-20T06:00:00Z")
    expect(nextRun({ time: "07:00", tz: "Europe/London" }, now).toISOString()).toBe("2026-11-20T07:00:00.000Z")
  })

  it("moves to tomorrow once today's time has gone", () => {
    const now = new Date("2026-11-20T08:00:00Z")
    expect(nextRun({ time: "07:00", tz: "Europe/London" }, now).toISOString()).toBe("2026-11-21T07:00:00.000Z")
  })

  it("keeps to the weekdays given, Monday first", () => {
    // Fri 20 Nov → next Monday (0) is 23 Nov.
    const now = new Date("2026-11-20T08:00:00Z")
    expect(nextRun({ time: "09:30", tz: "UTC", weekdays: [0] }, now).toISOString()).toBe("2026-11-23T09:30:00.000Z")
  })

  it("reads summer time from the zone", () => {
    expect(zonedToUtc(2026, 7, 1, 7, 0, "Europe/London").toISOString()).toBe("2026-07-01T06:00:00.000Z")
    expect(zonedToUtc(2026, 11, 20, 9, 0, "Asia/Dubai").toISOString()).toBe("2026-11-20T05:00:00.000Z")
  })

  it("gives nothing for a time it can't read", () => {
    expect(nextRun({ time: "soon", tz: "UTC" })).toBeNull()
  })

  it("words days and times the way the reference does", () => {
    const now = new Date("2026-11-20T08:00:00Z")
    expect(dayWords(new Date("2026-11-20T12:00:00Z"), now, "UTC")).toBe("Today")
    expect(dayWords(new Date("2026-11-21T12:00:00Z"), now, "UTC")).toBe("Tomorrow")
    expect(dayWords(new Date("2026-11-24T12:00:00Z"), now, "UTC")).toBe("Tue 24 Nov")
    expect(whenWords(new Date("2026-11-21T07:00:00Z"), now, "Europe/London")).toBe("Tomorrow · 7:00 AM")
    expect(clockWords("16:45")).toBe("4:45 PM")
    expect(weekdaysWords([3, 0])).toBe("Mon, Thu")
    expect(weekdaysWords([0, 1, 2, 3, 4, 5, 6])).toBe("Every day")
    expect(zoneCity("America/New_York")).toBe("New York")
    expect(zoneCity(null)).toBe("London")
  })
})
