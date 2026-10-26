"use client"

import useSWR from "swr"
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
  const one = useSWR(ids.length === 1 ? queryKeys.agentWork(ids[0]) : null, fetcher)
  const many = useSWR(ids.length > 1 ? [WORK_COUNT_KEY, ...ids] : null, ([, ...list]) =>
    Promise.all(list.map((id) => fetcher(queryKeys.agentWork(id))))
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

/** Open work items and the last 24h of auto-applied ones. */
export function useAgentWork(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.agentWork(id) : null, fetcher)
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
 * @returns {Promise<{ok: boolean, outcome: string, succeeded: object[], failed: object[], blocked_reason: {code: string, message: string}|null}>}
 *   A guardrail block is `ok: false, outcome: "blocked"`; a Meta failure throws (502).
 */
export function applyWorkItem(id) {
  return send(`${suggestionPath(id)}/apply`, "POST")
}

/** Declines a work item. `reason_code` is one of DENY_REASONS' codes. 409 while it is being applied. */
export function denyWorkItem(id, { reason_code, note }) {
  const body = { reason_code }
  if (note && note.trim()) body.note = note.trim()
  return send(`${suggestionPath(id)}/deny`, "POST", body)
}

/** Dismisses a work item without a reason. 409 while it is being applied. */
export function dismissWorkItem(id) {
  return send(suggestionPath(id), "DELETE")
}

/** Reverses an applied item. @returns {Promise<{ok: boolean, outcome: "undone"|"noop"}>} */
export function undoWorkItem(id) {
  return send(`${suggestionPath(id)}/undo`, "POST")
}
