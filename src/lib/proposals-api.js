// Changes another agent proposed in a chat reply (design section 6). Approving
// hands the change to the agent that owns the area, as a new turn in its own
// chat; that agent makes it through its own checks.
//   POST /api/chat/proposals/{id}/apply    -> a chat response (the owning agent's reply)
//   POST /api/chat/proposals/{id}/dismiss  -> {ok, id, status}
//   POST /api/chat/proposals/{id}/undo     -> a chat response, or 409 {code: "cannot_undo", detail}
//   GET  /api/chat/proposals?status=pending&agent=media_buyer|sales_coach
//        -> {proposals: [{id, agent, title, detail, kind, payload, status, can_undo, proposed_by,
//            client_group_id, origin: "chat"|"sub_agent_run", session_id?, sub_agent_id?}]}
// A proposal of kind "sub_agent" is approved through /api/agents/sub instead (lib/sub-agents).
// A proposal's status on a saved conversation (messages[].proposals[].status) is the server's
// record of the decision, so a reload shows what was decided.

import useSWR from "swr"
import { request } from "@/lib/context-api"
import { fetcher } from "@/lib/fetcher"

export const SUB_AGENT_KIND = "sub_agent"

export const applyProposal = (id) => request(`/api/chat/proposals/${encodeURIComponent(id)}/apply`, "POST")
export const dismissProposal = (id) => request(`/api/chat/proposals/${encodeURIComponent(id)}/dismiss`, "POST")
export const undoProposal = (id) => request(`/api/chat/proposals/${encodeURIComponent(id)}/undo`, "POST")

// pending -> approved | dismissed; approved -> undone; a proposal left too long lapses (expired).
export const PROPOSAL_STATUSES = ["pending", "approved", "dismissed", "undone", "expired"]
const str = (v) => (typeof v === "string" ? v : "")

/**
 * A proposal from the server made safe to draw: a known status (pending when unsure), `can_undo`
 * only when the server says so, and where it came from.
 */
export function normalizeProposal(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null
  return {
    ...raw,
    id: str(raw.id),
    status: PROPOSAL_STATUSES.includes(raw.status) ? raw.status : "pending",
    can_undo: raw.can_undo === true,
    origin: raw.origin === "sub_agent_run" ? "sub_agent_run" : raw.origin === "chat" ? "chat" : null,
    session_id: str(raw.session_id) || null,
    sub_agent_id: str(raw.sub_agent_id) || null,
  }
}

export const pendingProposalsKey = (agent) => (agent ? `/api/chat/proposals?status=pending&agent=${encodeURIComponent(agent)}` : null)

/**
 * The changes waiting for the owner's approval in one main agent's area, from any chat or
 * sub-agent run. `unavailable` is true while the server has no such route yet (404).
 * @param {"media_buyer"|"sales_coach"|null} agent null asks for nothing
 */
export function usePendingProposals(agent) {
  const { data, error, isLoading, mutate } = useSWR(pendingProposalsKey(agent), fetcher, { shouldRetryOnError: (e) => e?.status !== 404 })
  const unavailable = error?.status === 404
  const list = Array.isArray(data?.proposals) ? data.proposals : []
  return {
    proposals: list.map(normalizeProposal).filter((p) => p && p.status === "pending"),
    unavailable,
    error: unavailable ? null : error ?? null,
    isLoading: Boolean(agent) && isLoading,
    mutate,
  }
}

/** An undo the server refused, in words: its own `detail` when it sent one. */
export function undoErrorMessage(err) {
  if (err?.code === "cannot_undo" || err?.code === "undo_failed") return err.detail || "This change can’t be undone any more."
  if (err?.status === 404) return err?.code === "not_found" ? "This change is no longer there to undo." : "Undo is not available yet."
  if (err?.status === 412) return "Add your AI key in Settings so the agent can undo the change."
  if (err?.status === 402) return "You’re out of Birdy Credits. Top up so the agent can undo the change."
  return err?.detail || "That didn’t work. Check your connection and try again."
}

/** The start of a reply, without markdown: its first sentence or two, short enough for one line. */
export function receiptLine(reply, max = 140) {
  const plain = String(reply ?? "")
    .replace(/<<<[\s\S]*?>>>/g, " ")
    .replace(/[*_`#>]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  if (!plain) return ""
  // Sentences until there is enough to say something ("Done." alone says nothing).
  const sentences = plain.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [plain]
  let line = ""
  for (const sentence of sentences) {
    line = `${line} ${sentence.trim()}`.trim()
    if (line.length >= 40) break
  }
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
}

/** A refusal from apply or dismiss in plain words. */
export function proposalErrorMessage(err) {
  if (err?.status === 404) return "This was already decided somewhere else."
  if (err?.status === 412) return "Add your AI key in Settings so the agent can make the change."
  if (err?.status === 402) return "You’re out of Birdy Credits. Top up so the agent can make the change."
  if (err?.status === 422) return "No agent owns this change, so it can’t be made from here."
  return "That didn’t work. Check your connection and try again."
}
