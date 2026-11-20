import { describe, expect, it } from "vitest"
import { groupConversations, groupLabel, scopeLine, whenLabel } from "../agent-chat"

const NOW = new Date(2026, 10, 19, 15, 0)
const at = (daysAgo, hour = 9, minute = 30) => new Date(2026, 10, 19 - daysAgo, hour, minute).toISOString()

describe("grouping saved conversations", () => {
  it("puts each in Today, Yesterday, This week or Earlier", () => {
    expect([at(0), at(1), at(4), at(20), null, "not a date"].map((d) => groupLabel(d, NOW))).toEqual(["Today", "Yesterday", "This week", "Earlier", "Earlier", "Earlier"])
  })

  it("keeps the groups in order and leaves out empty ones", () => {
    const groups = groupConversations([{ session_id: "a", updated_at: at(20) }, { session_id: "b", updated_at: at(0) }, { session_id: "c", updated_at: at(0, 8) }], NOW)
    expect(groups.map((g) => [g.label, g.items.map((c) => c.session_id)])).toEqual([["Today", ["b", "c"]], ["Earlier", ["a"]]])
    expect(groupConversations(undefined, NOW)).toEqual([])
  })
})

describe("a conversation's second line", () => {
  it("gives the time for recent ones and the date for older ones", () => {
    expect(whenLabel(at(0, 8, 30), NOW)).toBe("8:30 AM")
    expect(whenLabel(at(1, 12, 56), NOW)).toBe("12:56 PM")
    expect(whenLabel(at(4), NOW)).toBe("15 Nov")
    expect(whenLabel(null, NOW)).toBe("")
  })

  it("says who it is about", () => {
    expect(scopeLine({ scope: "client", client_name: "Beaulea Clinic", updated_at: at(1, 12, 56) }, NOW)).toBe("Beaulea Clinic · 12:56 PM")
    expect(scopeLine({ scope: "global", updated_at: at(0, 8, 30) }, NOW)).toBe("All clients · 8:30 AM")
  })
})
