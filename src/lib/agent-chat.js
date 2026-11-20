// Shaping for the redesigned chat: how saved conversations are grouped and labelled.

const DAY_MS = 86_400_000;
export const GROUP_ORDER = ["Today", "Yesterday", "This week", "Earlier"];

/** Which group a conversation last touched at `iso` belongs to. */
export function groupLabel(iso, now = new Date()) {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return "Today";
  if (d >= new Date(startOfToday - DAY_MS)) return "Yesterday";
  if (d >= new Date(startOfToday - 6 * DAY_MS)) return "This week";
  return "Earlier";
}

/** Conversations in their groups, newest group first, empty groups left out. */
export function groupConversations(conversations, now = new Date()) {
  const groups = new Map();
  for (const c of conversations ?? []) {
    const label = groupLabel(c.updated_at, now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(c);
  }
  return GROUP_ORDER.filter((l) => groups.has(l)).map((label) => ({ label, items: groups.get(label) }));
}

/** "8:30 AM" for today's and yesterday's rows, "12 Nov" for older ones. */
export function whenLabel(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const recent = ["Today", "Yesterday"].includes(groupLabel(iso, now));
  return recent
    ? d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`)
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The second line of a conversation row: who it is about and when. */
export const scopeLine = (c, now = new Date()) =>
  [c.scope === "client" && c.client_name ? c.client_name : "All clients", whenLabel(c.updated_at, now)].filter(Boolean).join(" · ");
