// Birdy in an AI app (the MCP connector): setup steps per app, and the small
// formatters the connections list and the activity log share.
//
// In a step, **bold** marks bold text and {url} becomes Birdy's MCP link. A
// step with `code` shows that line as a code block.

export const CONNECT_APPS = [
  {
    key: "claude",
    label: "Claude",
    steps: [
      { text: "In Claude, open **Settings → Connectors** and choose **Add custom connector**." },
      { text: "Name it **Birdy** and paste the link above." },
      { text: "Click **Connect**. You'll come back here to log in and choose what Claude can do." },
    ],
  },
  {
    key: "claude-desktop",
    label: "Claude Desktop",
    steps: [
      { text: "In Claude Desktop, open **Settings → Connectors** and choose **Add custom connector**." },
      { text: "Name it **Birdy** and paste the link above." },
      { text: "Click **Connect**. Your browser opens so you can log in to Birdy and choose what Claude can do." },
    ],
  },
  {
    key: "claude-code",
    label: "Claude Code",
    steps: [
      { text: "In your terminal, run:", code: "claude mcp add --transport http birdy {url}" },
      { text: "Start Claude Code and run **/mcp**, then pick **birdy** and choose **Authenticate**." },
      { text: "Log in to Birdy in the browser and choose what Claude Code can do." },
    ],
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    steps: [
      { text: "In ChatGPT, open **Settings → Connectors → Advanced** and turn on **Developer mode**." },
      { text: "Choose **Create**, name it **Birdy**, paste the link above and pick **OAuth** for authentication." },
      { text: "Click **Create**, then log in to Birdy and choose what ChatGPT can do." },
    ],
  },
  {
    key: "cursor",
    label: "Cursor",
    steps: [
      { text: "In Cursor, open **Settings → MCP** and choose **Add new MCP server**." },
      { text: "Name it **Birdy**, set the type to **HTTP** (streamable) and paste the link above." },
      { text: "Click **Login** next to Birdy, then log in and choose what Cursor can do." },
    ],
  },
];

export const CHECK_IN_PROMPT =
  "Every weekday at 8am, use Birdy's check_my_accounts tool and tell me only what needs my attention today, most urgent first.";

export const ACCESS_LABEL = { read: "View my data", write: "View and make changes" };

export const KIND_LABEL = {
  lookup: "Looked up",
  change: "Change",
  preview: "Preview",
  live: "Live change",
  refused: "Refused",
};

const REFUSAL_REASON = {
  view_only: "View-only connection",
  no_subscription: "Subscription inactive",
  out_of_credits: "Out of credits",
  rate_limit: "Too many requests",
  bad_code: "Approval code invalid or expired",
  state_changed: "Changed since the preview",
  no_scope: "No access granted",
};

/** A step's text as plain and bold parts, with {url} filled in. */
export function stepParts(text, url) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith("**") ? { bold: true, text: part.slice(2, -2).replace("{url}", url) } : { bold: false, text: part.replace("{url}", url) }));
}

const valid = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "14 Nov", or a dash. */
export function formatDate(iso) {
  const d = valid(iso);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
}

/** When a connection was last used: "Just now", "5 min ago", "Yesterday", "14 Nov", or "Never". */
export function formatRelative(iso, now = Date.now()) {
  const d = valid(iso);
  if (!d) return "Never";
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  if (Math.round(hours / 24) === 1) return "Yesterday";
  return formatDate(iso);
}

const pad = (n) => String(n).padStart(2, "0");
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Local HH:MM. */
export function formatClock(iso) {
  const d = valid(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}

/** Local time: HH:MM today, "Yesterday", otherwise "14 Nov". */
export function formatWhen(iso, now = new Date()) {
  const d = valid(iso);
  if (!d) return "—";
  if (sameDay(d, now)) return formatClock(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "Today 10:41", "Yesterday 10:41", "14 Nov 10:41". */
export function formatWhenLong(iso, now = new Date()) {
  const d = valid(iso);
  if (!d) return "—";
  const when = formatWhen(iso, now);
  return sameDay(d, now) ? `Today ${when}` : `${when} ${formatClock(iso)}`;
}

/** Credits to at most two decimals, without trailing zeros. */
export function formatCredits(n) {
  return String(Number((Number(n) || 0).toFixed(2)));
}

/** A kind in words; a refusal says why. */
export function kindLabel(kind, reason) {
  if (kind === "refused" && reason) return `Refused · ${REFUSAL_REASON[reason] || reason}`;
  return KIND_LABEL[kind] || kind || "";
}

/** A tool call's arguments for display, or null when there were none. */
export function prettyArgs(args) {
  if (args == null || (typeof args === "object" && Object.keys(args).length === 0)) return null;
  return typeof args === "string" ? args : JSON.stringify(args, null, 2);
}

/**
 * The start of the viewer's local day N days ago, as an exact instant. A bare
 * date would be read as UTC midnight by the API and move the window by up to a day.
 */
export function localDayStart(daysAgo, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** The activity log's query string for a set of filters. */
export function activityQuery({ app, kind, client, days }, now = new Date()) {
  const q = new URLSearchParams();
  if (app) q.set("app", app);
  if (kind) q.set("kind", kind);
  if (client) q.set("client_group_id", client);
  q.set("from", localDayStart(days, now));
  return q;
}

/** "1 request", "2,400 requests". */
export const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
