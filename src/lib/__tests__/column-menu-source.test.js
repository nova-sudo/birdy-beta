import { describe, it, expect } from "vitest"
import {
  BASE_CLIENT_COLUMNS,
  COLUMN_MENU_SOURCES,
  columnMenuSource,
  generateTagColumns,
} from "@/lib/enhanced-columns-config"

// The Columns menu's source badge has to agree with the icon the table header
// already shows and with where the Metrics Hub files the same metric. It did
// not: every column whose category wasn't in the map — the calculated ratios
// and the core fields — fell through to "custom", so Cost Per Lead read as a
// formula the user wrote in a menu sitting next to a Meta-badged header.

const byId = (id) => BASE_CLIENT_COLUMNS.find((c) => c.id === id)

describe("columnMenuSource", () => {
  it("badges the calculated Meta ratios as Meta, not Custom", () => {
    // The regression: all four carry the Meta icon in the table header.
    for (const id of ["cost_per_lead", "conversion_rate", "engagement_rate", "roas"]) {
      expect(columnMenuSource(byId(id)), id).toBe("meta")
    }
  })

  it("keeps each platform's own columns on that platform", () => {
    expect(columnMenuSource(byId("meta_spend"))).toBe("meta")
    expect(columnMenuSource(byId("ghl_revenue"))).toBe("ghl")
    expect(columnMenuSource(byId("hp_total_calls"))).toBe("hotprospector")
  })

  it("files tag columns under Tags, despite their GHL icon", () => {
    const [tag] = generateTagColumns(["vip"])
    expect(columnMenuSource(tag)).toBe("tags")
  })

  it("reserves Custom for the formulas a user wrote", () => {
    expect(columnMenuSource({ category: "formulas", type: "formula" })).toBe("custom")
  })

  it("puts the columns Birdy derives in the Birdy bucket", () => {
    // No icon and no platform behind them — Health is a stored choice, Account
    // Age is computed. Neither is a custom formula.
    expect(columnMenuSource(byId("account_age_days"))).toBe("birdy")
    expect(columnMenuSource({ id: "health", category: "core", type: "data" })).toBe("birdy")
  })

  it("only ever returns a source the menu's rail can filter by", () => {
    const ids = new Set(COLUMN_MENU_SOURCES.map((s) => s.id))
    for (const column of BASE_CLIENT_COLUMNS) {
      expect(ids, column.id).toContain(columnMenuSource(column))
    }
  })
})
