import { describe, it, expect } from "vitest"
import { cardFacts, readsLine, runsLine, shortReply, toolWords, withoutToolNames } from "@/lib/sub-agent-card"

describe("sub-agent card words", () => {
  it("says what a tool reads in plain words, never its name", () => {
    expect(toolWords("get_ad_insights")).toBe("Ad results")
    expect(toolWords("get_meta_insights_live")).toBe("Ad results")
    expect(toolWords("get_meta_leads_live")).toBe("Leads")
    expect(toolWords("get_call_transcript")).toBe("Calls")
    expect(toolWords("get_ghl_contacts")).toBe("Sales pipeline")
    expect(toolWords("something_new")).toBe("Your ad data")
    expect(toolWords("something_new", "sales_coach")).toBe("Your sales data")
  })

  it("lists each phrase once", () => {
    expect(readsLine([{ name: "get_ad_insights" }, { name: "get_meta_insights_live" }])).toBe("Ad results")
    expect(readsLine([{ name: "get_ad_insights" }, { name: "get_facebook_leads" }])).toBe("Ad results and leads")
    expect(readsLine([], "media_buyer")).toBe("Your ad data")
  })

  it("says when it runs in words", () => {
    expect(runsLine({ time: "14:10", timezone: "Europe/London", days: [] }, "media_buyer")).toBe("Every day at 14:10")
    expect(runsLine({ time: "08:00", days: ["mon", "tue", "wed", "thu", "fri"] }, "media_buyer")).toBe("Weekdays at 08:00")
    expect(runsLine(null, "sales_coach")).toBe("When Sales Coach asks")
  })

  it("builds the four facts from the record only", () => {
    const facts = cardFacts({ parent: "media_buyer", clients: [{ id: "a", name: "Aura" }], schedule: null, tools: [{ name: "get_ad_insights" }] })
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ["Clients", "Aura"], ["Runs", "When Marketing Guru asks"], ["Reads", "Ad results"], ["Reports to", "Marketing Guru"],
    ])
  })

  it("swaps raw tool names in a reply for words", () => {
    expect(withoutToolNames("It uses `get_ad_insights` and get_facebook_leads.")).toBe("It uses ad results and leads.")
  })

  it("keeps only the lead-in of a reply whose ideas are cards", () => {
    expect(shortReply("Two ideas would help. Both save you time. A third thing.\n\n- **Monitor**\n  - Purpose: x")).toBe("Two ideas would help. Both save you time.")
    expect(shortReply("Here is what I'd add:\n1. Monitor")).toBe("Here is what I'd add.")
    expect(shortReply("- **Monitor**")).toBe("Here’s what I’d add.")
  })
})
