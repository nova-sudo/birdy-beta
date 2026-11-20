// Sub-agents under Media Buyer and Sales Coach: the server's records, the words
// the page uses for them, and the owner's edits turned into a PATCH body.
// Routes (birdy-backend routers/sub_agents.py):
//   GET    /api/agents/sub?parent=media_buyer|sales_coach&status=
//   POST   /api/agents/sub/{id}/approve | reject | pause | resume
//   PATCH  /api/agents/sub/{id}   name, purpose, instructions, tools, clients, schedule
//   DELETE /api/agents/sub/{id}
//   GET    /api/agents/sub/tools?parent=      -> {tools: [{name, label}]}  what the main agent can hand out
//   POST   /api/agents/sub/{id}/run           -> the run (below); it uses credits
//   GET    /api/agents/sub/{id}/runs?limit=20 -> {runs: [run]}
// A run is {id, status, trigger, started_at, finished_at, summary, answer, credits, proposals}; the server
// says done | error | skipped | running (ok and timeout are read too).
// `trigger` is "schedule" or "manual" (the owner pressed Run now).
// Each record carries `last_run`: null, or {status, at, summary, credits}.
// Refusals are {detail, code}. A record with kind "custom" (today's rules agents)
// is managed on its own page; every write here answers 409 managed_elsewhere.

import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { request } from "@/lib/context-api"

export const ALL_CLIENTS = "all"
export const NAME_MAX = 60
/** The days the server takes, in week order, with how the page writes them. */
export const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]]
const DAY_KEYS = DAYS.map(([k]) => k)
const WEEKDAYS = DAY_KEYS.slice(0, 5)

/** Which main agent a parent key is, in words. */
export const PARENT_NAMES = { media_buyer: "Media Buyer", sales_coach: "Sales Coach" }

const str = (v) => (typeof v === "string" ? v : "")

/** A record from the server made safe to draw. */
export function normalizeSubAgent(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null
  const clients = raw.clients === ALL_CLIENTS
    ? ALL_CLIENTS
    : (Array.isArray(raw.clients) ? raw.clients : []).filter((c) => c && c.id).map((c) => ({ id: str(c.id), name: str(c.name) || null }))
  const schedule = raw.schedule && typeof raw.schedule === "object" && str(raw.schedule.time)
    ? { time: str(raw.schedule.time), timezone: str(raw.schedule.timezone), days: (Array.isArray(raw.schedule.days) ? raw.schedule.days : []).filter((d) => DAY_KEYS.includes(d)) }
    : null
  return {
    id: str(raw.id),
    parent: str(raw.parent),
    kind: raw.kind === "custom" ? "custom" : "specialist",
    name: str(raw.name) || "Unnamed sub-agent",
    purpose: str(raw.purpose),
    instructions: str(raw.instructions),
    tools: (Array.isArray(raw.tools) ? raw.tools : []).filter((t) => t && t.name).map((t) => ({ name: str(t.name), label: str(t.label) || str(t.name) })),
    clients,
    schedule,
    status: ["proposed", "active", "paused"].includes(raw.status) ? raw.status : "active",
    created_at: raw.created_at ?? null,
    last_run_at: raw.last_run?.at ?? raw.last_run_at ?? null,
    last_run: normalizeLastRun(raw.last_run),
  }
}

export const RUN_STATUSES = ["done", "error", "skipped", "timeout", "running"]
// "ok" is read as done; anything unknown is shown as failed rather than as fine.
const runStatus = (v) => (v === "ok" ? "done" : RUN_STATUSES.includes(v) ? v : "error")
const credits = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0)

function normalizeLastRun(raw) {
  if (!raw || typeof raw !== "object" || !raw.status) return null
  return { status: runStatus(raw.status), at: raw.at ?? null, summary: str(raw.summary), credits: credits(raw.credits) }
}

/** One run from the server made safe to draw. */
export function normalizeRun(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    id: str(raw.id) || null,
    status: runStatus(raw.status),
    trigger: raw.trigger === "manual" || raw.trigger === "schedule" ? raw.trigger : null,
    started_at: raw.started_at ?? null,
    finished_at: raw.finished_at ?? null,
    summary: str(raw.summary),
    answer: str(raw.answer),
    credits: credits(raw.credits),
    proposals: (Array.isArray(raw.proposals) ? raw.proposals : []).filter((p) => p && p.id),
  }
}

/** How each run outcome is said and marked. */
export const RUN_WORDS = {
  done: { label: "Finished", tone: "success" },
  running: { label: "Running", tone: "accent" },
  error: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
  timeout: { label: "Ran out of time", tone: "warning" },
}

