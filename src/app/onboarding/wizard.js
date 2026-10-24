// The wizard's step lists, phases and pure helpers. Kept apart from page.jsx so
// the state machine reads on its own and the step files can share the constants.

export const STEPS = [
  "welcome", "welcome_name", "agency", "connect_ghl",
  "client_picker", "connect_meta", "meta_ad_picker", "sales_tool", "hp_key",
  "client_confirm", "client_currency", "sync_prompt",
  "kpi_targets", "kpi_default", "slack_connect", "slack_channel",
  "report_copilot", "sub_accounts_review", "billing", "completion",
]

// The list before the report copilot replaced the frequency and brief-content
// steps. A saved step is an index, so a wizard paused under the old list is
// translated through its step *name* on resume (see the boot effect) — read
// against the new list directly, everyone past the Slack steps would land one
// step further on than they were, which skips the sub-account review.
export const STEPS_V1 = [
  "welcome", "welcome_name", "agency", "connect_ghl",
  "client_picker", "connect_meta", "meta_ad_picker", "sales_tool", "hp_key",
  "client_confirm", "client_currency", "sync_prompt",
  "kpi_targets", "kpi_default", "slack_connect", "slack_channel",
  "slack_frequency", "brief_content", "sub_accounts_review", "billing", "completion",
]
export const STEPS_VERSION = 2

export function visibleFor(list, salesTool) {
  return list.filter((s) => (s === "hp_key" ? salesTool === "hp" : true))
}

/** Where a saved step index points in today's wizard. */
export function resumeIndex(savedStep, data) {
  const visible = visibleFor(STEPS, data.sales_tool)
  const step = savedStep || 0
  if (data.steps_version === STEPS_VERSION) return Math.min(step, visible.length - 1)
  const oldVisible = visibleFor(STEPS_V1, data.sales_tool)
  let key = oldVisible[Math.min(step, oldVisible.length - 1)]
  if (key === "slack_frequency" || key === "brief_content") key = "report_copilot"
  const idx = visible.indexOf(key)
  return idx === -1 ? Math.min(step, visible.length - 1) : idx
}

export const PHASE_OF = {
  welcome: 1, welcome_name: 1, agency: 1,
  connect_ghl: 2, connect_meta: 2,
  sales_tool: 3, hp_key: 3,
  client_picker: 4, client_confirm: 4, client_currency: 4, meta_ad_picker: 4, sync_prompt: 4,
  kpi_targets: 5, kpi_default: 5,
  slack_connect: 6, slack_channel: 6, report_copilot: 6,
  sub_accounts_review: 7, billing: 8, completion: 9,
}

export const PHASE_LABEL = {
  1: "Welcome", 2: "Core connections", 3: "Sales stack", 4: "First client",
  5: "KPI targets", 6: "Notifications", 7: "Sub-accounts", 8: "Billing", 9: "Finished",
}

// The twelve the sign-up form used to offer, before currency moved in here.
// Mirrored server-side by SUPPORTED_CURRENCIES in routers/onboarding.py, which
// is what actually guards users.default_currency.
export const CURRENCY_OPTIONS = [
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

export const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-primary-soft)",
]

/**
 * The three answers from the KPI step, as PUT /api/client-groups/{id}/targets
 * actually stores them. Returns null when nothing was filled in, so the caller
 * can skip the request rather than send an empty one.
 *
 * The names the wizard sends have to be the stored ones, and twice they were
 * not:
 *
 *   · the cost box went out as `cpa` when no `cpa` target existed, and the
 *     unknown field took the whole PUT down with it — so `monthly_wins`, the
 *     one name that was right and the one the weekly health pass measures
 *     against, was lost along with it. The fix at the time was to send the
 *     answer as `cpl`, which made the request succeed and stored the wrong
 *     thing: the step asks for a cost per *acquisition* and the client then
 *     reported it on the dashboard as its cost per *lead*, a number the
 *     agency never gave and which is smaller by the width of the funnel.
 *     `cpa` is a real stored target now (see ClientTargetsForm's FIELDS and
 *     client-goals.js), so the box goes out under its own name.
 *   · `conversion_rate` is held as a fraction, because what it is compared
 *     against is closes ÷ leads. Typed under a "%" suffix, 15 means 0.15.
 *
 * Empty boxes are omitted rather than sent as null: the endpoint merges, so an
 * omitted field keeps whatever is already stored instead of blanking it.
 */
export function buildTargetsPayload({ cpa, wins, convRate, saveAsDefault }) {
  const num = (raw) => {
    const trimmed = String(raw ?? "").trim()
    if (trimmed === "") return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }

  const targets = {}
  const costPerAcquisition = num(cpa)
  const monthlyWins = num(wins)
  const rate = num(convRate)
  if (costPerAcquisition !== null) targets.cpa = costPerAcquisition
  if (monthlyWins !== null) targets.monthly_wins = monthlyWins
  if (rate !== null) targets.conversion_rate = rate / 100

  if (Object.keys(targets).length === 0) return null
  return { ...targets, save_as_default: saveAsDefault }
}

// The monthly targets a client group stores, as named by the Targets tab in
// components/clients/ClientTargetsForm.jsx. Listed rather than read off the
// object so an unrelated field arriving on `targets` one day cannot be
// mistaken for someone having set a goal — which also means this list has to
// gain a field whenever that form does, or a client whose only target is the
// new one reads here as having none.
export const TARGET_FIELDS = [
  "cpa", "cpl", "cost_per_appointment", "monthly_wins", "monthly_revenue",
  "conversion_rate", "monthly_spend", "aov",
]

/** Has anyone given this client a target yet? */
export function hasAnyTarget(targets) {
  if (!targets) return false
  return TARGET_FIELDS.some((field) => {
    const value = targets[field]
    return value !== null && value !== undefined && value !== ""
  })
}
