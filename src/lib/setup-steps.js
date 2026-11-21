// Setup (/welcome), in funnel order: Agency Ops first, then Media Buyer, then
// Sales Coach. Every step's state is worked out from what the account really
// has (connections, clients, targets, the answers saved with
// /api/onboarding/state), never from a flag kept in the browser. A section
// stays locked until the one before it is set up.

import { isActive } from "./client-status"

/** @typedef {"ops"|"buyer"|"coach"} SetupSection */
/** @typedef {"todo"|"setup"|"issue"|"done"} StepState */

/** The checklist, in order. `section`: whose setup chat asks it. */
export const STEPS = [
  { id: "basics", section: "ops", label: "Agency basics" },
  { id: "meta", section: "ops", label: "Connect Meta" },
  { id: "ghl", section: "ops", label: "Connect GoHighLevel" },
  { id: "calling", section: "ops", label: "Calling: GoHighLevel or Hot Prospector" },
  { id: "client", section: "ops", label: "Your first client" },
  { id: "targets", section: "ops", label: "Targets" },
  { id: "slack", section: "ops", label: "Slack: alerts and reports" },
  { id: "import", section: "ops", label: "The rest of your clients" },
  { id: "cpl", section: "buyer", label: "Media Buyer: CPL limits per client" },
]

export const SECTION_ORDER = ["ops", "buyer", "coach"]

/** `?s=` on /welcome: the reference's names (birdy, mb, sales) and the rail's ids both work. */
export function sectionParam(value) {
  if (value === "mb" || value === "buyer") return "buyer"
  if (value === "sales" || value === "coach") return "coach"
  return "ops"
}

// The monthly targets a client group stores, as named by the Targets form in
// components/clients/ClientTargetsForm.jsx. Listed rather than read off the
// object so an unrelated field arriving on `targets` is never mistaken for a
// goal; this list has to gain a field whenever that form does.
export const TARGET_FIELDS = ["cpa", "cpl", "cost_per_appointment", "monthly_wins", "monthly_revenue", "conversion_rate", "monthly_spend", "aov"]

const filled = (v) => v !== null && v !== undefined && v !== ""

/** Has anyone given this client a target yet? */
export function hasAnyTarget(targets) {
  if (!targets) return false
  return TARGET_FIELDS.some((field) => filled(targets[field]))
}

/** A client's cost-per-lead limit, or null when it has none. */
export function cplOf(group) {
  const v = Number(group?.targets?.cpl)
  return filled(group?.targets?.cpl) && Number.isFinite(v) && v > 0 ? v : null
}

/**
 * The three answers from the targets step, as PUT /api/client-groups/{id}/targets
 * stores them: `cpa` under its own name, the conversion rate as a fraction
 * (typed as 15 under a "%" it means 0.15). Empty boxes are left out, because
 * the endpoint merges and an omitted field keeps what is stored. Null when
 * nothing was filled in, so the caller can skip the request.
 */
