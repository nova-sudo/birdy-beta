// Pure helpers behind the manual report editor
// (components/report-designer/ReportEditor). The server is the authority on
// what a template may contain (birdy-backend/services/report_template.py
// validate); these keep the editor inside the same rules so a save never
// surprises anyone: at most 12 sections, one Birdy's take, always last.

export const MAX_SECTIONS = 12
export const MAX_RANKING = 5

export const SECTION_TYPES = [
  { type: "metric", label: "Metric line", hint: "One number, for all clients or one client" },
  { type: "ranking", label: "Client ranking", hint: "Best or worst clients by a metric" },
  { type: "alerts", label: "Alerts", hint: "Alerts that fired in the period" },
  { type: "underperforming_ads", label: "Underperforming ads", hint: "Ads Birdy flagged for review" },
  { type: "birdy_take", label: "Birdy's take", hint: "A short written read of the numbers" },
]

export const COMPARE_OPTIONS = [
  { value: "none", label: "No comparison" },
  { value: "previous", label: "vs previous period" },
  { value: "target", label: "vs target" },
]

let seq = 0
const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

/** Give every section a stable client-side key for lists and reordering. */
export function withKeys(sections = []) {
  return sections.map((s) => ({ ...s, _key: s._key || uid() }))
}

/** The template as the API wants it: no client-side keys. */
export function toTemplate(base, title, sections) {
  return {
    frequency: base?.frequency || "daily",
    time: base?.time || "9:00 AM",
    day: base?.day ?? null,
    title: title?.trim() ? title.trim() : null,
    sections: sections.map(({ _key, ...rest }) => rest), // eslint-disable-line no-unused-vars
  }
}

function firstAvailable(catalog, fallback = "spend") {
  return (catalog.find((m) => m.available !== false) || catalog[0])?.id || fallback
}

export function newSection(type, catalog = []) {
  const base = { _key: uid(), type }
  if (type === "metric") return { ...base, metric: firstAvailable(catalog), scope: "portfolio", compare: "previous" }
  if (type === "ranking") return { ...base, metric: firstAvailable(catalog, "leads"), direction: "best", limit: 3 }
  if (type === "birdy_take") return { ...base, focus: "" }
  return base
}

export const hasTake = (sections) => sections.some((s) => s.type === "birdy_take")

export function canAdd(sections, type) {
  if (sections.length >= MAX_SECTIONS) return false
  if (type === "birdy_take" && hasTake(sections)) return false
  return true
}

/** Add a section; new sections go above Birdy's take, which stays last. */
export function addSection(sections, section) {
  if (!canAdd(sections, section.type)) return sections
  if (section.type === "birdy_take") return [...sections, section]
  const takeAt = sections.findIndex((s) => s.type === "birdy_take")
  if (takeAt === -1) return [...sections, section]
  return [...sections.slice(0, takeAt), section, ...sections.slice(takeAt)]
}

export function updateSection(sections, key, patch) {
  return sections.map((s) => (s._key === key ? { ...s, ...patch } : s))
}

export function removeSection(sections, key) {
  return sections.filter((s) => s._key !== key)
}

/** Move a section by `delta` places. Birdy's take never moves and nothing moves below it. */
export function moveSection(sections, key, delta) {
  const from = sections.findIndex((s) => s._key === key)
  if (from === -1 || sections[from].type === "birdy_take") return sections
  const movable = sections.filter((s) => s.type !== "birdy_take").length
  const to = Math.max(0, Math.min(movable - 1, from + delta))
  if (to === from) return sections
  const next = [...sections]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Keep Birdy's take last after a drag reorder of the other sections. */
export function applyOrder(sections, orderedKeys) {
  const byKey = new Map(sections.map((s) => [s._key, s]))
  const ordered = orderedKeys.map((k) => byKey.get(k)).filter((s) => s && s.type !== "birdy_take")
  const take = sections.find((s) => s.type === "birdy_take")
  return take ? [...ordered, take] : ordered
}

/** One-line description of a section, for the collapsed row. */
export function sectionSummary(section, catalogById = {}, clientsById = {}) {
  const metric = catalogById[section.metric]?.label || section.metric
  switch (section.type) {
    case "metric": {
      const who = typeof section.scope === "object" && section.scope
        ? clientsById[section.scope.client_id] || "Unknown client"
        : "All clients"
      const cmp = COMPARE_OPTIONS.find((c) => c.value === (section.compare || "none"))
      return `${metric} · ${who}${section.compare && section.compare !== "none" ? ` · ${cmp.label}` : ""}`
    }
    case "ranking":
      return `${section.direction === "worst" ? "Bottom" : "Top"} ${section.limit} clients by ${metric.toLowerCase()}`
    case "alerts":
      return "Alerts triggered in the period"
    case "underperforming_ads":
      return "Ads flagged for review"
    case "birdy_take":
      return section.focus?.trim() ? `Focused on ${section.focus.trim()}` : "Birdy's read of the numbers"
    default:
      return section.type
  }
}

export function typeLabel(type) {
  return SECTION_TYPES.find((t) => t.type === type)?.label || type
}
