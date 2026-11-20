// The route a reply took between agents (Birdy, Media Buyer, Sales Coach and
// their sub-agents), shaped for the route map and the "agent's part" panel.
// Pure functions only: no React, no fetch.
//
// The server sends `route: null` when no other agent was involved. Otherwise:
//   { status, seconds, credits, limit_hit, steps: [{ id, agent, name, kind, status,
//     summary, question, asked_by, tools: [{ name, label, detail }], answer, credits, seconds }] }

/**
 * The main agents. `role` picks the colour pair in the kit (by-ops, by-buyer,
 * by-coach); `icon` is a name the kit maps to an icon, so this file stays free of React.
 */
export const AGENTS = {
  birdy: { key: "birdy", name: "Birdy", role: "ops", icon: "mascot", kind: "orchestrator", chat: "/dashboard/chat" },
  media_buyer: { key: "media_buyer", name: "Media Buyer", role: "buyer", icon: "megaphone", kind: "main", chat: "/media-buyer/chat" },
  sales_coach: { key: "sales_coach", name: "Sales Coach", role: "coach", icon: "phone", kind: "main", chat: "/sales-coach/chat" },
};

const ROUTE_STATUS = ["working", "done", "failed"];
const STEP_STATUS = ["working", "done", "failed", "skipped"];
const KINDS = ["orchestrator", "main", "sub"];
const LIMITS = ["asks", "depth", "repeat"];

const isSub = (key) => typeof key === "string" && key.startsWith("sub:");
const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const strOrNull = (v) => str(v) || null;

/**
 * Who an agent key is: its name, colour role and icon.
 * A sub-agent ("sub:<id>") gets the neutral role and keeps the main agent it belongs to in `parent`.
 *
 * @param {string} key "birdy" | "media_buyer" | "sales_coach" | "sub:<id>"
 * @param {{name?: string, parent?: string|null}} [extra] the step's own name wins over the default
 */
export function agentInfo(key, { name, parent = null } = {}) {
  const main = AGENTS[key];
  if (main) return { ...main, name: str(name) || main.name, parent: null };
  const parentInfo = AGENTS[parent] && parent !== "birdy" ? AGENTS[parent] : null;
  return {
    key: str(key) || "unknown",
    name: str(name) || "Sub-agent",
    role: "neutral",
    icon: "bot",
    kind: isSub(key) ? "sub" : "main",
    chat: parentInfo?.chat ?? null,
    parent: parentInfo?.key ?? null,
    parentName: parentInfo?.name ?? null,
  };
}

/** The link to an agent's own chat. A sub-agent's work lives in its main agent's chat. */
export function agentChatHref(info) {
  return info?.chat ?? AGENTS.birdy.chat;
}

/** Which main agent a sub-agent step belongs to: whoever asked it, or the nearest main agent before it. */
function parentOf(steps, index) {
  const step = steps[index];
  const asker = steps.find((s) => s.id === step.asked_by)?.agent ?? step.asked_by;
  if (AGENTS[asker] && asker !== "birdy") return asker;
  for (let i = index - 1; i >= 0; i--) {
    if (AGENTS[steps[i].agent] && steps[i].agent !== "birdy") return steps[i].agent;
  }
  return null;
}

/**
 * A route from the server made safe to draw: unknown statuses become sensible
 * defaults, numbers are never NaN, lists are always lists, and each step carries
 * `info` (agentInfo) for the kit. Returns null when there is nothing to draw.
 */
export function normalizeRoute(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.steps) || raw.steps.length === 0) return null;
  const status = ROUTE_STATUS.includes(raw.status) ? raw.status : "done";
  const base = raw.steps
    .filter((s) => s && typeof s === "object")
    .map((s, i) => ({
      id: str(s.id) || `step-${i}`,
      agent: str(s.agent) || "unknown",
      name: str(s.name),
      kind: KINDS.includes(s.kind) ? s.kind : AGENTS[s.agent]?.kind ?? (isSub(s.agent) ? "sub" : "main"),
      status: STEP_STATUS.includes(s.status) ? s.status : status === "working" ? "working" : "done",
      summary: str(s.summary),
      question: strOrNull(s.question),
      asked_by: strOrNull(s.asked_by),
      tools: (Array.isArray(s.tools) ? s.tools : [])
        .filter((t) => t && (t.label || t.name))
        .map((t) => ({ name: str(t.name), label: str(t.label) || str(t.name), detail: strOrNull(t.detail) })),
      answer: strOrNull(s.answer),
      credits: num(s.credits),
      seconds: num(s.seconds),
    }));
  if (base.length === 0) return null;
  const steps = base.map((s, i) => ({ ...s, info: agentInfo(s.agent, { name: s.name, parent: s.kind === "sub" ? parentOf(base, i) : null }) }));
  return {
    status,
    seconds: num(raw.seconds),
    credits: num(raw.credits),
    limit_hit: LIMITS.includes(raw.limit_hit) ? raw.limit_hit : null,
    steps,
  };
}

