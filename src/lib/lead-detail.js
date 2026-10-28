/**
 * Pure helpers for the /contacts/[contactId] lead detail page.
 */

export function leadTitle(contact) {
  const name = contact?.name?.trim()
  if (name) return name
  const phone = contact?.phone?.trim()
  if (phone) return phone
  return "Unknown lead"
}

const PILL_TONE = {
  won: "won",
  lost: "lost",
  abandoned: "lost",
  open: "open",
}

export function statusPill(opportunities) {
  const first = opportunities?.[0]
  if (!first) return null
  const label = first.stage_name || first.status
  return { label, tone: PILL_TONE[first.status] || "neutral" }
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—"
  const total = Math.round(seconds)
  if (total < 3600) {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${h}h ${m}m`
}

export function cameFrom(detail) {
  const adName = detail?.attribution?.ad_name
  if (adName) return `Meta · ${adName}`
  return detail?.contact?.source || "—"
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

// en-GB renders "Friday 17 July" in some ICU builds and "Friday, 17 July" in
// others. Build the label from parts so the comma is always there.
function dayLabel(date) {
  const parts = Object.fromEntries(dayFormat.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.weekday}, ${parts.day} ${parts.month}`
}

function localDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function initials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  return words.slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join("")
}

/** Calls and messages merged oldest first, grouped by local day. */
export function threadDays(calls, messages = []) {
  const entries = [
    ...(calls || []).map((call) => ({ at: call.started_at, item: { kind: "call", ...call } })),
    ...(messages || []).map((message) => ({ at: message.date, item: { kind: "message", ...message } })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))
  const days = []
  let current = null
  for (const { at, item } of entries) {
    const date = new Date(at)
    const key = localDayKey(date)
    if (!current || current.key !== key) {
      current = { key, day: dayLabel(date), items: [] }
      days.push(current)
    }
    current.items.push(item)
  }
  return days.map(({ day, items }) => ({ day, items }))
}
