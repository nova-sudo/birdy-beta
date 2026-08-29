// What belongs in an activity feed.
//
// The backend logs everything Birdy touches, including read-only passes — a
// weekly analysis run over a client produces an entry even when nothing about
// the account changed. Those swamp the feed (30 rows, none of them an event an
// owner can act on), so the feed keeps only entries that represent a change
// that was actually made.
//
// Deny-list rather than allow-list on purpose: a change kind the backend adds
// later should show up in the feed without a frontend release, while the known
// noise stays out.
const NON_CHANGE_KINDS = new Set([
  "analysis_pass", // Birdy read the numbers; nothing was changed.
  "suggestion_created", // A proposal, not a change — it lives in Suggestions.
  "suggestion_dismissed", // Clearing the queue changes nothing on the account.
]);

// Entries that predate `kind`, or arrive without one, are caught by their
// title: "Analyzed <client> — weekly performance" is the analysis pass.
const NON_CHANGE_TITLE = /^analy[sz]ed\b/i;

/** @param {{kind?: string, title?: string, action?: string}} entry */
export function isChangeActivity(entry) {
  if (!entry) return false;
  if (entry.kind) return !NON_CHANGE_KINDS.has(entry.kind);
  return !NON_CHANGE_TITLE.test((entry.title ?? entry.action ?? "").trim());
}
