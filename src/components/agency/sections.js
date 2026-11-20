// The three agent sections that share one set of screens: Agency Ops, Media
// Buyer and Sales Coach. Each one is the same four tabs (Chat, Bird's Eye,
// Dashboard, Suggestions); what differs lives here, so the screens read it
// instead of being copied three times.

import { SECTIONS } from "@/components/by";

const kit = (id) => SECTIONS.find((s) => s.id === id);

/** Platform words that mark a suggestion as being about calls rather than ads. */
const CALLS = /call|dial|hot ?prospector|recording/i;
const aboutCalls = (s) => CALLS.test(`${s?.platform ?? ""} ${s?.ruleKind ?? ""}`);

/**
 * @typedef {object} SectionConfig
 * @property {"ops"|"buyer"|"coach"} key the rail's id for it
 * @property {object} kit its entry in the kit's SECTIONS: name, icon, tile colours
 * @property {Record<"chat"|"birdseye"|"dashboard"|"suggestions"|"context", string>} paths where each tab lives, and each page under More
 * @property {{page: string|null, agent: string|null, session: string, starters: string}} chat
 *   `page` is the chat backend's page key (its tool list, see _PAGE_TOOLS in birdy-backend's ai/orchestrator.py),
 *   `agent` the agent that answers, `session` the prefix of every conversation kept in the browser,
 *   `starters` which starter prompts an empty chat offers (lib/chat-starters)
 * @property {string} hello what the empty chat says it can be asked about
 * @property {string} askAbout how the ask bar on Bird's Eye and Dashboard words a question
 * @property {(s: object) => boolean} ownsSuggestion which of Birdy's suggestions are this section's
 * @property {boolean} ownsHistory whether the suggestions history (what was done to ad accounts) is this section's
 * @property {"media_buyer"|"sales_coach"|null} subAgents whose sub-agents Context lists (`parent` on /api/agents/sub), or null for none
 * @property {boolean} lessons whether Context lists the Media Buying Agent's lessons from chat
 */

/** @type {Record<string, SectionConfig>} */
export const SECTION_CONFIG = {
  ops: {
    key: "ops",
    kit: kit("ops"),
    paths: { chat: "/dashboard/chat", birdseye: "/dashboard", dashboard: "/dashboard/table", suggestions: "/dashboard/suggestions", context: "/dashboard/context" },
    // Agency Ops' chat has always gone out with no page of its own: Birdy with every tool.
    chat: { page: null, agent: null, session: "ops", starters: "dashboard" },
    hello: "Ask about your clients, campaigns, leads or calls.",
    askAbout: "these numbers",
    ownsSuggestion: () => true,
    ownsHistory: true,
    // Birdy has no sub-agents of its own: they belong to the main agents.
    subAgents: null,
    lessons: false,
  },
  buyer: {
    key: "buyer",
    kit: kit("buyer"),
    paths: { chat: "/media-buyer/chat", birdseye: "/media-buyer", dashboard: "/media-buyer/table", suggestions: "/media-buyer/suggestions", context: "/media-buyer/context" },
    // "campaigns" is the old Marketing Hub's page: the ads tools, and the creative test tools.
    chat: { page: "campaigns", agent: "media_buyer", session: "buyer", starters: "campaigns" },
    hello: "Ask about ads, spend and cost per lead across your clients.",
    askAbout: "your ads",
    // Every suggestion Birdy makes today comes from its ad rules.
    ownsSuggestion: (s) => !aboutCalls(s),
    ownsHistory: true,
    subAgents: "media_buyer",
    // The Media Buying Agent's lessons from chat, listed on Context.
    lessons: true,
  },
  coach: {
    key: "coach",
    kit: kit("coach"),
    paths: { chat: "/sales-coach/chat", birdseye: "/sales-coach", dashboard: "/sales-coach/table", suggestions: "/sales-coach/suggestions", context: "/sales-coach/context" },
    // "call_center" is the old Sales Hub's page: call-centre stats, recordings and call analysis only.
    chat: { page: "call_center", agent: "sales_coach", session: "coach", starters: "call_center" },
    hello: "Ask about your call centres, calls and recordings.",
    askAbout: "your calls",
    ownsSuggestion: aboutCalls,
    // The suggestions history records changes made to ad accounts; none of it is Sales Coach's.
    ownsHistory: false,
    subAgents: "sales_coach",
    lessons: false,
  },
};

export const OPS_SECTION = SECTION_CONFIG.ops;
export const BUYER_SECTION = SECTION_CONFIG.buyer;
export const COACH_SECTION = SECTION_CONFIG.coach;

/**
 * A section's config from its key or the config itself. Pages are server components and can only pass
 * plain values to the client screens, so they pass the key ("buyer", "coach").
 * @returns {SectionConfig}
 */
export const resolveSection = (section) => (typeof section === "string" ? SECTION_CONFIG[section] ?? OPS_SECTION : section ?? OPS_SECTION);

/** The section a path belongs to, or null. */
export function sectionOfPath(pathname) {
  return Object.values(SECTION_CONFIG).find((s) => Object.values(s.paths).includes(pathname)) ?? null;
}

/** The conversation key a section keeps in the browser for one place (a tab, or a tab inside a client). */
export const sessionKey = (section, place) => `by_${section.chat.session}_${place}`;
