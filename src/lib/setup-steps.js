// Birdy's own setup (/welcome), before the agents interview the owner (those
// live in lib/team-setup). Every step's state is worked out from what the
// account really has (connections, clients, targets, the answers saved with
// /api/onboarding/state), never from a flag kept in the browser.

/** @typedef {"ops"|"buyer"|"coach"|"subs"} SetupSection */
/** @typedef {"todo"|"setup"|"issue"|"done"} StepState */

/** Birdy's checklist, in order. */
export const STEPS = [
  { id: "basics", label: "Agency basics" },
  { id: "meta", label: "Connect Meta" },
  { id: "ghl", label: "Connect GoHighLevel" },
  { id: "calling", label: "Calling: GoHighLevel or Hot Prospector" },
  { id: "plan", label: "Pick your plan" },
  { id: "client", label: "Your first client" },
  { id: "targets", label: "Targets" },
  { id: "slack", label: "Slack: alerts and reports" },
  { id: "import", label: "The rest of your clients" },
]

export const SECTION_ORDER = ["ops", "buyer", "coach", "subs"]

/** `?s=` on /welcome: the reference's names (birdy, mb, sales), the rail's ids and the server's agent keys all work. */
export function sectionParam(value) {
  if (value === "mb" || value === "buyer" || value === "media_buyer") return "buyer"
  if (value === "sales" || value === "coach" || value === "sales_coach") return "coach"
  if (value === "subs" || value === "sub_agents") return "subs"
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
 * @property {{subscribed?: boolean, needs_plan?: boolean, sandbox?: boolean, plan?: object}|null} [billing] GET /api/billing/status
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

/**
 * The plan step: done with an active subscription, or when the account needs
 * no plan (an admin gave it a client limit). Billing's own answer comes first,
 * then onboarding's. When neither says (an older backend), a finished account
 * is left alone and an unfinished one is asked.
 */
function planState(facts) {
  const billing = facts.billing
  if (billing?.subscribed) return "done"
  const needsPlan = billing?.needs_plan ?? facts.onboarding?.needs_plan
  if (needsPlan === false) return "done"
  if (needsPlan === true) return "todo"
  return facts.onboarding?.completed ? "done" : "todo"
}

/** The steps that come before the plan: the plan step opens once these are done. */
export const BEFORE_PLAN = ["basics", "meta", "ghl", "calling"]

/**
 * Is the plan step the one on screen? It is when it isn't done and the tools
 * are connected, or at once for an account that finished setup before plans
 * were required: that account only has the plan left to do.
 */
export function planIsCurrent(steps, completed = false) {
  if (steps.plan === "done") return false
  return completed || BEFORE_PLAN.every((id) => steps[id] === "done")
}

/**
 * Does the account belong in setup until it's done? Unfinished setup does,
 * and so does a finished account without a plan. With `steps` (billing read
 * too) the plan step decides; without, onboarding's own `needs_plan` does.
 */
export function setupHolds(onboarding, steps) {
  if (!onboarding) return false
  if (!onboarding.completed) return true
  return steps ? steps.plan !== "done" : onboarding.needs_plan === true
}

/**
 * How many clients the plan has to fit, from what setup already knows: the
 * GoHighLevel sub-accounts Birdy holds tokens for, or the clients already in
 * Birdy, whichever is more. Null when neither says.
 * @returns {{count: number, source: "ghl"|"clients"}|null}
 */
export function clientsToFit(facts) {
  const subs = Object.keys(facts.status?.gohighlevel?.subaccounts || {}).length
  const clients = (facts.clients || []).length
  if (!subs && !clients) return null
  return subs >= clients ? { count: subs, source: "ghl" } : { count: clients, source: "clients" }
}

/** @returns {Record<string, StepState>} */
export function deriveSteps(facts) {
  const onboarding = facts.onboarding || {}
  const data = onboarding.data || {}
  const clients = facts.clients || []
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
  const plan = planState(facts)
  const importState = clients.length >= 2 || data.wants_sync === false || onboarding.completed ? "done" : "todo"
  return { basics, meta, ghl: ghlState, calling, plan, client, targets, slack: slackState, import: importState }
}

export const pctDone = (steps) => Math.round((STEPS.filter((s) => steps[s.id] === "done").length / STEPS.length) * 100)
export const allDone = (steps) => STEPS.every((s) => steps[s.id] === "done")
export const stepsLeft = (steps) => STEPS.filter((s) => steps[s.id] !== "done").length

/** The first step that isn't done, or null. */
export const nextStep = (steps) => STEPS.find((s) => steps[s.id] !== "done")?.id ?? null
