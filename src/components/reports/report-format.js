// Words for a Slack report's trigger, last run and content, shared by the hub
// cards and the report form. Reports themselves live server-side
// (birdy-backend/services/slack_reports.py).

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export const EVENTS = [
  { value: "alert_fired", label: "An alert fires", hint: "Sends once each time the alert starts firing." },
  { value: "metric_created", label: "A metric is created", hint: "Any new custom metric, made by you or Birdy." },
  { value: "account_created", label: "A new account is added", hint: "A client added by hand or imported (one message per import)." },
]

// Intl.supportedValuesOf is not available everywhere; the common zones, plus
// whatever the report or account already uses (see timezoneOptions).
export const TIMEZONES = [
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Australia/Sydney", "UTC",
]

export function timezoneOptions(...current) {
  const extra = current.filter((tz) => tz && !TIMEZONES.includes(tz))
  return [...new Set(extra), ...TIMEZONES]
}

/** "16:45" → "4:45 PM" */
export function timeLabel(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "")
  if (!m) return hhmm || ""
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`
}

/** "Daily · 9:00 AM", "Mondays · 8:30 AM", "\"CPL high\" fires", "New account added" */
export function triggerLabel(trigger, alerts = []) {
  if (!trigger) return ""
  if (trigger.type === "schedule") {
    const when = trigger.frequency === "weekly" ? `${trigger.day || "Monday"}s` : "Daily"
    return `${when} · ${timeLabel(trigger.time)}`
  }
  if (trigger.event === "alert_fired") {
    if (!trigger.alert_id) return "Any alert fires"
    const alert = alerts.find((a) => a.id === trigger.alert_id)
    return alert ? `“${alert.name}” fires` : "An alert fires"
  }
  if (trigger.event === "metric_created") return "Metric created"
  if (trigger.event === "account_created") return "New account added"
  return ""
}

const ERRORS = {
  not_in_channel: "Birdy isn't in that channel — invite it with /invite @Birdy",
  channel_not_found: "That channel no longer exists",
  is_archived: "That channel is archived",
  invalid_auth: "Slack needs reconnecting",
  account_inactive: "Slack needs reconnecting",
  token_revoked: "Slack needs reconnecting",
}

/** Slack's error code (or our skip reason) as something a person can act on. */
export function errorLabel(error) {
  return ERRORS[error] || error || "Couldn't post to Slack"
}

/** { tone, text } for a card's last-run line, or null when it never ran. */
export function lastRunLabel(lastRun, now = new Date()) {
  if (!lastRun?.at) return null
  const at = new Date(lastRun.at.endsWith?.("Z") || /[+-]\d\d:\d\d$/.test(lastRun.at) ? lastRun.at : `${lastRun.at}Z`)
  const when = sameDay(at, now)
    ? `today ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
  if (lastRun.status === "sent") return { tone: "success", text: `Sent ${when}` }
  if (lastRun.status === "failed") return { tone: "danger", text: `Failed ${when}: ${errorLabel(lastRun.error)}` }
  return { tone: "neutral", text: `Skipped ${when}: ${errorLabel(lastRun.error)}` }
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const BLOCK_WORDS = {
  header: "Header", section: "Text", divider: "Divider", image: "Image", context: "Note",
  actions: "Buttons", rich_text: "Text", markdown: "Text", table: "Table", card: "Card",
}

/** The server's one-line-per-block summary, shortened for a card. */
export function contentSummary(summary = []) {
  const words = summary.map((line) => {
    if (/chart/.test(line)) return "Chart"
    if (/^(data_table|table) of/.test(line)) return "Clients table"
    if (/^carousel/.test(line)) return "Client cards"
    return BLOCK_WORDS[line] || null
  }).filter(Boolean)
  const counted = []
  for (const w of words) {
    const last = counted[counted.length - 1]
    if (last && last.w === w) last.n += 1
    else counted.push({ w, n: 1 })
  }
  return counted.map(({ w, n }) => (n > 1 ? `${n} × ${w.toLowerCase()}` : w)).join(" · ")
}

/** The heading of a report's content (its header block), placeholders kept readable. */
export function contentTitle(template) {
  const header = (template?.blocks || []).find((b) => b.type === "header")
  const text = header?.text?.text || header?.text
  return typeof text === "string" ? text.replace(/\{\{\s*([a-z_]+)[^}]*\}\}/g, (_, n) => `‹${n.replace(/_/g, " ")}›`) : null
}

/** Window the report's numbers cover: the template's frequency. */
export const DATA_WINDOWS = [
  { value: "daily", label: "Yesterday" },
  { value: "weekly", label: "Last 7 days" },
]
