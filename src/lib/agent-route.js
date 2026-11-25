// The route a reply took between agents (Birdy, Marketing Guru, Sales Coach and
// their sub-agents), shaped for the route map and the "agent's part" panel.
// Pure functions only: no React, no fetch.
//
// The server sends `route: null` when no other agent was involved. Otherwise:
//   { status, seconds, credits, limit_hit, steps: [{ id, agent, name, kind, status,
//     summary, question, asked_by, tools: [{ name, label, detail }], answer, credits, seconds }] }
// A one-off helper a main agent started for one job (never saved) has kind "helper" and an
// agent key "sub:helper-<id>": it is drawn like a sub-agent of that main agent, with no Context row.

/**
 * The main agents. `role` picks the colour pair in the kit (by-ops, by-buyer,
 * by-coach); `icon` is a name the kit maps to an icon, so this file stays free of React.
 */
export const AGENTS = {
  birdy: { key: "birdy", name: "Birdy", role: "ops", icon: "mascot", kind: "orchestrator", chat: "/dashboard/chat", context: "/dashboard/context" },
  media_buyer: { key: "media_buyer", name: "Marketing Guru", role: "buyer", icon: "megaphone", kind: "main", chat: "/media-buyer/chat", context: "/media-buyer/context" },
  sales_coach: { key: "sales_coach", name: "Sales Coach", role: "coach", icon: "phone", kind: "main", chat: "/sales-coach/chat", context: "/sales-coach/context" },
};

const ROUTE_STATUS = ["working", "done", "failed"];
const STEP_STATUS = ["working", "done", "failed", "skipped"];
const KINDS = ["orchestrator", "main", "sub", "helper"];
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
 * @param {{name?: string, parent?: string|null, helper?: boolean}} [extra] the step's own name wins over the
 *   default; `helper` marks a one-off helper, which is kept nowhere, so it has no Context link
 */
export function agentInfo(key, { name, parent = null, helper = false } = {}) {
  const main = AGENTS[key];
  if (main) return { ...main, name: str(name) || main.name, parent: null };
  const parentInfo = AGENTS[parent] && parent !== "birdy" ? AGENTS[parent] : null;
  const subId = isSub(key) && !helper ? key.slice(4) : null;
  return {
    key: str(key) || "unknown",
    name: str(name) || (helper ? "Helper" : "Sub-agent"),
    role: "neutral",
    icon: "bot",
    kind: helper ? "helper" : isSub(key) ? "sub" : "main",
    chat: parentInfo?.chat ?? null,
    parent: parentInfo?.key ?? null,
    parentName: parentInfo?.name ?? null,
    // Where the sub-agent is kept: its row on its main agent's Context page.
    context: subId && parentInfo ? subAgentContextHref(parentInfo.key, subId) : null,
  };
}

/** The anchor of a sub-agent's row on Context. */
export const subAgentAnchor = (id) => `sub-agent-${String(id ?? "").replace(/[^A-Za-z0-9_-]/g, "-")}`;

/** The address of a sub-agent on its main agent's Context page, or null for an unknown main agent. */
export function subAgentContextHref(parent, id) {
  const base = AGENTS[parent]?.context;
  return base && parent !== "birdy" && id ? `${base}#${subAgentAnchor(id)}` : null;
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
      doing: strOrNull(s.doing),
      answer: strOrNull(s.answer),
      credits: num(s.credits),
      seconds: num(s.seconds),
    }));
  if (base.length === 0) return null;
  const steps = base.map((s, i) => {
    const helper = s.kind === "helper";
    return { ...s, info: agentInfo(s.agent, { name: s.name, helper, parent: s.kind === "sub" || helper ? parentOf(base, i) : null }) };
  });
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
    if (live.doing) return `${live.info.name} is looking at ${lowerFirst(live.doing)}`;
    return live.summary ? `${live.info.name}: ${lowerFirst(live.summary)}` : `${live.info.name} is thinking`;
  }
  if (route.status === "failed") {
    const failed = steps.find((s) => s.status === "failed");
    return failed ? `${failed.info.name} couldn’t finish its part` : "The agents couldn’t finish";
  }
  if (steps.length === 1) return `${steps[0].info.name} answered on its own`;
  return `Answer came back to ${steps[0].info.name}`;
}

/**
 * What an agent's box says while it works: the tool in hand, else that it is thinking.
 * @param {{doing: string|null, summary: string, tools: object[]}} step a normalised step
 */
export function workingLine(step) {
  if (step.doing) return `Looking at ${lowerFirst(step.doing)}…`;
  if (step.summary) return step.summary;
  return step.tools.length ? "Thinking it through…" : "Starting…";
}

/** Whether a finished reply's route is worth showing: more than one agent, or one that used tools. */
export function routeWorthShowing(raw) {
  const steps = Array.isArray(raw?.steps) ? raw.steps : [];
  return steps.length > 1 || (steps.length === 1 && Array.isArray(steps[0]?.tools) && steps[0].tools.length > 0);
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

const TIME_OUT = /ran out of time|timed? ?out/i;
const NO_TIME = /no time left/i;
const CHAIN = /chain|too deep|depth/i;
const ASKS = /limit of \d+ asks|asks? limit/i;
const ALREADY = /already (asked|in)|asked again|repeat/i;

/**
 * Why a step was skipped or couldn't finish, in plain words, from the route's `limit_hit` and the
 * step's own data (its summary and time). Null for a step that worked.
 */
export function stepReason(route, step) {
  if (!step || (step.status !== "skipped" && step.status !== "failed")) return null;
  const name = step.info?.name ?? "This agent";
  const said = step.summary ?? "";
  const took = step.seconds > 0 ? ` after ${formatSeconds(step.seconds)}` : "";
  if (step.status === "skipped") {
    if (step.kind === "helper" && /limit of \d+ helpers/i.test(said)) return `${name} wasn’t started because this reply had already used its 2 helpers.`;
    const limit = ASKS.test(said) ? "asks" : CHAIN.test(said) ? "depth" : ALREADY.test(said) ? "repeat" : route?.limit_hit ?? null;
    if (limit === "asks") return `${name} wasn’t asked because this reply had already used its 3 agent asks. Ask it on its own to get its answer.`;
    if (limit === "depth") return `${name} wasn’t asked because the chain of agents was already as long as it can go: an agent, Birdy, another agent and one of its sub-agents.`;
    if (limit === "repeat") return `${name} was already part of this reply, and each agent is asked only once per reply, so the second ask was skipped.`;
    return said ? `${name} wasn’t asked in the end. The note it left: “${said}”.` : `${name} wasn’t asked in the end.`;
  }
  if (NO_TIME.test(said)) return `${name} wasn’t asked because the reply had no time left for it. Ask it on its own to get its answer.`;
  if (TIME_OUT.test(said)) return `${name} ran out of time${took} before it could answer. Each reply has a few minutes in all, so a long ask can be cut short. Ask it in its own chat to give it the time.`;
  return said && !/could ?n.t finish|could not finish/i.test(said)
    ? `${name} couldn’t finish its part${took}. The note it left: “${said}”.`
    : `${name} hit a problem and couldn’t finish its part${took}. Try again, or ask it in its own chat.`;
}

/** The step with this id, or null. */
export function findStep(route, id) {
  return route?.steps.find((s) => s.id === id) ?? null;
}
