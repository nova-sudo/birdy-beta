import { describe, expect, it } from "vitest"
import { buildPlaceholder, insertAt, isMultiline, placeholdersIn, prefixLines, wrapSelection } from "@/lib/report-editor"

describe("buildPlaceholder", () => {
  it("writes options, quoting values with spaces or commas and dropping empty ones", () => {
    expect(buildPlaceholder("spend")).toBe("{{spend}}")
    expect(buildPlaceholder("cpl", { client: "Glow Clinic", period: null, show: "vs_target" }))
      .toBe('{{cpl client="Glow Clinic" show=vs_target}}')
    expect(buildPlaceholder("breakdown", { metrics: "spend,leads", limit: 5 }))
      .toBe('{{breakdown metrics="spend,leads" limit=5}}')
  })
})

describe("editing the message", () => {
  it("inserts over the selection and puts the caret after it", () => {
    expect(insertAt("Spend: X today", 7, 8, "{{spend}}")).toEqual({ text: "Spend: {{spend}} today", cursor: 16 })
  })
  it("wraps the selection for bold, or a stand-in word when nothing is selected", () => {
    expect(wrapSelection("say hi", 4, 6, "*")).toEqual({ text: "say *hi*", selStart: 5, selEnd: 7 })
    expect(wrapSelection("", 0, 0, "_").text).toBe("_text_")
  })
  it("prefixes every selected line once", () => {
    expect(prefixLines("a\nb\n• c", 0, 7, "• ").text).toBe("• a\n• b\n• c")
  })
  it("knows which placeholders produce lists", () => {
    expect(isMultiline("ranking", { limit: 1 })).toBe(false)
    expect(isMultiline("ranking", { limit: 3 })).toBe(true)
    expect(isMultiline("breakdown")).toBe(true)
    expect(isMultiline("alerts", { show: "list" })).toBe(true)
  })
  it("lists the placeholders in a message", () => {
    expect(placeholdersIn("x {{spend}} y {{ranking metric=cpl}}").map((p) => p.name)).toEqual(["spend", "ranking"])
  })
})

import { BLOCK_TEMPLATES, parseBlocks, toJson } from "@/lib/report-editor"

describe("block editing", () => {
  it("parses arrays and explains bad JSON", () => {
    expect(parseBlocks('[{"type":"divider"}]')).toEqual({ blocks: [{ type: "divider" }], error: null })
    expect(parseBlocks('{"type":"divider"}').error).toMatch(/JSON array/)
    expect(parseBlocks('[{"type":}]').error).toMatch(/isn't valid/)
    expect(JSON.parse(toJson([{ type: "divider" }]))).toEqual([{ type: "divider" }])
  })

  it("offers every message block type, each a fresh object", () => {
    const types = new Set(BLOCK_TEMPLATES.flatMap((g) => g.items.map((t) => t.block().type)))
    for (const t of ["header", "section", "divider", "image", "context", "actions", "rich_text", "markdown",
                     "table", "data_table", "data_visualization", "card", "carousel"]) {
      expect(types.has(t), t).toBe(true)
    }
    const line = BLOCK_TEMPLATES.flatMap((g) => g.items).find((t) => t.id === "line")
    expect(line.block()).not.toBe(line.block())
  })
})
