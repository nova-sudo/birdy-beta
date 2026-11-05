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

const ANSWERED = new Set(["completed", "answered"])
// Mirrors services/ghl_messages.is_same_call in the backend.
const SAME_CALL_SECONDS = 60
const ESTIMATED_SLACK_SECONDS = 180

/**
 * Whether a GHL call message and a logged call (any dialer) are one call —
 * mirrors services/ghl_messages.is_same_call. GHL stamps a call when it is
 * logged, at or after its end; a dialer stamps the start (HotProspector only
 * to the minute). So the GHL time may fall from a minute before the logged
 * start to the logged call's end plus the slack.
 */
export function isSameCall(ghlCall, logged) {
  const a = (ghlCall.direction || "").toLowerCase()
  const b = (logged.direction || "").toLowerCase()
  if (a && b && a !== b) return false
  const ghlAt = new Date(ghlCall.started_at).getTime()
  const loggedAt = new Date(logged.started_at).getTime()
  if (Number.isNaN(ghlAt) || Number.isNaN(loggedAt)) return false
  const gap = (loggedAt - ghlAt) / 1000
  if (logged.started_at_estimated) return gap >= 0 && gap <= (ghlCall.duration_seconds || 0) + ESTIMATED_SLACK_SECONDS
  return gap <= SAME_CALL_SECONDS && -gap <= (logged.duration_seconds || 0) + ESTIMATED_SLACK_SECONDS
}

/**
 * The lead detail with GHL calls (from the messages response, minus any
 * already among its logged calls) added to
 * `calls`, each given the backend paths for its recording and transcript, and
 * counted in engagement the way the backend counts call_logs calls.
 */
export function withGhlCalls(detail, ghlCalls, contactId) {
  // A call both dialers saw shows once, from the call log, which has its recording.
  ghlCalls = (ghlCalls || []).filter((g) => !(detail.calls || []).some((c) => isSameCall(g, c)))
  if (!ghlCalls.length) return detail
  const base = `/api/leads/contact/${encodeURIComponent(contactId)}/calls`
  const calls = ghlCalls.map((call) => {
    const id = encodeURIComponent(call.ghl_message_id)
    return { ...call, recording_path: `${base}/${id}/recording`, transcript_path: `${base}/${id}/transcript` }
  })
  const engagement = detail.engagement || {}
  return {
    ...detail,
    calls: [...(detail.calls || []), ...calls],
    engagement: {
      ...engagement,
      touchpoints: (engagement.touchpoints ?? 0) + calls.length,
      dials: (engagement.dials ?? 0) + calls.filter((c) => c.direction === "outbound").length,
      answered: (engagement.answered ?? 0) + calls.filter((c) => ANSWERED.has(c.status)).length,
    },
  }
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

/** "just now" (under a minute, or a future time from clock skew), "1 min ago", "5 mins ago", "1 hour ago", "3 days ago", "1 day ago". */
export function timeAgo(iso, now = new Date()) {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const minutes = Math.floor((new Date(now).getTime() - then) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} mins ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}
