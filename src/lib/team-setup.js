// Agent onboarding: each agent interviews the owner before it can work. The
// server keeps the state (birdy -> media_buyer -> sales_coach -> sub_agents);
// an agent is open only once the one before it is done. Routes:
//   GET  /api/team/setup                              -> the state below
//   PUT  /api/team/setup/{agent}/{step}  {answer}     -> the state again
//   POST /api/team/setup/media_buyer/practice         -> {job_id}
//   GET  /api/team/setup/media_buyer/practice         -> {status: none|running|done|failed, summary}
//   GET  /api/team/setup/sales_coach/outcome-options  -> {tags: [{value, label}], pipelines: [{id, name, stages: [{id, name}]}]}
//   POST /api/team/setup/sub_agents/finish {skipped}  -> the state again
// A locked agent's chat answers 423 {detail: {code: "agent_locked", agent, waits_on}}.
// When GET /api/team/setup fails (or the server has no such route yet) the app
// treats every agent as unlocked and leaves the interviews out.

import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { apiRequest } from "@/lib/api"

export const TEAM_KEY = "/api/team/setup"
export const TEAM_ORDER = ["birdy", "media_buyer", "sales_coach", "sub_agents"]
/** The agents that interview the owner. */
export const INTERVIEWERS = ["media_buyer", "sales_coach"]

/** Rail and /welcome section ids <-> the server's agent keys. */
export const AGENT_OF_SECTION = { ops: "birdy", buyer: "media_buyer", coach: "sales_coach", subs: "sub_agents" }
export const SECTION_OF_AGENT = { birdy: "ops", media_buyer: "buyer", sales_coach: "coach", sub_agents: "subs" }
export const AGENT_NAMES = { birdy: "Birdy", media_buyer: "Media Buyer", sales_coach: "Sales Coach", sub_agents: "Sub-agents" }

/** Each step's name in words, for when the server sends no `known` line for it. */
export const STEP_LABELS = {
  clients: "Clients",
  cpl: "Cost per lead limits",
  playbook: "Playbook",
  permissions: "Permissions",
  schedule: "Schedule",
  slack: "Slack",
  practice: "Practice run",
  outcomes: "Booked and closed",
  speed: "Speed to lead",
}

const STATUSES = ["locked", "open", "done"]
const str = (v) => (typeof v === "string" ? v : "")
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {})

function normalizeAgent(raw, key) {
  const a = obj(raw)
  const status = STATUSES.includes(a.status) ? a.status : key === "birdy" ? "open" : "locked"
  const order = (Array.isArray(a.order) ? a.order : []).filter((s) => typeof s === "string")
  const steps = Object.fromEntries(order.map((s) => [s, Boolean(obj(a.steps)[s])]))
  const known = (Array.isArray(a.known) ? a.known : [])
    .filter((k) => k && typeof k.step === "string")
    .map((k) => ({ step: k.step, label: str(k.label) || STEP_LABELS[k.step] || k.step, value: typeof k.value === "string" && k.value ? k.value : null }))
  return {
    key,
    status,
    waits_on: typeof a.waits_on === "string" ? a.waits_on : null,
    order,
    steps,
    current: typeof a.current === "string" && order.includes(a.current) ? a.current : order.find((s) => !steps[s]) ?? null,
    known,
    values: obj(a.values),
    skipped: Boolean(a.skipped),
    completed_at: a.completed_at ?? null,
    // The interview's own conversation (team_setup chats are left out of the chat history), to reopen it.
    chat_session_id: typeof a.chat_session_id === "string" && a.chat_session_id ? a.chat_session_id : null,
    // Media Buyer, once its interview is done: switched on, or what its readiness check still misses.
    activation: a.activation && typeof a.activation === "object"
      ? { status: a.activation.status === "active" ? "active" : "not_ready", missing: (Array.isArray(a.activation.missing) ? a.activation.missing : []).filter((m) => typeof m === "string") }
      : null,
  }
}

/** The server's state made safe to read, or null when it isn't the state at all. */
export function normalizeTeam(raw) {
  if (!raw || typeof raw !== "object" || !raw.agents || typeof raw.agents !== "object") return null
  const agents = Object.fromEntries(TEAM_ORDER.map((key) => [key, normalizeAgent(raw.agents[key], key)]))
  return { order: TEAM_ORDER, agents }
}

/** An agent's status. Without a team state everything is open. */
export const agentStatus = (team, agent) => (team ? team.agents[agent]?.status ?? "open" : "open")
export const isLocked = (team, agent) => agentStatus(team, agent) === "locked"

/** Which rail sections are locked: {buyer, coach}. */
export const lockedSections = (team) => ({ buyer: isLocked(team, "media_buyer"), coach: isLocked(team, "sales_coach") })

/** How many of an agent's questions are answered. */
export function answered(team, agent) {
  const a = team?.agents[agent]
  if (!a) return { done: 0, total: 0 }
  return { done: a.order.filter((s) => a.steps[s]).length, total: a.order.length }
}

/** The line each step shows in "What it knows": the server's line, falling back to the step's name. */
export function knownLines(team, agent) {
  const a = team?.agents[agent]
  if (!a) return []
  const byStep = new Map(a.known.map((k) => [k.step, k]))
  return a.order.map((step) => ({
    step,
    label: byStep.get(step)?.label ?? STEP_LABELS[step] ?? step,
    value: byStep.get(step)?.value ?? null,
    done: Boolean(a.steps[step]),
    current: a.current === step && a.status !== "done",
  }))
}

