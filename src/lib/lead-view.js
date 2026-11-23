// Pure helpers for the redesigned lead view (the lead page and the lead modal).
// They shape what GET /api/leads/contact/{id} and .../messages return; the
// older helpers in lib/lead-detail.js (call de-duplication, day grouping,
// journey times) are reused as they are.

import { threadDays } from "./lead-detail";
import { LEADS_HREF } from "./leads-hub";

const ANSWERED = new Set(["completed", "answered"]);

/** The status of the lead's first opportunity: "won" | "lost" | "abandoned" | "open", or null without one. */
export function leadStatus(opportunities) {
  const s = String(opportunities?.[0]?.status ?? "").toLowerCase();
  return ["won", "lost", "abandoned", "open"].includes(s) ? s : s ? "open" : null;
}

/**
 * How far the lead got, in the Leads table's words, so a row and the lead it opens agree:
 * Closed (any won deal), Lost (every deal lost or abandoned), Called (a call), else In CRM.
 */
export function funnelStage(detail) {
  const opps = detail?.opportunities ?? [];
  const statuses = opps.map((o) => String(o.status ?? "").toLowerCase());
  if (statuses.includes("won")) return "closed";
  if (statuses.length > 0 && statuses.every((s) => s === "lost" || s === "abandoned")) return "lost";
  if ((detail?.calls ?? []).length > 0) return "called";
  return "crm";
}

/** The pipeline stage's name beside the stage pill, or "". */
export const stageNote = (detail) => detail?.opportunities?.find((o) => o.stage_name)?.stage_name ?? "";

const toMs = (iso) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

/** 56s → "56s"; 933 min → "15h 33m"; 3120 min → "2d 4h". Null for a missing or negative span. */
export function span(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const min = Math.floor(seconds / 60);
  if (min < 1) return `${Math.round(seconds)}s`;
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

/** 525 → "8m 45s"; 40 → "40s". */
export const talk = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`);

const dayMonth = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const clock = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "14:05", or "" for a missing time. */
export const timeOf = (iso) => (toMs(iso) == null ? "" : clock(toMs(iso)));

/** "Today 09:12", "Yesterday 15:45", else "3 Nov, 10:00". */
export function touchWhen(iso, now = new Date()) {
  const t = toMs(iso);
  if (t == null) return "—";
  const day = (ms) => new Date(ms).toDateString();
  const n = new Date(now).getTime();
  if (day(t) === day(n)) return `Today ${clock(t)}`;
  if (day(t) === day(n - 86400000)) return `Yesterday ${clock(t)}`;
  return `${dayMonth(t)}, ${clock(t)}`;
}

/** "21 Nov, 11:20", or "" for a missing time. */
export const stamp = (iso) => (toMs(iso) == null ? "" : `${dayMonth(toMs(iso))}, ${clock(toMs(iso))}`);

/** "24 Nov, 12:48" from a zone-less "YYYY-MM-DDTHH:MM" read as written (the location's own clock), or "". */
export function localStamp(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(str || "");
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31 || +m[4] > 23 || +m[5] > 59) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${m[4]}:${m[5]}`;
}

