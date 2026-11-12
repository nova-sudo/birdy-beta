// Birdy's first message in a client's chat, and the quick replies under it, built from the card on
// the client with no AI call (spec §3.1). Pure, so the wording is tested on its own.

import { money, openLines } from "@/lib/stock-agent-api"
import { SOON_ALERTS, STOPPED_ALERTS } from "../sheet/rows"

const VERBS = {
  remove: { verb: "Remove", tone: "danger" },
  add: { verb: "Add", tone: "primary" },
  revive: { verb: "Turn back on", tone: "success" },
}
const LINE_STATE_WORDS = {
  proposed: "Not decided",
  flagged: "Flag only",
  queued: "Queued",
  applying: "Applying",
  applied: "Applied",
  failed: "Failed",
  blocked: "Blocked",
  needs_file: "Needs a file",
  undoing: "Undoing",
  undone: "Undone",
  dismissed: "Skipped",
  skipped: "Skipped",
}
/** Alerts worth leading with, most pressing first. */
const ALERT_ORDER = [...STOPPED_ALERTS, ...SOON_ALERTS]

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
/** Money as people say it: "£27", "£16.01". */
const say = (n, currency) => money(n, currency)?.replace(/\.00$/, "") ?? null
const sentence = (s) => {
  const t = String(s ?? "").trim()
  return !t ? "" : /[.!?]$/.test(t) ? t : `${t}.`
}

/** The client's own alert to lead with, if any: stopped first, then stopping soon, then any other critical one. */
export function leadAlert(card, alerts = []) {
  const mine = (alerts ?? []).filter((a) => a && typeof a === "object" && a.client_group_id === card?.client_group_id)
  return (
    ALERT_ORDER.map((code) => mine.find((a) => a.code === code)).find(Boolean) ??
    mine.find((a) => a.severity === "critical") ??
    null
  )
}

/** One line's reason, in the mock's words: "No leads on £27 spent." or "£16.01 a lead on 1 lead, 2.7× its £6 limit." */
export function lineReason(line, { currency, targets } = {}) {
  const cur = line.currency ?? currency
  const bits = []
  if (line.cpl != null) {
    let text = `${say(line.cpl, cur)} a lead on ${plural(Number(line.leads ?? 0), "lead")}`
    const red = targets?.red_over
    if (line.kind === "remove" && red && Number(line.cpl) > red) text += `, ${(Number(line.cpl) / red).toFixed(1)}× its ${say(red, cur)} limit`
    bits.push(sentence(text))
  } else if (Number(line.spend) > 0) {
    bits.push(`No leads on ${say(line.spend, cur)} spent.`)
  }
  if (line.kind === "add") {
    if (line.record?.moves > 0) bits.push(`Worked ${line.record.won} of ${line.record.moves}.`)
    if (line.source) bits.push(`From ${line.source}.`)
  }
  for (const f of line.flags ?? []) if (f?.note) bits.push(sentence(f.note))
  if (line.note) bits.push(sentence(line.note))
  return bits.join(" ")
}

const toLine = (line, i, ctx, readOnly) => ({
  n: i + 1,
  id: line.id,
  verb: VERBS[line.kind]?.verb ?? line.kind,
  tone: VERBS[line.kind]?.tone ?? "neutral",
  ad: line.ad_name,
  reason: lineReason(line, ctx),
  ...(readOnly ? { state: LINE_STATE_WORDS[line.state] ?? line.state } : {}),
})

/** What was decided on a past card, in a sentence. */
function decidedText(card) {
  const lines = card.lines ?? []
  const applied = lines.filter((ln) => ln.state === "applied").length
  if (card.has_newer || card.status === "superseded") return "A newer card replaced this one."
  if (card.status === "dismissed") return applied > 0 ? `${plural(applied, "change")} went through before the card was skipped.` : "This card was skipped."
  if (lines.length === 0) return "There was nothing to decide on this card."
  if (applied === lines.length) return lines.length === 1 ? "The change was applied." : lines.length === 2 ? "Both changes were applied." : `All ${lines.length} changes were applied.`
  if (applied > 0) return `${applied} of ${plural(lines.length, "change")} ${applied === 1 ? "was" : "were"} applied.`
  return "Nothing was decided on this card."
}

/** How the CPL moved, in a sentence. */
function cplText(card) {
  const now = say(card.current_cpl, card.currency)
  const was = say(card.previous_cpl, card.currency)
  const on = card.leads != null ? `, on ${plural(Number(card.leads), "lead")}` : ""
  if (now && was) return `CPL went from ${money(card.previous_cpl, card.currency)} to ${money(card.current_cpl, card.currency)}${on}.`
  if (now) return `CPL was ${money(card.current_cpl, card.currency)}${on}.`
  return ""
}