/** The names of the steps an agent still has to do. */
export const stepsLeftOf = (team, agent) => knownLines(team, agent).filter((l) => !l.done).map((l) => l.label)

/** The first agent that isn't done, as a /welcome section; "ops" without a state. */
export function nextSection(team) {
  if (!team) return "ops"
  const key = TEAM_ORDER.find((k) => team.agents[k].status !== "done")
  return key ? SECTION_OF_AGENT[key] : "ops"
}

/** Every agent, the sub-agents step included, is done. */
export const teamDone = (team) => Boolean(team) && TEAM_ORDER.every((k) => team.agents[k].status === "done")

/**
 * How far setup has come, as a share of everything there is to do: Birdy's
 * own checklist (counted whole once onboarding is completed), each agent's
 * questions, and the sub-agents step.
 *
 * @param {Record<string, string>} steps Birdy's checklist states (lib/setup-steps)
 * @param {object|null} team
 * @param {{completed?: boolean, total?: number}} [opts] `total`: how many checklist steps there are
 */
export function setupPercent(steps, team, { completed = false, total } = {}) {
  const ids = Object.keys(steps || {})
  const opsTotal = total ?? ids.length
  const opsDone = completed ? opsTotal : ids.filter((id) => steps[id] === "done").length
  let done = opsDone
  let all = opsTotal
  if (team) {
    for (const agent of INTERVIEWERS) {
      const n = answered(team, agent)
      done += n.done
      all += n.total
    }
    all += 1
    if (team.agents.sub_agents.status === "done") done += 1
  }
  return all ? Math.round((done / all) * 100) : 0
}

/**
 * The form a reply asks for, from its `agent_changes`: `{type, data}` or null.
 * Two shapes are read: `{ui_block: {type, ...data}}` (the team setup contract)
 * and `{ui_block: "<type>", ...data}` (the older setup chat). The last block wins.
 */
export function replyBlock(message) {
  const changes = Array.isArray(message?.agent_changes) ? message.agent_changes : []
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i]
    if (!c || typeof c !== "object") continue
    if (c.ui_block && typeof c.ui_block === "object" && typeof c.ui_block.type === "string") {
      const { type, ...data } = c.ui_block
      return { type, data }
    }
    if (typeof c.ui_block === "string" && c.ui_block) {
      const { ui_block: type, tool: _tool, ...data } = c
      return { type, data }
    }
  }
  return null
}

/** A 423 refusal's detail: {agent, waits_on}, or null when it isn't one. */
export function lockedRefusal(body) {
  const d = body?.detail
  if (!d || typeof d !== "object" || d.code !== "agent_locked") return null
  return { agent: str(d.agent) || null, waits_on: str(d.waits_on) || null }
}

/** The short message sent after a form is saved, so the agent moves on. */
export function answerMessage(team, agent, step) {
  const line = knownLines(team, agent).find((l) => l.step === step)
  const label = line?.label ?? STEP_LABELS[step] ?? step
  return line?.value ? `${label}: ${line.value}` : `${label}: saved`
}

// ─── Server ──────────────────────────────────────────────────────────────────

const enc = encodeURIComponent

/**
 * One request to a team setup route. A refusal throws an Error with `status`,
 * `code` and the server's `detail` (a string, or an object such as
 * {code: "step_out_of_order", agent, step, expected}).
 */
async function request(endpoint, method = "GET", body) {
  const res = await apiRequest(endpoint, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  let data = null
  try {
    data = await res.json()
  } catch {
    // Empty or not JSON.
  }
  if (!res.ok) {
    const detail = data?.detail ?? null
    const err = new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`)
    err.status = res.status
    err.code = (detail && typeof detail === "object" ? detail.code : null) ?? data?.code ?? null
    err.detail = detail
    throw err
  }
  return data
}

/** What a refused save says, in words the owner can act on. */
export function refusalText(err) {
  if (err?.code === "step_out_of_order") {
    const expected = err.detail?.expected
    return expected ? `Answer ${STEP_LABELS[expected] ?? expected} first: the questions go in order.` : "Answer the questions in order: this one comes later."
  }
  if (err?.code === "agent_locked") return "This agent isn’t open yet."
  if (typeof err?.detail?.message === "string" && err.detail.message) return err.detail.message
  if (err?.message && !err.message.startsWith("HTTP")) return err.message
  return "Couldn’t save that. Check your connection and try again."
}

export const saveStep = (agent, step, body) => request(`${TEAM_KEY}/${enc(agent)}/${enc(step)}`, "PUT", body)
export const finishSubAgents = (skipped) => request(`${TEAM_KEY}/sub_agents/finish`, "POST", { skipped: Boolean(skipped) })
export const startPractice = () => request(`${TEAM_KEY}/media_buyer/practice`, "POST")
export const practiceStatus = () => request(`${TEAM_KEY}/media_buyer/practice`)
export const OUTCOME_OPTIONS_KEY = `${TEAM_KEY}/sales_coach/outcome-options`

/**
 * The team's setup state. `team` is null while loading and whenever the
 * request failed: callers then treat every agent as unlocked (`unavailable`).
 * `apply(body)` puts a state the server returned straight into the cache.
 */
export function useTeamSetup() {
  const { data, error, isLoading, mutate } = useSWR(TEAM_KEY, fetcher, { shouldRetryOnError: false, revalidateOnFocus: false })
  const team = error ? null : normalizeTeam(data)
  return {
    team,
    ready: !isLoading && (data !== undefined || error !== undefined),
    unavailable: Boolean(error) || (data !== undefined && !team),
    refresh: () => mutate(),
    apply: (body) => mutate(body, { revalidate: false }),
  }
}
