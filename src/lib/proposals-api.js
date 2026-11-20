// Changes another agent proposed in a chat reply (design section 6). Approving
// hands the change to the agent that owns the area, as a new turn in its own
// chat; that agent makes it through its own checks.
//   POST /api/chat/proposals/{id}/apply    -> a chat response (the owning agent's reply)
//   POST /api/chat/proposals/{id}/dismiss  -> {ok, id, status}
// A proposal of kind "sub_agent" is approved through /api/agents/sub instead (lib/sub-agents).

import { request } from "@/lib/context-api"

export const SUB_AGENT_KIND = "sub_agent"

export const applyProposal = (id) => request(`/api/chat/proposals/${encodeURIComponent(id)}/apply`, "POST")
export const dismissProposal = (id) => request(`/api/chat/proposals/${encodeURIComponent(id)}/dismiss`, "POST")

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
