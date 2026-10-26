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

/** Number of open agent work items, for the nav badge. `null` until agents ship. */
export function useAgentWorkCount() {
  return null
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

/** Turns the agent on. 409 `{missing}` when it is not ready yet. */
export function activateAgent(id) {
  return send(`${queryKeys.agent(id)}/activate`, "POST")
}
