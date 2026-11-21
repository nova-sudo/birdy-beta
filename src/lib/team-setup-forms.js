// The setup interview's forms: what each one sends to
// PUT /api/team/setup/{agent}/{step}, and how a saved answer fills it again.

export const ALL = "all"

/** Time zones offered first; the browser's own is added when missing. */
export const COMMON_TIMEZONES = [
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Amsterdam",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland", "UTC",
]

export function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

const positive = (raw) => {
  const t = String(raw ?? "").trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : NaN
}

/** clients: "all", or the ids picked. Null when nothing is picked. */
export function clientsBody(mode, ids) {
  if (mode === ALL) return { client_group_ids: ALL }
  const list = [...new Set((ids || []).filter(Boolean))]
  return list.length ? { client_group_ids: list } : null
}

/** The clients form's state from a saved answer. */
export function clientsInitial(value) {
  const ids = value?.client_group_ids
  if (Array.isArray(ids)) return { mode: "some", ids }
  return { mode: ALL, ids: [] }
}

/**
 * cpl: one limit for every client, or one per client. Returns {body} or {error}.
 * @param {"one"|"each"} mode
 * @param {string} all the shared limit as typed
 * @param {Record<string, string>} each per client id, as typed; empty boxes are left out
 */
export function cplBody(mode, all, each = {}) {
  if (mode === "one") {
    const n = positive(all)
    if (n === null || Number.isNaN(n)) return { error: "Type a limit above zero." }
    return { body: { default: n, clients: {} } }
  }
  const clients = {}
  for (const [id, raw] of Object.entries(each)) {
    const n = positive(raw)
    if (Number.isNaN(n)) return { error: "Each limit has to be a number above zero." }
    if (n !== null) clients[id] = n
  }
  if (!Object.keys(clients).length) return { error: "Give at least one client a limit." }
  return { body: { default: null, clients } }
}

export function cplInitial(value) {
  const clients = value?.clients && typeof value.clients === "object" ? value.clients : {}
  const each = Object.fromEntries(Object.entries(clients).map(([id, n]) => [id, String(n)]))
  if (Object.keys(each).length) return { mode: "each", all: value?.default != null ? String(value.default) : "", each }
  return { mode: "one", all: value?.default != null ? String(value.default) : "", each: {} }
}

/** permissions: what it may change in Meta. Budgets are never offered. */
export const PERMISSIONS = [
  { key: "ads", label: "Pause and turn on ads" },
  { key: "adsets", label: "Pause and turn on ad sets" },
  { key: "campaigns", label: "Pause and turn on campaigns" },
]
export function permissionsInitial(value) {
  return Object.fromEntries(PERMISSIONS.map(({ key }) => [key, Boolean(value?.[key])]))
}
export const permissionsBody = (state) => Object.fromEntries(PERMISSIONS.map(({ key }) => [key, Boolean(state?.[key])]))

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export function scheduleInitial(value) {
  return {
    time: TIME_RE.test(value?.time ?? "") ? value.time : "07:00",
    tz: typeof value?.tz === "string" && value.tz ? value.tz : browserZone(),
    days: value?.days === "weekdays" ? "weekdays" : "daily",
  }
}
export function scheduleBody({ time, tz, days }) {
  if (!TIME_RE.test(time ?? "")) return { error: "Pick a time." }
  return { body: { time, tz: tz || "UTC", days: days === "weekdays" ? "weekdays" : "daily" } }
}
export const zonesWith = (tz) => (COMMON_TIMEZONES.includes(tz) ? COMMON_TIMEZONES : [tz, ...COMMON_TIMEZONES])

/**
 * The Sales Coach's choices for "booked" and "closed", from outcome-options:
 * each tag, and each stage of each pipeline. `id` is unique across both kinds.
 */
export function outcomeChoices(options) {
  const tags = (Array.isArray(options?.tags) ? options.tags : [])
    .filter((t) => t && t.value)
    .map((t) => ({ id: `tag:${t.value}`, kind: "tag", value: String(t.value), label: String(t.label || t.value) }))
  const stages = (Array.isArray(options?.pipelines) ? options.pipelines : []).flatMap((p) =>
    (Array.isArray(p?.stages) ? p.stages : [])
      .filter((s) => s && s.id)
      .map((s) => ({ id: `stage:${s.id}`, kind: "stage", value: String(s.id), label: `${p.name || "Pipeline"} · ${s.name || s.id}` })))
  return { tags, stages, all: [...tags, ...stages] }
}
export const outcomeId = (answer) => (answer?.kind && answer?.value ? `${answer.kind}:${answer.value}` : "")
export function outcomesBody(choices, bookedId, closedId) {
  const find = (id) => choices.all.find((c) => c.id === id)
  const booked = find(bookedId)
  const closed = find(closedId)
  if (!booked || !closed) return { error: "Pick one for booked and one for closed." }
  const pick = (c) => ({ kind: c.kind, value: c.value, label: c.label })
  return { body: { booked: pick(booked), closed: pick(closed) } }
}

/** speed: how many minutes a new lead may wait for a call. */
export const SPEED_CHOICES = [5, 15, 30, 60]
export function speedBody(raw) {
  const n = Number(String(raw ?? "").trim())
  if (!Number.isInteger(n) || n < 1 || n > 1440) return { error: "Type a whole number of minutes, from 1 to 1440." }
  return { body: { minutes: n } }
}

const humanize = (key) => {
  const words = String(key).replace(/_/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * A practice run's summary as lines to show: its numbers and short texts, in
 * the order the server sent them. Lists show as a count; nested objects, flags and timestamps are skipped.
 */
// The words for the fields the practice run's summary has today (ai/team/setup.py practice_status).
const PRACTICE_LABELS = { clients: "Clients checked", cards: "Cards it would post", changes: "Changes it would propose" }
const ISO = /^\d{4}-\d{2}-\d{2}T/

export function practiceLines(summary) {
  if (!summary || typeof summary !== "object") return []
  const out = []
  for (const [key, v] of Object.entries(summary)) {
    const label = PRACTICE_LABELS[key] ?? humanize(key)
    if (typeof v === "number" && Number.isFinite(v)) out.push({ key, label, value: v.toLocaleString("en-GB") })
    else if (typeof v === "string" && v.trim() && v.length <= 160 && !ISO.test(v)) out.push({ key, label, value: v.trim() })
    else if (Array.isArray(v)) out.push({ key, label: humanize(key), value: v.length.toLocaleString("en-GB") })
  }
  return out
}

const MODE_WORDS = { flag: "Only suggests", ask: "Asks you first", auto: "Acts on its own" }
const MODE_KINDS = [["remove", "Pausing ads"], ["add", "Adding ads"], ["revive", "Turning old ads back on"]]
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)

/**
 * Media Buyer's playbook as lines to review, from the playbook block's
 * `modes` and `scoring` (the stock agent's own settings). Only what the block
 * carries is shown; `creative` is left out until its fields have agreed words.
 */
export function playbookLines(block) {
  const out = []
  const modes = block?.modes && typeof block.modes === "object" ? block.modes : null
  if (modes) for (const [kind, label] of MODE_KINDS) if (MODE_WORDS[modes[kind]]) out.push({ label, value: MODE_WORDS[modes[kind]] })
  const s = block?.scoring && typeof block.scoring === "object" ? block.scoring : {}
  if (num(s.min_days) !== null) out.push({ label: "Judges an ad after", value: `${s.min_days} days` })
  if (num(s.lose_cpl_multiple) !== null) out.push({ label: "A loser", value: `Cost per lead over ${s.lose_cpl_multiple}× the target` })
  return out
}
