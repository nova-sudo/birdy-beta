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
    // A message without a usable date has no place in the timeline.
    ...(messages || [])
      .filter((message) => message.date && !Number.isNaN(new Date(message.date).getTime()))
      .map((message) => ({ at: message.date, item: { kind: "message", ...message } })),
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

const JOURNEY_CHIPS = {
  conversion: { label: "CONVERSION", tone: "success" },
  appointment: { label: "APPOINTMENT", tone: "success" },
  call: { label: "CALL", tone: "primary" },
  visit: { label: "PAGE VIEW", tone: "amber" },
  stage: { label: "STAGE", tone: "neutral" },
  lead: { label: "LEAD", tone: "neutral" },
}

/** The small coloured chip for a Journey event kind. */
export function journeyChip(kind) {
  return JOURNEY_CHIPS[kind] || { label: kind ? String(kind).toUpperCase() : "EVENT", tone: "neutral" }
}

const timeOptions = {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
}
const journeyTimeFormat = new Intl.DateTimeFormat("en-GB", timeOptions)
const utcTimeFormat = new Intl.DateTimeFormat("en-GB", { ...timeOptions, timeZone: "UTC" })

function renderTime(format, date) {
  const p = Object.fromEntries(format.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${(p.dayPeriod || "").toUpperCase()}`.trim()
}

/** "17 Jul, 4:59 PM", or "" when there is no usable time. */
export function formatJourneyTime(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return renderTime(journeyTimeFormat, date)
}

/**
 * "20 Jul, 9:30 AM" from a zone-less "YYYY-MM-DDTHH:MM[:SS]" string, read as
 * written (the location's clock) with no timezone conversion. "" if malformed.
 * Formatted as a UTC date with the same formatter as formatJourneyTime so month
 * abbreviations match.
 */
export function formatLocalClock(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(str || "")
  if (!m) return ""
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return ""
  return renderTime(utcTimeFormat, new Date(Date.UTC(Number(m[1]), month - 1, day, hour, minute)))
}