/** "17 Jul 2026", or "—". */
export function createdLabel(iso) {
  const t = toMs(iso);
  return t == null ? "—" : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const valueFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/**
 * The three tiles under the header. Won and Lost lead with the deal's value (the outcome);
 * Open and Abandoned lead with how long it has been, then the last touch, and the value last.
 * GoHighLevel sends no currency with an opportunity, so the value is a plain number.
 *
 * @param {object} detail the lead detail
 * @param {object[]} items the conversation, oldest first (threadItems)
 * @returns {{key: string, label: string, value: string, note: string, tip?: string, tone?: "danger"}[]}
 */
export function leadTiles(detail, items, now = new Date()) {
  const opp = detail?.opportunities?.[0];
  const status = leadStatus(detail?.opportunities);
  const created = toMs(detail?.contact?.date_added);
  const changed = toMs(opp?.last_status_change_at);
  const amount = Number(opp?.monetary_value);
  const lost = status === "lost";

  const value = {
    key: "value",
    label: lost ? "Lost value" : "Deal value",
    value: Number.isFinite(amount) && amount > 0 ? valueFormat.format(amount) : "—",
    note: !opp ? "No opportunity yet"
      : status === "won" ? (changed ? `Closed ${dayMonth(changed)}` : "Won")
      : lost ? (changed ? `Lost ${dayMonth(changed)}` : "Lost")
      : status === "abandoned" ? "If paid" : "If won",
    tone: lost ? "danger" : undefined,
  };

  const since = (end) => (created != null && end != null ? span((end - created) / 1000) : null);
  const time = status === "won"
    ? { label: "Time to close", value: span(detail?.engagement?.time_to_close_seconds) ?? "—", tip: "From the lead being created to the opportunity being won." }
    : lost
      ? { label: "Lost after", value: since(changed) ?? "—", tip: "From the lead being created to the opportunity being marked lost." }
      : status === "abandoned"
        ? { label: "Abandoned after", value: since(changed) ?? "—", tip: "From the lead being created to the checkout being abandoned." }
        : { label: "Open for", value: since(new Date(now).getTime()) ?? "—", tip: "Time since the lead was created in GoHighLevel. It's still open." };

  const last = items?.[items.length - 1];
  const touch = { key: "touch", label: "Last touch", ...(last ? { value: touchWhen(last.at, now), note: touchNote(last, detail) } : { value: "None yet", note: "No messages or calls" }) };

  const timeTile = { key: "time", ...time, note: "Since lead created" };
  return status === "won" || lost ? [value, timeTile, touch] : [timeTile, touch, value];
}

function touchNote(item, detail) {
  const kind = item.kind === "call" ? "Call" : item.channel || "Message";
  if (item.direction === "inbound") {
    const name = detail?.contact?.first_name || detail?.contact?.name;
    return name ? `${kind} from ${name}` : kind;
  }
  return kind;
}

/**
 * The conversation as one list, oldest first: calls and messages, each with its day label
 * and a stable key. Uses threadDays so the grouping matches the old page.
 */
export function threadItems(calls, messages) {
  return threadDays(calls, messages).flatMap(({ day, items }) =>
    items.map((item) => ({ ...item, day, at: item.kind === "call" ? item.started_at : item.date, key: `${item.kind}-${item.id}` })),
  );
}

/** Whether a call reached someone. */
export const answered = (call) => ANSWERED.has(String(call?.status ?? "").toLowerCase());

const capitalise = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "");

/** A call card's words: "Outbound · 6m 05s", or "Inbound · No answer" for a call nobody took. */
export function callLabel(call) {
  const dir = call.direction === "inbound" ? "Inbound" : call.direction === "outbound" ? "Outbound" : "Call";
  const secs = Number(call.duration_seconds);
  const what = answered(call) && secs > 0 ? talk(secs) : capitalise(String(call.status || "").replace(/[-_]/g, " ")) || "No answer";
  return `${dir} · ${what}`;
}

/** The Calls tab's summary: answered of all, in and out, and talk time over the answered calls. */
export function callStats(calls) {
  const list = calls ?? [];
  const ans = list.filter(answered);
  return {
    total: list.length,
    answered: ans.length,
    inbound: list.filter((c) => c.direction === "inbound").length,
    outbound: list.filter((c) => c.direction !== "inbound").length,
    talkSeconds: ans.reduce((n, c) => n + (Number(c.duration_seconds) || 0), 0),
  };
}

/** Seconds from the lead being created to the team's first text, email or call, or null when there is none yet. */
export function firstReplySeconds(items, createdIso) {
  const created = toMs(createdIso);
  if (created == null) return null;
  const first = (items ?? []).find((i) => i.direction === "outbound" && toMs(i.at) != null && toMs(i.at) >= created);
  return first ? (toMs(first.at) - created) / 1000 : null;
}

/** A dialer transcript as plain text: a string, a list of segments, or {text}. */
export function transcriptText(transcript) {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .map((s) => (typeof s === "string" ? s : [s?.speaker, s?.text].filter(Boolean).join(": ")))
      .filter(Boolean)
      .join("\n");
  }
  return transcript.text || "";
}