/** Seconds between a run's start and finish, or null when either is missing. */
export function runSeconds(run, parse = (v) => new Date(v)) {
  if (!run?.started_at || !run?.finished_at) return null
  const a = parse(run.started_at)?.getTime?.()
  const b = parse(run.finished_at)?.getTime?.()
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 1000) : null
}

/** Waiting for approval first, then working, then paused; newest first inside each. */
export function sortSubAgents(list) {
  const rank = { proposed: 0, active: 1, paused: 2 }
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
}

/** "Every day", "Weekdays", "Mon, Wed and Fri". */
export function daysLine(days) {
  const set = DAY_KEYS.filter((d) => days?.includes(d))
  if (set.length === 0 || set.length === 7) return "Every day"
  if (set.length === 5 && WEEKDAYS.every((d) => set.includes(d))) return "Weekdays"
  if (set.length === 2 && set.includes("sat") && set.includes("sun")) return "Weekends"
  const words = set.map((d) => DAYS.find(([k]) => k === d)[1])
  return words.length === 1 ? `${words[0]}s` : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`
}

/** "Weekdays at 08:00, Europe/London", or "Only when asked". */
export function scheduleLine(schedule) {
  if (!schedule?.time) return "Only when asked"
  return `${daysLine(schedule.days)} at ${schedule.time}${schedule.timezone ? `, ${schedule.timezone}` : ""}`
}

/** "All clients", "Aura", "Aura and Beaulea Clinic", "Aura and 3 more". */
export function clientsLine(clients) {
  if (clients === ALL_CLIENTS) return "All clients"
  const names = (clients ?? []).map((c) => c.name || "A removed client")
  if (names.length === 0) return "No clients"
  if (names.length <= 2) return names.join(" and ")
  return `${names[0]} and ${names.length - 1} more`
}

export const toolsLine = (tools) => (tools?.length ? tools.map((t) => t.label).join(", ") : "No tools")

/**
 * The tools the Edit dialog offers: the ones the record has, then the rest its main agent can
 * hand out (from the server), each once, in that order.
 */
export function toolOptions(record, available) {
  const seen = new Set()
  const out = []
  for (const t of [...(record?.tools ?? []), ...(available ?? [])]) {
    if (!t?.name || seen.has(t.name)) continue
    seen.add(t.name)
    out.push({ name: str(t.name), label: str(t.label) || str(t.name) })
  }
  return out
}

/** The fields the owner edits, from a record. */
export function draftOf(record) {
  return {
    name: record.name,
    purpose: record.purpose,
    instructions: record.instructions,
    tools: record.tools.map((t) => t.name),
    clients: record.clients === ALL_CLIENTS ? ALL_CLIENTS : record.clients.map((c) => c.id),
    schedule: record.schedule ? { ...record.schedule, days: [...record.schedule.days] } : null,
  }
}

const sameList = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])
const sameSchedule = (a, b) => (!a && !b) || (Boolean(a) && Boolean(b) && a.time === b.time && a.timezone === b.timezone && sameList(a.days ?? [], b.days ?? []))

/** The PATCH body for what changed between a record and the owner's draft. Empty when nothing did. */
export function patchOf(record, draft) {
  const was = draftOf(record)
  const body = {}
  for (const key of ["name", "purpose", "instructions"]) if (draft[key].trim() !== was[key].trim()) body[key] = draft[key].trim()
  if (!sameList(draft.tools, was.tools)) body.tools = draft.tools
  const clientsChanged = draft.clients === ALL_CLIENTS || was.clients === ALL_CLIENTS ? draft.clients !== was.clients : !sameList(draft.clients, was.clients)
  if (clientsChanged) body.clients = draft.clients
  if (!sameSchedule(draft.schedule, was.schedule)) {
    body.schedule = draft.schedule ? { time: draft.schedule.time, timezone: draft.schedule.timezone, days: DAY_KEYS.filter((d) => draft.schedule.days.includes(d)) } : null
  }
  return body
}

/** What is wrong with a draft, field by field. Empty when it can be saved. */
export function draftErrors(draft) {
  const errors = {}
  if (!draft.name.trim()) errors.name = "Give it a name."
  else if (draft.name.trim().length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX + 1} characters.`
  if (!draft.purpose.trim()) errors.purpose = "Say in one line what it does."
  if (draft.tools.length === 0) errors.tools = "Pick at least one tool."
  if (draft.clients !== ALL_CLIENTS && draft.clients.length === 0) errors.clients = "Pick at least one client, or all of them."
  if (draft.schedule && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.schedule.time)) errors.schedule = "Pick a time to run."
  return errors
}

