import { describe, it, expect } from "vitest"

import { SETUP_STEPS, currentStep, stepAnswer, stepsDone } from "../steps"

const AGENT = {
  name: "Pause rules",
  description: "Pause ads that cost too much",
  scope: {
    client_group_ids: ["g1", "g2", "g3"],
    schedule: { time: "07:00", tz: "Europe/London" },
    slack_channel_id: "C1",
  },
  permissions: { ads: true, adsets: true, campaigns: false, budgets: false },
}

describe("setup steps", () => {
  it("lists the six steps in the rail's order", () => {
    expect(SETUP_STEPS.map((s) => s.key)).toEqual(["purpose", "playbook", "clients", "permissions", "schedule", "slack"])
    expect(SETUP_STEPS[3].label).toBe("What it can change")
  })

  it("currentStep picks first false", () => {
    expect(currentStep({})).toBe("purpose")
    expect(currentStep(undefined)).toBe("purpose")
    expect(currentStep({ purpose: true, playbook: false, clients: true })).toBe("playbook")
    expect(currentStep(Object.fromEntries(SETUP_STEPS.map((s) => [s.key, true])))).toBeNull()
    expect(stepsDone({ purpose: true, clients: true, slack: false })).toBe(2)
  })

  it("stepAnswer formats each step", () => {
    const rules = [
      { kind: "pause_over_target", enabled: true },
      { kind: "revive_winner", enabled: false },
      { kind: "flag_no_spend" },
    ]
    const channels = [{ id: "C1", name: "media-buying" }]
    expect(stepAnswer(AGENT, "purpose")).toBe("Pause ads that cost too much")
    expect(stepAnswer(AGENT, "playbook", { rules })).toBe("2 rules")
    expect(stepAnswer(AGENT, "playbook", { rules: rules.slice(0, 1) })).toBe("1 rule")
    expect(stepAnswer(AGENT, "clients")).toBe("3 clients")
    expect(stepAnswer({ scope: { client_group_ids: ["g1"] } }, "clients")).toBe("1 client")
    expect(stepAnswer(AGENT, "permissions")).toBe("Can change ads and ad sets")
    expect(stepAnswer({ permissions: { ads: true, adsets: true, campaigns: true } }, "permissions")).toBe(
      "Can change ads, ad sets and campaigns"
    )
    expect(stepAnswer({ permissions: {} }, "permissions")).toBe("Flags only, changes nothing")
    expect(stepAnswer(AGENT, "schedule")).toBe("07:00 Europe/London")
    expect(stepAnswer(AGENT, "slack", { channels })).toBe("#media-buying")
    expect(stepAnswer(AGENT, "slack")).toBe("Channel picked")
    expect(stepAnswer({}, "purpose")).toBeNull()
    expect(stepAnswer({}, "slack")).toBeNull()
    expect(stepAnswer(AGENT, "nope")).toBeNull()
  })
})