/** "Meta · Facebook", "Meta · Instagram", "Meta", the platform's name, with "· organic" when it was not paid. */
export function platformLabel(attribution) {
  const raw = attribution?.platform || "";
  const code = raw.toLowerCase();
  const name = code === "fb" ? "Meta · Facebook" : code === "ig" ? "Meta · Instagram"
    : /^(facebook|meta|instagram)$/i.test(raw) ? "Meta" : capitalise(raw);
  return attribution?.is_organic ? `${name || "Unknown"} · organic` : name || "—";
}

// Counters and ticks automations add ("sms 1", "no answer 2", "hp queued"): they say little about the lead.
const AUTOMATION_TAG = /^(sms|no answer|email) \d+$|^hp (queued|called)$|^wa sent$/i;

/** Tags newest first (GoHighLevel stores them in the order they were added), automation counters last. */
export const tagsNewestFirst = (tags) => {
  const newest = [...(tags ?? [])].reverse();
  return [...newest.filter((t) => !AUTOMATION_TAG.test(t)), ...newest.filter((t) => AUTOMATION_TAG.test(t))];
};

const DIALERS = { hotprospector: "HotProspector", ghl: "GoHighLevel", gohighlevel: "GoHighLevel" };
/** Which dialer logged a call, by name; "" for GoHighLevel's own calls, which need no saying. */
export const dialerName = (source) => {
  const s = String(source ?? "").toLowerCase();
  if (!s || s === "ghl") return "";
  return DIALERS[s] ?? capitalise(String(source));
};

// ── In-thread search ──────────────────────────────────────────────────────
// It runs on the data: texts, email subjects, call cards, and every transcript
// the page has (dialer transcripts come with the call; a GoHighLevel call's is
// fetched when its card opens, and is searched from then on).

/** The searchable text of one item, field by field, in the order it shows. */
export function fieldsOf(item, transcripts = {}) {
  if (item.kind === "call") {
    const text = transcripts[item.key] ?? transcriptText(item.transcript);
    return [["card", callLabel(item)], ["transcript", text || ""]];
  }
  return [["subject", item.subject || ""], ["body", item.body || ""]];
}

const occurrences = (text, q) => {
  let n = 0;
  const lo = text.toLowerCase();
  for (let j = lo.indexOf(q); j !== -1; j = lo.indexOf(q, j + q.length)) n++;
  return n;
};

/**
 * Every match of `query` in the thread, in thread order.
 * @returns {{hits: {key: string, field: string}[], start: Map<string, number>}} `start` maps "key|field" to its first match's index
 */
export function findHits(items, query, transcripts = {}) {
  const q = query.trim().toLowerCase();
  const hits = [];
  const start = new Map();
  if (!q) return { hits, start };
  for (const item of items) {
    for (const [field, text] of fieldsOf(item, transcripts)) {
      const n = occurrences(text, q);
      if (!n) continue;
      start.set(`${item.key}|${field}`, hits.length);
      for (let k = 0; k < n; k++) hits.push({ key: item.key, field });
    }
  }
  return { hits, start };
}

/**
 * Splits `text` around the matches of `query`, numbering them from `base`.
 * @returns {{text: string, hit?: number}[]}
 */
export function markParts(text, query, base) {
  const q = query.trim().toLowerCase();
  if (!q || base === undefined || !text) return [{ text: text || "" }];
  const lo = text.toLowerCase();
  const out = [];
  let i = 0, n = base;
  for (let j = lo.indexOf(q); j !== -1; j = lo.indexOf(q, i), n++) {
    if (j > i) out.push({ text: text.slice(i, j) });
    out.push({ text: text.slice(j, j + q.length), hit: n });
    i = j + q.length;
  }
  if (i < text.length) out.push({ text: text.slice(i) });
  return out;
}

/** The leads table the lead belongs to: the client's Media Buyer Dashboard, Leads view; without a client, Media Buyer's Leads level. */
export const clientLeadsHref = (groupId) => (groupId ? `/media-buyer/table?client=${encodeURIComponent(groupId)}&view=leads` : LEADS_HREF);