/** "8s", "34s", "1m 12s", "2m". */
export function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(num(seconds)));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

/** "1 credit", "18 credits", "2.5 credits". */
export function formatCredits(credits) {
  const c = Math.round(num(credits) * 10) / 10;
  return `${c.toLocaleString("en-GB")} ${c === 1 ? "credit" : "credits"}`;
}

/** The footer's right side: "34s · 18 credits". Credits are left out while they are still zero. */
export function routeMeta(route) {
  if (!route) return "";
  return [formatSeconds(route.seconds), route.credits > 0 ? formatCredits(route.credits) : null].filter(Boolean).join(" · ");
}

/** The same for one agent's share, for its part. */
export function stepMeta(step) {
  if (!step) return "";
  return [step.seconds > 0 ? formatSeconds(step.seconds) : null, step.credits > 0 ? formatCredits(step.credits) : null].filter(Boolean).join(" · ");
}

/** The index of the agent at work right now (the last one marked working), or -1 when nobody is. */
export function liveIndex(route) {
  if (!route || route.status !== "working") return -1;
  for (let i = route.steps.length - 1; i >= 0; i--) if (route.steps[i].status === "working") return i;
  return -1;
}

/**
 * The line in use: the one leading into the live agent, numbered from 0 for
 * the line between the first two agents. -1 when no line is in use.
 */
export function liveWire(route) {
  const i = liveIndex(route);
  return i > 0 ? i - 1 : -1;
}

/** One word for a step's state, so the map never relies on colour alone. */
export function stepStatusLabel(status) {
  return { working: "Working", done: "Done", failed: "Couldn’t finish", skipped: "Skipped" }[status] ?? "Done";
}

/** The footer's first word. */
export function routeStatusLabel(route) {
  return { working: "Working", done: "Done", failed: "Stopped" }[route?.status] ?? "Done";
}

/** The footer's sentence: who is busy, or where the answer went. */
export function routeStatusLine(route) {
  if (!route) return "";
  const steps = route.steps;
  if (route.status === "working") {
    const live = steps[liveIndex(route)];
    if (!live) return "Agents are on it";
    return live.summary ? `${live.info.name}: ${lowerFirst(live.summary)}` : `${live.info.name} is working`;
  }
  if (route.status === "failed") {
    const failed = steps.find((s) => s.status === "failed");
    return failed ? `${failed.info.name} couldn’t finish its part` : "The agents couldn’t finish";
  }
  return `Answer came back to ${steps[0].info.name}`;
}

const lowerFirst = (s) => (s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** A limit the reply ran into, in plain words. Null when none was hit. */
export function limitMessage(limit) {
  return {
    asks: "This reply reached its limit of 3 agent asks, so it answers with what came back so far.",
    depth: "The chain of agents can’t go any deeper, so this answer uses what came back so far.",
    repeat: "An agent already in this reply was asked again, so that ask was skipped.",
  }[limit] ?? null;
}

/** Who asked this step its question: the asking agent's name, or null for the first agent. */
export function askedByName(route, step) {
  if (!route || !step?.asked_by) return null;
  const byId = route.steps.find((s) => s.id === step.asked_by);
  if (byId) return byId.info.name;
  return route.steps.find((s) => s.agent === step.asked_by)?.info.name ?? AGENTS[step.asked_by]?.name ?? null;
}

/** The step with this id, or null. */
export function findStep(route, id) {
  return route?.steps.find((s) => s.id === id) ?? null;
}
