// The rules of the Clients list: status, tabs, order, search, the address,
// and how a cell is written out. Pure functions, no React.

import { defaultMetricFormat } from "@/lib/default-metrics"
import { formatMetric } from "@/lib/format-metric"
import { CRITICAL, WARNING, isActive, normalizeHealth } from "@/lib/client-status"

export const TABS = [
  { key: "all", label: "All active" },
  { key: "risk", label: "At risk" },
  { key: "ok", label: "On track" },
  { key: "off", label: "Inactive" },
]

/** Shown when the user has no saved view: spend, leads, cost per lead, and the share of leads called. */
export const DEFAULT_COLUMNS = ["meta_spend", "meta_leads", "cost_per_lead", "hp_connect_rate"]

/** The list's own names for the default columns; every other column keeps its catalogue label. */
export const COLUMN_LABELS = {
  meta_spend: "Spend",
  meta_leads: "Leads",
  cost_per_lead: "CPL",
  hp_connect_rate: "Leads called",
}

/** Columns the list draws itself, so they never appear in the Columns menu. */
export const FIXED_COLUMNS = new Set(["name", "health"])

/**
 * A client's status in the list, from its hand-set health:
 * "danger" (Critical), "warning" (Warning), "ok" (Healthy or none recorded),
 * or "off" for an inactive client, whose health says nothing about a live account.
 */
export function statusOf(group) {
  if (!isActive(group)) return "off"
  const health = normalizeHealth(group?.health)
  return health === CRITICAL ? "danger" : health === WARNING ? "warning" : "ok"
}

/** Which tabs a status belongs to. Every active client is on "all". */
export function inTab(status, tab) {
  if (tab === "off") return status === "off"
  if (status === "off") return false
  if (tab === "risk") return status === "danger" || status === "warning"
  if (tab === "ok") return status === "ok"
  return true
}

/** `{ all, risk, ok, off }` counts for the tab labels. */
export function tabCounts(rows) {
  const counts = { all: 0, risk: 0, ok: 0, off: 0 }
  for (const row of rows) for (const tab of TABS) if (inTab(row.listStatus, tab.key)) counts[tab.key]++
  return counts
}

const URGENCY = { danger: 0, warning: 1, ok: 2, off: 3 }
const names = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true })
const numberOf = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value))

/**
 * Orders rows.
 *
 * `sort` null means most urgent first: Critical, then Warning, then On track
 * by spend, highest first. Otherwise `{ id, dir }`: the name sorts by
 * alphabet, everything else by number, and a row with no value always goes
 * last whichever way the column is sorted.
 */
export function sortRows(rows, sort) {
  const list = rows.slice()
  if (!sort) {
    return list.sort(
      (a, b) => URGENCY[a.listStatus] - URGENCY[b.listStatus] || (numberOf(b.meta_spend) ?? 0) - (numberOf(a.meta_spend) ?? 0) || names.compare(a.name, b.name)
    )
  }
  const sign = sort.dir === "asc" ? 1 : -1
  if (sort.id === "name") return list.sort((a, b) => sign * names.compare(a.name, b.name))
  return list.sort((a, b) => {
    const x = numberOf(a[sort.id])
    const y = numberOf(b[sort.id])
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1
    return sign * (x - y)
  })
}

/** The sort after a header is pressed: highest first, then lowest first, then back to the default. Names start A to Z. */
export function nextSort(sort, id) {
  const first = id === "name" ? "asc" : "desc"
  if (!sort || sort.id !== id) return { id, dir: first }
  if (sort.dir === first) return { id, dir: first === "asc" ? "desc" : "asc" }
  return null
}

/** Rows whose name contains the search, ignoring case. */
export function searchRows(rows, query) {
  const q = query.trim().toLowerCase()
  return q ? rows.filter((row) => String(row.name || "").toLowerCase().includes(q)) : rows
}

/**
 * The list's state as kept in the address: `?tab=risk&q=glow&sort=meta_spend-desc&range=last_30d`.
 * Anything missing or unrecognised falls back to its default.
 */
export function readState(search, { ranges, defaultRange }) {
  const params = new URLSearchParams(search)
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "all"
  const match = /^(.+)-(asc|desc)$/.exec(params.get("sort") || "")
  const range = ranges.includes(params.get("range")) ? params.get("range") : defaultRange
  return { tab, q: params.get("q") || "", sort: match ? { id: match[1], dir: match[2] } : null, range }
}

/** The query string for a state, leaving defaults out so a plain list has a plain address. */
export function writeState({ tab, q, sort, range }, { defaultRange }) {
  const params = new URLSearchParams()
  if (tab !== "all") params.set("tab", tab)
  if (q) params.set("q", q)
  if (sort) params.set("sort", `${sort.id}-${sort.dir}`)
  if (range !== defaultRange) params.set("range", range)
  const text = params.toString()
  return text ? `?${text}` : ""
}

/**
 * A cell's text. The same rules the old clients table used, so a column reads
 * the same in both: Birdy's own metrics by their definition, custom formulas
 * by their chosen format, then by what the column's id says it holds.
 */
