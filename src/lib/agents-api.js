"use client"

import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { apiRequest } from "@/lib/api"
import { fetcher, optionalFetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"

/** SWR key for the agent list. */
export const AGENTS_KEY = queryKeys.agents()

/**
 * The agents this agency has set up. Only a 404 (the route not deployed yet)
 * reads as "none yet"; any other failure surfaces as `error`, so a page never
 * mistakes a broken list for an empty one.
 */
async function agentsFetcher(endpoint) {
  try {
    const data = await fetcher(endpoint)
    if (Array.isArray(data)) return data
    return Array.isArray(data?.items) ? data.items : []
  } catch (err) {
    if (err?.status === 404) return []
    throw err
  }
}

/** @returns {{ agents: object[], error: Error|undefined, isLoading: boolean, mutate: Function }} */
export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR(AGENTS_KEY, agentsFetcher)
  return { agents: data ?? [], error, isLoading, mutate }
}

const WORK_COUNT_KEY = "agent-work-count"

/** Whether an SWR key holds agent work: one agent's `/work`, or the badge's multi-agent key. */
export function isAgentWorkKey(key) {
  if (Array.isArray(key)) return key[0] === WORK_COUNT_KEY
  return typeof key === "string" && key.startsWith(`${AGENTS_KEY}/`) && key.endsWith("/work")
}

/**
 * Re-reads every cached work list and with them the nav badge. Pass the
 * `mutate` from `useSWRConfig()` so it reaches the app's cache provider.
 */
export function revalidateAgentWork(mutate) {
  return mutate(isAgentWorkKey)
}

const openCount = (work) => (Array.isArray(work?.open) ? work.open.length : 0)

/**
 * Open work items across this user's live agents, for the nav badge; `null`
 * with no live agent (or before anything loaded), so the badge stays hidden.
 * Phase 1 has one agent per user, so this reads the same SWR entry as
 * `useAgentWork` and costs no extra request on the agent page.
 */
export function useAgentWorkCount() {
  const { agents } = useAgents()
  const ids = agents.filter((a) => a.status === "active").map((a) => a.id)
  const one = useSWR(ids.length === 1 ? queryKeys.agentWork(ids[0]) : null, fetcher, FRESH_WORK)
  const many = useSWR(
    ids.length > 1 ? [WORK_COUNT_KEY, ...ids] : null,
    ([, ...list]) => Promise.all(list.map((id) => fetcher(queryKeys.agentWork(id)))),
    FRESH_WORK
  )
  if (ids.length === 0) return null
  if (ids.length === 1) return one.data ? openCount(one.data) : null
  return many.data ? many.data.reduce((n, w) => n + openCount(w), 0) : null
}

// ─── One agent ───────────────────────────────────────────────────────────────
// Each hook takes the agent id and stays idle (null key) until there is one.

/** @returns {{ agent: object|null, error: Error|undefined, isLoading: boolean, mutate: Function }} */
export function useAgent(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.agent(id) : null, fetcher)
  return { agent: data ?? null, error, isLoading, mutate }
}

/** The agent's playbook. @returns {{ rules: object[], error, isLoading, mutate }} */
export function useAgentRules(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.agentRules(id) : null, fetcher)
  return { rules: data ?? [], error, isLoading, mutate }
}

/**
 * The work list changes under an open tab (the morning run, Slack decisions), so
 * unlike the app default it refetches on focus and keeps a short dedupe window.
 */
const FRESH_WORK = { revalidateOnFocus: true, dedupingInterval: 30 * 1000 }

/** Open work items and the last 24h of auto-applied ones. */
export function useAgentWork(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.agentWork(id) : null, fetcher, FRESH_WORK)
  return { work: data ?? { open: [], auto_applied: [] }, error, isLoading, mutate }
}

/** Confidence score; `null` while the route is not deployed yet. */
export function useAgentConfidence(id) {
  const { data, isLoading, mutate } = useSWR(id ? queryKeys.agentConfidence(id) : null, optionalFetcher)
  return { confidence: data ?? null, isLoading, mutate }
}

/** Remembered facts the agent learnt from notes. */
export function useAgentMemory(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.agentMemory(id) : null, fetcher)
  return { memory: data ?? [], error, isLoading, mutate }
}

/**
 * Graduation offers (first) and brake notices. Empty while the route is not
 * deployed, so the work list never fails on it.
 */
export function useAgentOffers(id) {
  const { data, isLoading, mutate } = useSWR(id ? queryKeys.agentOffers(id) : null, optionalFetcher)
  return { offers: Array.isArray(data) ? data : [], isLoading, mutate }
}

