// The Ask Birdy prompt on the Client Detail insights card.

import { describe, it, expect } from "vitest"
import { clientInsightPrompt } from "@/lib/client-insight"
import { ON_TRACK, BEHIND, AT_RISK } from "@/lib/client-goals"

const group = ({ name = "Aura", funnel = null, spend = 0 } = {}) => ({
  name,
  gohighlevel: { metrics: { funnel } },
  facebook: { metrics: { insights: { spend } } },
})

const goal = (label, state) => ({ label, state })

describe("the Ask Birdy prompt", () => {
  it("asks a general question when nothing is behind", () => {
    const prompt = clientInsightPrompt(group(), [goal("Revenue", ON_TRACK)])
    expect(prompt).toMatch(/how is aura performing/i)
  })

  it("names the failing goals when there are some", () => {
    const prompt = clientInsightPrompt(group(), [
      goal("Revenue", BEHIND), goal("Close rate", AT_RISK),
    ])
    expect(prompt).toMatch(/behind on revenue and close rate/i)
  })

  it("falls back gracefully with no client", () => {
    expect(clientInsightPrompt(null, [])).toMatch(/this client/i)
  })
})
