// The setup celebrations show once: at the moment an agent's setup completes,
// not on a reload or a later visit. What was shown is remembered in this
// browser, per account and per agent. Storage can be missing or blocked, so
// every read and write is guarded; without it the moment still shows.

import { AGENT_NAMES, knownLines } from "@/lib/team-setup"

const PREFIX = "birdy_setup_celebrated"

/** Who is signed in here, so two accounts on one browser each get their own. */
function accountKey() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null")
    return (typeof user?.email === "string" && user.email.trim().toLowerCase()) || "me"
  } catch {
    return "me"
  }
}

export const celebrationKey = (agent) => `${PREFIX}:${accountKey()}:${agent}`

/** Whether this agent's celebration was shown already. */
export function wasCelebrated(agent) {
  try {
    return localStorage.getItem(celebrationKey(agent)) === "1"
  } catch {
    return false
  }
}

/** Remember that it was shown. */
export function markCelebrated(agent) {
  try {
    localStorage.setItem(celebrationKey(agent), "1")
  } catch {
    // Storage is blocked: it may show again, which is better than not at all.
  }
}

/**
 * True the one time the celebration should open: not shown before. Marks it shown.
 * @param {string} agent "media_buyer" | "sales_coach" | "sub_agents"
 */
export function celebrateOnce(agent) {
  if (wasCelebrated(agent)) return false
  markCelebrated(agent)
  return true
}

// The answers each agent's celebration repeats back, in this order.
const DONE_STEPS = {
  media_buyer: ["clients", "cpl", "schedule", "slack"],
  sales_coach: ["clients", "speed", "schedule", "slack"],
}

/** "Clients: All active clients": the answers in "What it knows", for the celebration. */
export function celebrationLines(team, agent) {
  const lines = knownLines(team, agent)
  return (DONE_STEPS[agent] ?? [])
    .map((step) => lines.find((l) => l.step === step))
    .filter((l) => l?.done && l.value)
    .map((l) => `${l.label}: ${l.value}`)
}

/** What finishing the whole team says it set up. */
export function teamLines(team, added) {
  const lines = ["birdy", "media_buyer", "sales_coach"]
    .filter((k) => team?.agents?.[k]?.status === "done")
    .map((k) => `${AGENT_NAMES[k]} is set up`)
  if (added > 0) lines.push(`${added} sub-agent${added === 1 ? "" : "s"} working for you`)
  return lines
}