export function formatCell(value, id, { customMetrics = [], currencySymbol = "$" } = {}) {
  if (value === undefined || value === null) return "—"
  if (typeof value === "number" && !Number.isFinite(value)) return "—"
  if (typeof value === "object") return "—"

  const money = (v) => formatMetric(numberOf(v) ?? 0, "currency", currencySymbol)
  const builtIn = defaultMetricFormat(id)
  if (builtIn) return formatMetric(value, builtIn, currencySymbol)

  const custom = customMetrics.find((m) => m.id === id)
  if (custom) {
    const format = custom.formatType || custom.format_type || "integer"
    if (format === "currency") return money(value)
    if (format === "percentage") return `${(Number(value) * 100).toFixed(2)}%`
    if (format === "decimal") return Number(value).toFixed(2)
    return Number(value).toLocaleString()
  }

  if (/spend|cpc|cpm|cost_per|revenue/.test(id)) return money(value)
  if (/ctr|rate/.test(id)) return `${(numberOf(value) ?? 0).toFixed(2)}%`
  if (/_at|refresh/.test(id)) {
    const date = new Date(value)
    return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "—"
  }
  if (typeof value === "number") return value.toLocaleString()
  return String(value)
}

/** Whether a cost per lead is over the client's own target. No target means no opinion. */
export function overTarget(value, target) {
  const v = numberOf(value)
  const t = numberOf(target)
  return v !== null && t !== null && t > 0 && v > t
}

/** "12 min ago" style text for the most recent sync across clients, or null when none has synced. */
export function lastSynced(groups, now = Date.now()) {
  let latest = 0
  for (const group of groups) {
    for (const key of ["last_meta_refresh", "last_ghl_refresh", "last_hp_refresh"]) {
      const text = group?.[key]
      if (!text) continue
      // The server stores UTC and sends it with no zone.
      const time = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`).getTime()
      if (Number.isFinite(time) && time > latest) latest = time
    }
  }
  if (!latest) return null
  const minutes = Math.max(0, Math.round((now - latest) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

const OUTCOME_IDS = new Set(["ghl_revenue", "conversion_rate", "roas"])
const OUTCOME_NAMES = /close rate|cpa\b|cost per (acquisition|close)|revenue|roas/i
const AD_IDS = /^(meta_|active_campaigns|paused_campaigns|best_ad|engagement_rate)/

/**
 * Which heading a column sits under in the Columns panel, in the redesign's
 * order: the default four first, then outcomes, ads, the call centre, the CRM,
 * tags, custom metrics, and whatever is left.
 *
 * @param {object} column a catalogue column: `{ id, label, category }`
 * @param {string} rangeLabel the date range in words, e.g. "Last 7 days"
 */
export function columnGroup(column, rangeLabel) {
  const range = rangeLabel.toLowerCase()
  if (DEFAULT_COLUMNS.includes(column.id)) return rangeLabel
  if (OUTCOME_IDS.has(column.id) || (column.category === "formulas" && OUTCOME_NAMES.test(column.label || ""))) return `Outcomes · ${range}`
  if (column.category === "formulas") return "Custom metrics"
  if (column.category === "tags" || column.type === "tag") return "Tags"
  if (AD_IDS.test(column.id)) return `Ads · ${range}`
  if (column.id.startsWith("hp_")) return `Call centre · ${range}`
  if (column.id.startsWith("ghl_") || column.id === "total_tags" || column.id === "top_tag_string") return "GoHighLevel"
  return "Other"
}

const GROUP_ORDER = ["range", "Outcomes", "Ads", "Call centre", "GoHighLevel", "Tags", "Custom metrics", "Other"]

/** The catalogue sorted into panel order, each column carrying its `group` heading. The default four keep their own order. */
export function groupColumns(catalogue, rangeLabel) {
  const rank = (group) => {
    const i = GROUP_ORDER.findIndex((g) => (g === "range" ? group === rangeLabel : group.startsWith(g)))
    return i === -1 ? GROUP_ORDER.length : i
  }
  return catalogue
    .map((column, index) => ({ ...column, group: columnGroup(column, rangeLabel), index }))
    .sort((a, b) => rank(a.group) - rank(b.group) || (a.group === rangeLabel ? DEFAULT_COLUMNS.indexOf(a.id) - DEFAULT_COLUMNS.indexOf(b.id) : a.index - b.index))
    .map(({ index, ...column }) => column)
}

/**
 * The saved views offered at the top of the panel: Default, Outcomes and Ads
 * (built from the columns that exist for this account), then the user's own
 * saved view when they have one that differs from all three.
 */
export function savedViews(grouped, saved) {
  const has = new Set(grouped.map((c) => c.id))
  const inGroup = (prefix) => grouped.filter((c) => c.group.startsWith(prefix)).map((c) => c.id)
  const views = [{ name: "Default", ids: DEFAULT_COLUMNS.filter((id) => has.has(id)) }]
  const outcomes = inGroup("Outcomes")
  if (outcomes.length) views.push({ name: "Outcomes", ids: ["meta_spend", ...outcomes].filter((id) => has.has(id)) })
  const ads = ["meta_ctr", "meta_clicks", "meta_cpm", "meta_cpc"].filter((id) => has.has(id))
  if (ads.length) views.push({ name: "Ads", ids: [...views[0].ids, ...ads] })
  const mine = (saved || []).filter((id) => has.has(id))
  const same = (a, b) => a.length === b.length && a.every((id) => b.includes(id))
  if (mine.length && !views.some((v) => same(v.ids, mine))) views.push({ name: "My view", ids: mine })
  return views
}
