import { describe, expect, it } from "vitest"
import { activityQuery, formatCredits, formatRelative, formatWhen, formatWhenLong, kindLabel, localDayStart, plural, prettyArgs, stepParts } from "@/lib/connect-ai"

describe("stepParts", () => {
  it("splits bold text and fills in the link", () => {
    expect(stepParts("Open **Settings** and paste {url}", "https://x/mcp")).toEqual([
      { bold: false, text: "Open " },
      { bold: true, text: "Settings" },
      { bold: false, text: " and paste https://x/mcp" },
    ])
  })
})

describe("formatters", () => {
  const now = new Date(2026, 10, 21, 12, 0)
  it("formatRelative", () => {
    expect(formatRelative(null, now.getTime())).toBe("Never")
    expect(formatRelative(new Date(now.getTime() - 20000).toISOString(), now.getTime())).toBe("Just now")
    expect(formatRelative(new Date(now.getTime() - 5 * 60000).toISOString(), now.getTime())).toBe("5 min ago")
    expect(formatRelative(new Date(now.getTime() - 3 * 3600000).toISOString(), now.getTime())).toBe("3 hr ago")
    expect(formatRelative(new Date(now.getTime() - 30 * 3600000).toISOString(), now.getTime())).toBe("Yesterday")
  })
  it("formatWhen and formatWhenLong", () => {
    const today = new Date(2026, 10, 21, 9, 5).toISOString()
    const yesterday = new Date(2026, 10, 20, 9, 5).toISOString()
    expect(formatWhen(today, now)).toBe("09:05")
    expect(formatWhen(yesterday, now)).toBe("Yesterday")
    expect(formatWhen("bad", now)).toBe("—")
    expect(formatWhenLong(today, now)).toBe("Today 09:05")
    expect(formatWhenLong(yesterday, now)).toBe("Yesterday 09:05")
  })
  it("formatCredits, kindLabel, plural, prettyArgs", () => {
    expect(formatCredits(1.3)).toBe("1.3")
    expect(formatCredits(0.126)).toBe("0.13")
    expect(formatCredits(undefined)).toBe("0")
    expect(kindLabel("refused", "view_only")).toBe("Refused · View-only connection")
    expect(kindLabel("live")).toBe("Live change")
    expect(plural(1, "request")).toBe("1 request")
    expect(plural(2400, "request")).toBe("2,400 requests")
    expect(prettyArgs({})).toBeNull()
    expect(prettyArgs({ a: 1 })).toBe('{\n  "a": 1\n}')
  })
})

describe("activityQuery", () => {
  it("sends only the filters set, and local midnight N days ago", () => {
    const now = new Date(2026, 10, 21, 15, 30)
    const q = activityQuery({ app: "c1", kind: "", client: "g1", days: 7 }, now)
    expect(q.get("app")).toBe("c1")
    expect(q.has("kind")).toBe(false)
    expect(q.get("client_group_id")).toBe("g1")
    expect(q.get("from")).toBe(new Date(2026, 10, 14, 0, 0).toISOString())
    expect(localDayStart(0, now)).toBe(new Date(2026, 10, 21).toISOString())
  })
})