/**
 * Birdy's opening message about one card.
 * @param {object} card
 * @param {{alerts?: object[], readOnly?: boolean, targets?: {green_under: number, red_over: number}|null}} [opts]
 * @returns {{alert?: {headline: string, detail?: string}, lines: {n, id, verb, tone, ad, reason, state?}[], effect?: string, question?: string, pastNote?: string, note?: string}}
 */
export function openingMessage(card, { alerts = [], readOnly = false, targets = null } = {}) {
  const ctx = { currency: card.currency, targets }
  const out = {}
  const alert = readOnly ? null : leadAlert(card, alerts)
  if (alert) out.alert = { headline: alert.title, ...(alert.detail ? { detail: alert.detail } : {}) }

  if (readOnly) {
    out.lines = (card.lines ?? []).map((ln, i) => toLine(ln, i, ctx, true))
    out.pastNote = ["Read-only.", decidedText(card), cplText(card)].filter(Boolean).join(" ")
    return out
  }

  const open = openLines(card)
  out.lines = open.map((ln, i) => toLine(ln, i, ctx, false))
  if (open.length === 0) {
    out.note = sentence(card.thought_process) || (alert ? "" : "I checked this client and nothing needs doing today.")
    if (!out.note) delete out.note
    return out
  }
  const removes = open.filter((ln) => ln.kind === "remove").length
  if (open.length > 1 && card.ads_live != null) {
    const left = Math.max(0, Number(card.ads_live) - removes)
    out.effect = `Yes to all ${open.length} leaves ${plural(left, "ad")} live.`
  }
  out.question = open.length === 1 ? "Want me to do it?" : `Want me to do all ${open.length}?`
  return out
}

const ALERT_QUESTIONS = {
  payment_issue: "What happens if it isn't paid?",
  prepaid_low: "What happens if it isn't paid?",
  spend_stopped: "Why have the ads stopped?",
  account_disabled: "How do I fix this?",
  risk_review: "How do I fix this?",
}
const ALERT_LINKS = {
  payment_issue: { label: "Open billing in Meta", href: "https://business.facebook.com/billing_hub/payment_settings" },
  prepaid_low: { label: "Open billing in Meta", href: "https://business.facebook.com/billing_hub/payment_settings" },
  account_disabled: { label: "Open Account Quality", href: "https://business.facebook.com/accountquality" },
  risk_review: { label: "Open Account Quality", href: "https://business.facebook.com/accountquality" },
}

/**
 * The quick replies above the composer (spec §3.1). "Yes to all" applies with no AI call; the
 * questions send a real message; links show only when their alert applies; "Set targets" only
 * when the client has no target.
 * @returns {{k: "yes_all"|"why"|"alert_q"|"draft"|"link"|"targets", label: string, href?: string, message?: string}[]}
 */
export function quickReplies(card, { alerts = [], hasTarget = true, readOnly = false } = {}) {
  const out = []
  const alert = readOnly ? null : leadAlert(card, alerts)
  const n = readOnly ? 0 : openLines(card).length
  if (n > 0) {
    out.push({ k: "yes_all", label: n === 1 ? "Yes, do it" : `Yes to all ${n}` })
    out.push({ k: "why", label: "Why this?", message: "Why this?" })
  }
  if (alert) {
    const q = ALERT_QUESTIONS[alert.code] ?? "Why does this matter?"
    out.push({ k: "alert_q", label: q, message: q })
  }
  if (!readOnly) out.push({ k: "draft", label: "Draft a client message", message: "Draft a client message" })
  const link = alert && ALERT_LINKS[alert.code]
  if (link) out.push({ k: "link", label: link.label, href: link.href })
  if (!hasTarget && !readOnly) out.push({ k: "targets", label: "Set targets" })
  return out
}

/** What "Yes to all" came to, in one line, from the lines it covered (their states after the apply). */
export function applySummary(lines = [], res = {}) {
  if (lines.length === 0) {
    if (res?.outcome === "noop" || res?.outcome === "already") return "Nothing here was waiting to be applied."
    return res?.reason || "Nothing changed."
  }
  const count = (state) => lines.filter((ln) => ln.state === state).length
  const applied = count("applied")
  if (applied === lines.length) {
    return lines.length === 1 ? "Done. The change is applied." : lines.length === 2 ? "Done. Both changes are applied." : `Done. All ${lines.length} changes are applied.`
  }
  const parts = [
    applied && `${applied} applied`,
    count("failed") && `${count("failed")} failed`,
    count("blocked") && `${count("blocked")} blocked`,
    count("needs_file") && `${count("needs_file")} waiting for a file`,
    (count("queued") + count("applying")) && `${count("queued") + count("applying")} still going`,
    count("flagged") && `${count("flagged")} only flagged`,
  ].filter(Boolean)
  return parts.length ? `${parts.join(", ")}.` : res?.reason || "Nothing changed."
}
