import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

// Built from parts so the audit grep doesn't match this file.
const LEGACY = new RegExp(["p", "d-|font-", "pd|text-\\[[0-9.]+px\\]"].join(""))
const HEX = new RegExp(["#", "[0-9a-fA-F]{3,8}\\b"].join(""))

const ROOT = process.cwd()
const targets = [
  "src/components/NotificationsDropdown.jsx",
  "src/components/integrations/IntegrationsContent.jsx",
  "src/components/clients/MetaCampaignPicker.jsx",
  "src/components/clients/MetaCampaignsDialog.jsx",
  "src/components/clients/BulkImportDialog.jsx",
  "src/components/clients/ClientTargetsForm.jsx",
  "src/components/ui/MetricPicker.jsx",
  "src/lib/portfolio-metrics.js",
  "src/app/not-found.jsx",
  "src/app/error.jsx",
  "src/app/global-error.jsx",
  "src/app/template.jsx",
  "src/app/changelog/page.jsx",
  "src/app/register/page.jsx",
]

describe("retokened leftovers", () => {
  it.each(targets)("%s has no legacy classes and no inline hex", (file) => {
    const src = readFileSync(join(ROOT, file), "utf8")
    expect(src).not.toMatch(LEGACY)
    expect(src).not.toMatch(HEX)
  })

  it("keeps the unused components deleted", () => {
    for (const gone of ["StatsCard.jsx", "GranularitySelect.jsx", "DateRangeSelect.jsx"]) {
      expect(existsSync(join(ROOT, "src/components", gone))).toBe(false)
    }
  })
})