/** Open rule-change proposals, newest first. Empty while the route is not deployed. */
export function useAgentProposals(id) {
  const { data, isLoading, mutate } = useSWR(id ? queryKeys.agentProposals(id) : null, optionalFetcher)
  return { proposals: Array.isArray(data) ? data : [], isLoading, mutate }
}

/**
 * Re-reads everything a learning decision can change: the rules (mode, params,
 * stats), offers, proposals and the work list (open items carry `rule_mode`).
 * Pass the `mutate` from `useSWRConfig()`.
 */
export function revalidateAgentLearning(mutate, id) {
  return Promise.all([
    mutate(queryKeys.agentRules(id)),
    mutate(queryKeys.agentOffers(id)),
    mutate(queryKeys.agentProposals(id)),
    revalidateAgentWork(mutate),
  ])
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Sends a request and returns its JSON. A failure throws an Error carrying
 * `status` and the server's `detail` (which may be an object, e.g. `{missing}`).
 */
async function send(endpoint, method, body) {
  const res = await apiRequest(endpoint, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // Empty or non-JSON body.
  }
  if (!res.ok) {
    const detail = data?.detail ?? data?.error ?? null
    const err = new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`)
    err.status = res.status
    err.detail = detail
    // A decision on an item that is no longer open (409) says what it is now.
    if (typeof data?.outcome === "string") err.outcome = data.outcome
    if (typeof data?.status === "string") err.itemStatus = data.status
    if (data?.decided_by) err.decidedBy = data.decided_by
    // Activation's 409 carries `missing` beside `detail`, not inside it.
    if (Array.isArray(data?.missing)) err.missing = data.missing
    throw err
  }
  return data
}

/** Creates this user's media buying agent. 409 when one already exists. */
export function createAgent() {
  return send(queryKeys.agents(), "POST")
}

/** `{scope?, permissions?, guardrails?, client_caps?}`; scope and schedule are merged server-side. */
export function patchAgent(id, patch) {
  return send(queryKeys.agent(id), "PATCH", patch)
}

/** `{params?, client_overrides?, mode?, enabled?}`; mode "auto" is refused (400). */
export function patchRule(id, ruleId, patch) {
  return send(`${queryKeys.agentRules(id)}/${encodeURIComponent(ruleId)}`, "PATCH", patch)
}

/** Sets (number) or clears (null) one client's CPL target. Any owned client; it does not change the scope. */
export function setClientTarget(id, gid, cpl) {
  return send(`${queryKeys.agent(id)}/client-targets/${encodeURIComponent(gid)}`, "PUT", { cpl })
}

/** Starts (or rejoins) the 30-day dry run. @returns {Promise<{job_id: string}>} */
export function startDryRun(id) {
  return send(`${queryKeys.agent(id)}/dry-run`, "POST")
}

/** One read of a job. @returns {Promise<{status: "queued"|"running"|"done"|"failed", result?: object, error?: string}>} */
export function pollJob(id, jobId) {
  return send(queryKeys.agentJob(id, jobId), "GET")
}

// ─── Practice cases ──────────────────────────────────────────────────────────

/**
 * Up to `k` practice cases; unanswered ones already served come first. Each is
 * `{case_id, rule_kind, client_name, title, facts: [{label, value}], options,
 * birdy_answer, why}`. The UI keeps birdy_answer and why hidden until answered.
 */
export function fetchPractice(id, k = 3) {
  return send(`${queryKeys.agentPractice(id)}?k=${encodeURIComponent(k)}`, "GET")
}

/** Answers a case with one of its options. @returns {Promise<{agreed: boolean, birdy_answer: string, why: string}>} 409 if answered. */
export function answerPractice(id, caseId, answer) {
  return send(`${queryKeys.agentPractice(id)}/${encodeURIComponent(caseId)}`, "POST", { answer })
}

/** Settles a disagreement: "birdy_right" | "user_right". 409 unless the case is pending. */
export function resolvePractice(id, caseId, resolution) {
  return send(`${queryKeys.agentPractice(id)}/${encodeURIComponent(caseId)}/resolve`, "POST", { resolution })
}

/** Turns the agent on. 409 `{detail, missing}` (missing on the error as `err.missing`) when it is not ready yet. */
export function activateAgent(id) {
  return send(`${queryKeys.agent(id)}/activate`, "POST")
}

// ─── Work list decisions ─────────────────────────────────────────────────────
// Agent work items are suggestions, so they share the dashboard's routes.

const suggestionPath = (id) => `/api/dashboard/suggestions/${encodeURIComponent(id)}`

/**
 * Approves (or, for a flag item with nothing to write, marks handled) a work item.
 * @returns {Promise<{ok: boolean, outcome: string, succeeded: object[], failed: object[], blocked_reason: {code: string, message: string}|null, decided_by: {actor: string, source: string}|null}>}
 *   A guardrail block is `ok: false, outcome: "blocked"`; `outcome: "already"` means
 *   someone else applied it; a Meta failure throws (502); an item that was closed
 *   meanwhile throws 409 with `err.outcome === "closed"`.
 */
export function applyWorkItem(id) {
  return send(`${suggestionPath(id)}/apply`, "POST")
}

/**
 * Declines a work item. `reason_code` is one of DENY_REASONS' codes. 409 while it
 * is being applied, or (`err.outcome === "already"`, `err.itemStatus`) when it was
 * applied or closed meanwhile.
 */
export function denyWorkItem(id, { reason_code, note }) {
  const body = { reason_code }
  if (note && note.trim()) body.note = note.trim()
  return send(`${suggestionPath(id)}/deny`, "POST", body)
}

/** Dismisses a work item without a reason. 409 as for denyWorkItem. */
export function dismissWorkItem(id) {
  return send(suggestionPath(id), "DELETE")
}

/** Reverses an applied item. @returns {Promise<{ok: boolean, outcome: "undone"|"noop"}>} */
export function undoWorkItem(id) {
  return send(`${suggestionPath(id)}/undo`, "POST")
}

// ─── Learning ────────────────────────────────────────────────────────────────

/** Applies a proposal. @returns {Promise<{proposal: object, rule: object}>} 409 once decided, 400 if it no longer validates. */
export function acceptProposal(id, proposalId) {
  return send(`${queryKeys.agentProposals(id)}/${encodeURIComponent(proposalId)}/accept`, "POST")
}

/** Keeps the rule as it is. @returns {Promise<{proposal: object}>} */
export function rejectProposal(id, proposalId) {
  return send(`${queryKeys.agentProposals(id)}/${encodeURIComponent(proposalId)}/reject`, "POST")
}

/**
 * Answers a graduation offer or brake notice: "auto_notify" | "auto_silent" | "keep_asking"
 * (a brake notice alone takes only "keep_asking"). @returns {Promise<object>} the rule. 409 when nothing is pending.
 */
export function graduateRule(id, ruleId, choice) {
  return send(`${queryKeys.agentRules(id)}/${encodeURIComponent(ruleId)}/graduate`, "POST", { choice })
}

/** Forgets one remembered item. */
export function deleteMemory(id, memoryId) {
  return send(`${queryKeys.agentMemory(id)}/${encodeURIComponent(memoryId)}`, "DELETE")
}

// ─── Activity and impact ─────────────────────────────────────────────────────
// The server's activity and impact shapes are read here and nowhere else, so a
// change to either route is one edit.

export const ACTIVITY_PAGE = 50

const num = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))

/**
 * One activity row as the UI reads it.
 * @returns {{id: string, at: string, title: string, client: string|null, suggestionId: string|null,
 *   actionType: "pause_ads"|"enable_ads"|null, decided: "auto"|"approved"|"denied"|"undone",
 *   canUndo: boolean, currency: string|null, reasonCode: string|null, note: string|null,
 *   outcome: null|{metric: "account_cpl", before: number|null, after: number|null, currency: string|null}
 *     |{metric: "ad_cpl", after: number|null, leads: number, spend: number, currency: string|null}}}
 */
export function toActivityRow(raw) {
  const o = raw?.outcome_7d
  const currency = raw?.currency ?? o?.currency ?? null
  let outcome = null
  if (o?.metric === "account_cpl") {
    outcome = { metric: "account_cpl", before: num(o.before), after: num(o.after), currency: o.currency ?? currency }
  } else if (o?.metric === "ad_cpl") {
    outcome = {
      metric: "ad_cpl",
      after: num(o.after),
      leads: num(o.leads) ?? 0,
      spend: num(o.spend) ?? 0,
      currency: o.currency ?? currency,
    }
  }
  return {
    id: raw?.id,
    at: raw?.at ?? null,
    title: raw?.title ?? "",
    client: raw?.client_name ?? null,
    suggestionId: raw?.suggestion_id ?? null,
    actionType: raw?.action_type ?? null,
    decided: raw?.decided ?? "approved",
    canUndo: Boolean(raw?.can_undo),
    currency,
    reasonCode: raw?.reason_code ?? null,
    note: raw?.note ?? null,
    outcome,
  }
}

/**
 * One month's impact as the UI reads it. `byCurrency` lists each currency's wasted spend, largest
 * first; with more than one entry the single `wasted` total adds unlike money and should not be shown.
 * `series` is one entry per local day (`wastedByCurrency` only when the month has more than one currency).
 */
export function toImpact(raw) {
  if (!raw) return null
  const byCurrency = Object.entries(raw.wasted_spend_by_currency ?? {})
    .map(([code, amount]) => ({ code, amount: num(amount) ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
  const counts = raw.approval_counts ?? {}
  const series = (Array.isArray(raw.series) ? raw.series : []).map((e) => ({
    date: e?.date ?? null,
    actions: num(e?.actions) ?? 0,
    auto: num(e?.auto) ?? 0,
    wasted: num(e?.wasted_spend_stopped) ?? 0,
    wastedByCurrency: e?.wasted_spend_by_currency
      ? Object.fromEntries(Object.entries(e.wasted_spend_by_currency).map(([c, v]) => [c, num(v) ?? 0]))
      : null,
  }))
  const prev = raw.vs_prev_month ?? null
  return {
    month: raw.month ?? null,
    actions: num(raw.actions) ?? 0,
    auto: num(raw.auto) ?? 0,
    wasted: num(raw.wasted_spend_stopped) ?? 0,
    currency: raw.currency ?? byCurrency[0]?.code ?? null,
    byCurrency,
    approvalRate: num(raw.approval_rate),
    series,
    counts: { approved: num(counts.approved) ?? 0, denied: num(counts.denied) ?? 0, undone: num(counts.undone_user) ?? 0 },
    prev: prev
      ? { month: prev.month ?? null, actions: num(prev.actions), auto: num(prev.auto), approvalRate: num(prev.approval_rate) }
      : null,
  }
}

/**
 * The agent's decisions, newest first, 50 at a time. `loadMore` fetches the next page with the
 * server's `next_cursor` (or, failing that, `next_before`); `hasMore` is false once neither is set.
 */
export function useAgentActivity(id) {
  const base = id ? queryKeys.agentActivity(id) : null
  const getKey = (index, prev) => {
    if (!base) return null
    if (index === 0) return `${base}?limit=${ACTIVITY_PAGE}`
    // `next_cursor` is exact across timestamp ties; `next_before` is the older, `at`-only cursor.
    if (prev?.next_cursor) return `${base}?limit=${ACTIVITY_PAGE}&cursor=${encodeURIComponent(prev.next_cursor)}`
    if (prev?.next_before) return `${base}?limit=${ACTIVITY_PAGE}&before=${encodeURIComponent(prev.next_before)}`
    return null
  }
  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite(getKey, fetcher)
  const pages = data ?? []
  const seen = new Set()
  const items = []
  for (const page of pages) {
    for (const raw of page?.items ?? []) {
      if (seen.has(raw?.id)) continue
      seen.add(raw?.id)
      items.push(toActivityRow(raw))
    }
  }
  // A failure after the first page leaves the loaded rows in place: it is a "load more" error.
  const moreError = error && pages.length > 0 ? error : undefined
  return {
    items,
    error: pages.length === 0 ? error : undefined,
    moreError,
    isLoading,
    hasMore: Boolean(pages.at(-1)?.next_cursor || pages.at(-1)?.next_before),
    loadingMore: !error && size > 0 && pages.length > 0 && pages.length < size,
    loadMore: () => setSize(size + 1),
    mutate,
  }
}

/** One month's impact (`YYYY-MM`); with no month, the current one in the agent's timezone. */
export function useAgentImpact(id, month) {
  const key = id ? `${queryKeys.agentImpact(id)}${month ? `?month=${encodeURIComponent(month)}` : ""}` : null
  const { data, error, isLoading, mutate } = useSWR(key, fetcher)
  return { impact: toImpact(data), error, isLoading, mutate }
}

/** Whether an SWR key is one of this agent's impact months. */
export const isAgentImpactKey = (id) => (key) =>
  typeof key === "string" && key.startsWith(queryKeys.agentImpact(id))

/**
 * Undoes an action Birdy ran on its own. 410 once the 24-hour window has closed, 409 when it is
 * no longer Birdy's live apply. @returns {Promise<{ok: boolean, outcome: string}>}
 */
export function undoAutoRun(id, suggestionId) {
  return send(`${queryKeys.agent(id)}/suggestions/${encodeURIComponent(suggestionId)}/undo-auto`, "POST")
}