export function buildTargetsPayload({ cpa, wins, convRate, saveAsDefault = false }) {
  const num = (raw) => {
    const t = String(raw ?? "").trim()
    if (t === "") return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  const targets = {}
  const c = num(cpa), w = num(wins), r = num(convRate)
  if (c !== null) targets.cpa = c
  if (w !== null) targets.monthly_wins = w
  if (r !== null) targets.conversion_rate = r / 100
  if (Object.keys(targets).length === 0) return null
  return { ...targets, save_as_default: Boolean(saveAsDefault) }
}

/** The currencies the backend accepts for the account (SUPPORTED_CURRENCIES in routers/onboarding.py). */
export const CURRENCIES = [
  { code: "GBP", label: "British Pound" },
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "AED", label: "UAE Dirham" },
  { code: "SAR", label: "Saudi Riyal" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "INR", label: "Indian Rupee" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CNY", label: "Chinese Yuan" },
]

/**
 * What the account has, gathered from the API. Any of these may be null while
 * loading or when its request failed.
 * @typedef {object} SetupFacts
 * @property {{completed?: boolean, data?: object, name?: string, agency_name?: string, default_currency?: string}|null} onboarding GET /api/onboarding/status
 * @property {object|null} status GET /api/status
 * @property {{connected?: boolean}|null} hp GET /api/hotprospector/status
 * @property {{installed?: boolean, needs_reconnect?: boolean, notify_channel_id?: string}|null} slack GET /api/integrations/slack/status
 * @property {object[]|null} clients the client groups
 */

/** The basics as known: the saved answers first, then the profile. */
export function basicsOf(onboarding) {
  const data = onboarding?.data || {}
  return {
    name: (onboarding?.name || data.name || "").trim(),
    agency: (onboarding?.agency_name || data.agency || "").trim(),
    currency: onboarding?.default_currency || data.currency || "",
  }
}

/** Where calls come from: "ghl", "hp", "none", or null when not answered yet. */
export function callingTool(facts) {
  const tool = facts.onboarding?.data?.sales_tool
  if (tool === "ghl" || tool === "hp" || tool === "none") return tool
  if (facts.hp?.connected) return "hp"
  return null
}

/** @returns {Record<string, StepState>} */
export function deriveSteps(facts) {
  const onboarding = facts.onboarding || {}
  const data = onboarding.data || {}
  const clients = facts.clients || []
  const active = clients.filter(isActive)
  const b = basicsOf(facts.onboarding)
  const fb = facts.status?.facebook || {}
  const ghl = facts.status?.gohighlevel?.agency || {}
  const slack = facts.slack || {}
  const tool = callingTool(facts)

  const basics = b.name && b.agency && b.currency ? "done" : b.name || b.agency ? "setup" : "todo"
  const meta = fb.connected ? (fb.token_expired ? "issue" : "done") : "todo"
  const ghlState = ghl.connected ? "done" : "todo"
  // A client made in the Add client dialog says where its calls come from, so that answers it too.
  const calling = tool === "ghl" || tool === "none" ? "done"
    : tool === "hp" ? (facts.hp?.connected ? "done" : "setup")
    : clients.some((g) => g.call_log_provider) ? "done" : "todo"
  const creating = clients.some((g) => g.status === "creating" || g.status === "pending")
  const client = clients.length > 0 ? (creating && clients.length === 1 ? "setup" : "done") : "todo"
  const targets = clients.some((g) => hasAnyTarget(g.targets)) ? "done" : "todo"
  const slackState = slack.installed
    ? slack.needs_reconnect ? "issue" : slack.notify_channel_id || data.slack ? "done" : "setup"
    : "todo"
  const importState = clients.length >= 2 || data.wants_sync === false || onboarding.completed ? "done" : "todo"
  const withCpl = active.filter((g) => cplOf(g) !== null).length
  const cpl = active.length > 0 && withCpl === active.length ? "done" : withCpl > 0 ? "setup" : "todo"

  return { basics, meta, ghl: ghlState, calling, client, targets, slack: slackState, import: importState, cpl }
}

/** A section is set up when all its steps are. Sales Coach has none of its own yet. */
export const sectionDone = (steps, section) => STEPS.filter((s) => s.section === section).every((s) => steps[s.id] === "done")

/** Agency Ops is always open; Media Buyer opens once Agency Ops is set up, Sales Coach once Media Buyer is. */
export function unlocked(steps, section) {
  if (section === "buyer") return sectionDone(steps, "ops")
  if (section === "coach") return sectionDone(steps, "ops") && sectionDone(steps, "buyer")
  return true
}

/** The section a locked one waits on. */
export const waitsOn = (section) => (section === "coach" ? "buyer" : "ops")

export const pctDone = (steps) => Math.round((STEPS.filter((s) => steps[s.id] === "done").length / STEPS.length) * 100)
export const allDone = (steps) => STEPS.every((s) => steps[s.id] === "done")
export const stepsLeft = (steps) => STEPS.filter((s) => steps[s.id] !== "done").length

/** The first step of a section that isn't done, or null. */
export const nextStep = (steps, section) => STEPS.find((s) => s.section === section && steps[s.id] !== "done")?.id ?? null

/** The CPL limit most active clients already share, to suggest it; null when none has one. */
export function commonCpl(clients) {
  const counts = new Map()
  for (const g of (clients || []).filter(isActive)) {
    const v = cplOf(g)
    if (v !== null) counts.set(v, (counts.get(v) || 0) + 1)
  }
  let best = null
  for (const [v, n] of counts) if (best === null || n > counts.get(best)) best = v
  return best
}

/**
 * Which CPL limits to write. `edits` maps a client id to the limit typed for
 * it; every other active client without a limit gets `all`. A limit someone
 * already set is only changed when it was edited here. Anything that isn't a
 * positive number is skipped.
 * @returns {{id: string, cpl: number}[]}
 */
export function cplWrites(clients, all, edits = {}) {
  const valid = (v) => {
    const n = Number(String(v ?? "").trim())
    return String(v ?? "").trim() !== "" && Number.isFinite(n) && n > 0 && n < 100000 ? n : null
  }
  const fallback = valid(all)
  const out = []
  for (const g of (clients || []).filter(isActive)) {
    const own = cplOf(g)
    const edited = g.id in edits ? valid(edits[g.id]) : null
    const next = edited ?? (own === null ? fallback : null)
    if (next !== null && next !== own) out.push({ id: g.id, cpl: next })
  }
  return out
}