/** A refusal of "Run now" in plain words. */
export function runErrorMessage(err) {
  if (err?.status === 404) return "Running a sub-agent by hand is not available yet."
  if (err?.status === 402) return "You’re out of Birdy Credits. Top up to run it."
  if (err?.status === 412) return "Add your AI key in Settings to run it."
  if (err?.code === "wrong_status") return "Only an active sub-agent can run. Resume it first."
  if (err?.code === "already_running") return "It is running now. Its result shows on its row when it’s done."
  return err?.detail || "It couldn’t run. Check your connection and try again."
}

/** A refusal in plain words. */
export function subAgentErrorMessage(err) {
  if (err?.code === "duplicate_name") return "Another sub-agent already has that name. Pick another one."
  if (err?.code === "wrong_status") return "It changed since this page loaded. Reload to see where it stands."
  if (err?.code === "managed_elsewhere") return "This one is managed on its own page."
  if (err?.status === 404) return "This sub-agent no longer exists."
  if (err?.status === 400 && err?.detail) return err.detail
  return "That didn’t work. Check your connection and try again."
}

/** The browser's time zone, for a new schedule. */
export const localTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

// ─── Server ──────────────────────────────────────────────────────────────────

export const subAgentsKey = (parent) => (parent ? `/api/agents/sub?parent=${encodeURIComponent(parent)}` : null)

/**
 * A main agent's sub-agents. `unavailable` is true while the server has no sub-agent routes yet (404).
 * @param {"media_buyer"|"sales_coach"|null} parent null asks for nothing
 */
export function useSubAgents(parent) {
  const { data, error, isLoading, mutate } = useSWR(subAgentsKey(parent), fetcher, { shouldRetryOnError: (e) => e?.status !== 404 })
  const unavailable = error?.status === 404
  const list = Array.isArray(data) ? data : Array.isArray(data?.sub_agents) ? data.sub_agents : []
  return {
    subAgents: sortSubAgents(list.map(normalizeSubAgent).filter(Boolean)),
    unavailable,
    error: unavailable ? null : error ?? null,
    isLoading: Boolean(parent) && isLoading,
    mutate,
  }
}

export const subAgentToolsKey = (parent) => (parent ? `/api/agents/sub/tools?parent=${encodeURIComponent(parent)}` : null)

/**
 * The tools a main agent can give its sub-agents. `unavailable` is true while the route is missing (404).
 * @param {"media_buyer"|"sales_coach"|null} parent null asks for nothing
 */
export function useSubAgentTools(parent) {
  const { data, error, isLoading } = useSWR(subAgentToolsKey(parent), fetcher, { shouldRetryOnError: (e) => e?.status !== 404 })
  const list = Array.isArray(data?.tools) ? data.tools : []
  return {
    tools: list.filter((t) => t && t.name).map((t) => ({ name: str(t.name), label: str(t.label) || str(t.name) })),
    unavailable: error?.status === 404,
    error: error?.status === 404 ? null : error ?? null,
    isLoading: Boolean(parent) && isLoading,
  }
}

export const RUNS_LIMIT = 20
export const subAgentRunsKey = (id) => (id ? `/api/agents/sub/${encodeURIComponent(id)}/runs?limit=${RUNS_LIMIT}` : null)

/**
 * A sub-agent's last runs, newest first. `unavailable` is true while the route is missing (404).
 * @param {string|null} id null asks for nothing
 */
export function useSubAgentRuns(id) {
  const { data, error, isLoading, mutate } = useSWR(subAgentRunsKey(id), fetcher, { shouldRetryOnError: (e) => e?.status !== 404 })
  const list = Array.isArray(data?.runs) ? data.runs : []
  return {
    runs: list.map(normalizeRun).filter(Boolean),
    unavailable: error?.status === 404,
    error: error?.status === 404 ? null : error ?? null,
    isLoading: Boolean(id) && isLoading,
    mutate,
  }
}

const path = (id, action = "") => `/api/agents/sub/${encodeURIComponent(id)}${action ? `/${action}` : ""}`

export const approveSubAgent = (id) => request(path(id, "approve"), "POST")
export const rejectSubAgent = (id) => request(path(id, "reject"), "POST")
export const pauseSubAgent = (id) => request(path(id, "pause"), "POST")
export const resumeSubAgent = (id) => request(path(id, "resume"), "POST")
export const changeSubAgent = (id, body) => request(path(id), "PATCH", body)
export const deleteSubAgent = (id) => request(path(id), "DELETE")
/** Run it now, by hand. It uses credits; the page confirms first. Answers with the run. */
export const runSubAgent = (id) => request(path(id, "run"), "POST")

/**
 * Save the owner's edits (if any), then approve: what "Create" does on a proposal.
 * @returns {Promise<object>} the approved record as the server returns it
 */
export async function saveAndApprove(record, draft) {
  const body = patchOf(record, draft)
  if (Object.keys(body).length) await changeSubAgent(record.id, body)
  return approveSubAgent(record.id)
}
