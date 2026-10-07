import { describe, it, expect } from "vitest"
import {
  LEAD_SOURCE_OPTIONS,
  leadSourceOption,
  needsPixel,
  normalizeLeadSource,
} from "@/lib/lead-sources"

describe("lead sources", () => {
  it("offers Instant Forms, a form tool sending to GoHighLevel, then an own landing page", () => {
    expect(LEAD_SOURCE_OPTIONS.map((o) => o.key)).toEqual(["instant_form", "form_to_ghl", "landing_page"])
  })

  it("names ROAS Forms on the form-tool option and says there is nothing to install", () => {
    const option = leadSourceOption("form_to_ghl")
    expect(option.hint).toMatch(/ROAS Forms/)
    expect(option.hint).toMatch(/Nothing to install in Birdy/)
  })

  it("reads the retired external_form as a form tool sending to GoHighLevel", () => {
    expect(normalizeLeadSource("external_form")).toBe("form_to_ghl")
    expect(leadSourceOption("external_form").key).toBe("form_to_ghl")
  })

  it("treats anything unrecognised as not set", () => {
    expect(normalizeLeadSource(undefined)).toBe("unknown")
    expect(leadSourceOption("nonsense").key).toBe("unknown")
  })

  it("only asks for the pixel on the client's own landing page", () => {
    expect(needsPixel("landing_page")).toBe(true)
    expect(needsPixel("form_to_ghl")).toBe(false)
    expect(needsPixel("external_form")).toBe(false)
    expect(needsPixel("instant_form")).toBe(false)
  })
})
