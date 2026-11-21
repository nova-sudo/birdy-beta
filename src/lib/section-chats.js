// Which saved conversations belong to which agent section's Chat.
//
// The conversation list the backend serves (`/api/chat/conversations`) says
// which agent each thread is with (`agent`). Older rows have none; for those,
// each section remembers in this browser the conversations it started, and
// lists those. The Birdy section lists Birdy's rows and every row without an
// agent, as it always has.

const KEY = "by_section_chats";
const LIMIT = 200;

function read() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Remembers that a conversation was started in a section. */
export function rememberSectionChat(section, sessionId) {
  if (!section || !sessionId) return;
  try {
    const all = read();
    const ids = (all[section] ?? []).filter((id) => id !== sessionId);
    all[section] = [sessionId, ...ids].slice(0, LIMIT);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage can be full or blocked; the conversation still works, it just is not listed here.
  }
}

/** The conversations this browser remembers starting in a section. */
export function sectionChatIds(section) {
  return new Set(read()[section] ?? []);
}

/**
 * The conversations that belong to an agent's Chat.
 * @param {object[]} conversations as `/api/chat/conversations` serves them
 * @param {string} agent the agent key, e.g. "birdy" or "media_buyer"
 * @param {Set<string>} [remembered] ids started in this section in this browser, for rows without an agent
 */
export function conversationsFor(conversations, agent, remembered = new Set()) {
  return (conversations ?? []).filter((c) => {
    if (c?.agent) return c.agent === agent;
    // A row without an agent: Birdy's, unless this section remembers starting it.
    return agent === "birdy" ? true : remembered.has(c?.session_id);
  });
}
