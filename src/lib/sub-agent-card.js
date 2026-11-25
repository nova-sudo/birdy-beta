// The words the sub-agents setup step uses for a proposed sub-agent: what it
// reads (from its tools, never the tools' own names), when it runs, which
// clients, and the agent's reply cut down when the cards already say it all.

import { ALL_CLIENTS, PARENT_NAMES, clientsLine, daysLine } from "@/lib/sub-agents"

// A tool's name -> what it reads, in the owner's words. First match wins.
const READS = [
  [/call|transcript|recording|speed/, "Calls"],
  [/lead/, "Leads"],
  [/close|ghl|contact|opportunit|pipeline|tag_|_tag|booking|appointment/, "Sales pipeline"],
  [/insight|metric|performance|summary|compare|pacing|budget|funnel|attribution|spend/, "Ad results"],
  [/creative/, "Creative tests"],
  [/campaign|adset|ad_set|find_ads|list_ads|_ads?$/, "Ads and campaigns"],
  [/alert/, "Alerts"],
  [/note|client/, "Client notes"],
  [/slack|report/, "Reports"],
]

/** What a parent's data is called when a tool's name says nothing we know. */
const fallback = (parent) => (parent === "sales_coach" ? "Your sales data" : "Your ad data")

/**
 * One tool's name in plain words ("get_ad_insights" -> "Ad results").
 * @param {string} name
 * @param {string} [parent] the main agent, for the fallback phrase
 */
export function toolWords(name, parent) {
  const n = String(name ?? "").toLowerCase()
  for (const [test, words] of READS) if (test.test(n)) return words
  return fallback(parent)
}

/** "Ad results and Leads": what a sub-agent reads, each phrase once. */
export function readsLine(tools, parent) {
  const words = [...new Set((tools ?? []).map((t) => toolWords(t?.name ?? t, parent)))]
  if (words.length === 0) return fallback(parent)
  if (words.length === 1) return words[0]
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1).toLowerCase()}`
}

/** "Every day at 14:10", "Weekdays at 08:00", or "When Marketing Guru asks". The time zone is left to the edit dialog. */
export function runsLine(schedule, parent) {
  if (!schedule?.time) return `When ${PARENT_NAMES[parent] ?? "its main agent"} asks`
  return `${daysLine(schedule.days)} at ${schedule.time}`
}

/** "All your clients", "Aura and Beaulea Clinic". */
export const clientsWords = (clients) => (clients === ALL_CLIENTS ? "All your clients" : clientsLine(clients))

/** The four facts on a sub-agent's card, from the record only. */
export function cardFacts(record) {
  return [
    { key: "clients", label: "Clients", value: clientsWords(record.clients) },
    { key: "runs", label: "Runs", value: runsLine(record.schedule, record.parent) },
    { key: "reads", label: "Reads", value: readsLine(record.tools, record.parent) },
    { key: "reports", label: "Reports to", value: PARENT_NAMES[record.parent] ?? "Its main agent" },
  ]
}

// A tool name as it shows up in a reply: lower case words joined by "_", in backticks or not.
const TOOL_NAME = /`?\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b`?/g

/** A reply with every raw tool name swapped for its plain words. */
export function withoutToolNames(text, parent) {
  return String(text ?? "").replace(TOOL_NAME, (match) => toolWords(match.replace(/`/g, ""), parent).toLowerCase())
}

// Where a reply starts listing: a bullet, a numbered line, a heading, a bold label or a table.
const LISTING = /^\s*(?:[-*+•]\s|\d+[.)]\s|#{1,6}\s|\*\*[^*]+\*\*\s*:?|\|)/

/**
 * The opening of a reply that carries sub-agent cards: the cards are the
 * content, so the list that repeats them is left out, and at most two
 * sentences of the lead-in stay.
 */
export function shortReply(text) {
  const lead = []
  for (const line of String(text ?? "").split("\n")) {
    if (LISTING.test(line)) break
    lead.push(line)
  }
  const prose = lead.join(" ").replace(/\s+/g, " ").trim()
  const sentences = prose.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []
  const kept = sentences.slice(0, 2).map((t) => t.trim()).join(" ")
  // A lead-in that ends on a colon introduced the list that was dropped.
  return kept.replace(/:\s*$/, ".") || "Here’s what I’d add."
}
