// What the agent pages' Reports say about each report, from the server's own
// records only.
//
// Birdy: the account's Slack reports (GET /api/slack-reports): the daily or
// weekly brief and any report added since. Each has a trigger, a channel, an
// on/off switch and its last run; the server keeps no list of past runs.
//
// Media Buyer: the Birdy Media Buying Agent's own reports. It runs every day at
// its scheduled time (agent.scope.schedule), checks one batch of clients on
// that batch's weekdays and only the alerts on other days, and posts to its
// Slack channel. On the weekly report's weekday the same run also builds the
// weekly message. Its runs come from GET /api/agents/{id}/runs.

import { contentSummary, contentTitle, lastRunShort, triggerLabel } from "@/components/reports/report-format";
import { dayLabel, parseServerDate } from "@/lib/stock-agent-api";
import { clockWords, nextRun, safeZone, weekdaysWords, whenWords, zoneCity } from "@/lib/report-schedule";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Birdy: Slack reports ───────────────────────────────────────────────

/** The status pill for a Slack report: off, its last run's outcome, or waiting for its first. */
export function slackStatus(report, now = new Date()) {
  if (!report.enabled) return { tone: "neutral", label: "Paused" };
  const run = lastRunShort(report.last_run, now);
  if (run?.tone === "danger") return { tone: "danger", label: "Failed" };
  if (run?.tone === "success" && run.text === "Sent today") return { tone: "success", label: "Sent today" };
  if (report.trigger?.type === "event") return { tone: "accent", label: "On" };
  return { tone: "accent", label: "Scheduled" };
}

/** The next time a scheduled Slack report goes out, or null (an event report, or off). */
export function slackNext(report, accountTz, now = new Date()) {
  const t = report.trigger;
  if (!report.enabled || t?.type !== "schedule") return null;
  const weekdays = t.frequency === "weekly" ? [Math.max(0, WEEKDAYS.indexOf(t.day || "Monday"))] : null;
  return nextRun({ time: t.time, tz: t.timezone || accountTz, weekdays }, now);
}

/**
 * Everything a row or a report page shows about one Slack report.
 * @param {object} report a report from GET /api/slack-reports
 * @param {{alerts?: object[], birdyChannel?: string|null, accountTz?: string|null, now?: Date}} [ctx]
 */
export function slackReportView(report, { alerts = [], birdyChannel = null, accountTz = null, now = new Date() } = {}) {
  const t = report.trigger ?? {};
  const tz = safeZone(t.timezone || accountTz);
  const next = slackNext(report, accountTz, now);
  const last = lastRunShort(report.last_run, now);
  const channel = report.channel_name ? `#${report.channel_name}` : report.channel_id ? report.channel_id : birdyChannel ? `#${birdyChannel}` : "Birdy's Slack channel";
  return {
    id: report.id,
    name: report.name,
    isDefault: Boolean(report.is_default),
    enabled: Boolean(report.enabled),
    what: contentTitle(report.template) || contentSummary(report.summary) || "Birdy's standard brief",
    contents: contentSummary(report.summary),
    when: t.type === "schedule" ? `${triggerLabel(t, alerts)}${t.timezone || accountTz ? ` ${zoneCity(tz)}` : ""}` : triggerLabel(t, alerts),
    channel,
    status: slackStatus(report, now),
    next: next ? whenWords(next, now, tz) : null,
    // When it last went (or tried to), on the schedule's clock; the pill says how it went.
    last: report.last_run?.at ? whenWords(parseServerDate(report.last_run.at), now, tz) : null,
    lastError: last?.error ?? null,
    window: report.template?.frequency === "weekly" ? "Last 7 days" : "Yesterday",
  };
}

// ─── Media Buyer: the Media Buying Agent's reports ──────────────────────────

const DEFAULT_BATCHES = [{ id: "a", name: "Batch A", weekdays: [0, 3] }, { id: "b", name: "Batch B", weekdays: [1, 4] }];

/** The agent's schedule: its time and zone (the runner's defaults when unset), its batches and weekly message. */
export function agentSchedule(agent) {
  const s = agent?.scope?.schedule ?? {};
  const settings = agent?.settings ?? {};
  return {
    time: s.time || "07:00",
    tz: safeZone(s.tz),
    batches: Array.isArray(settings.batches) ? settings.batches : DEFAULT_BATCHES,
    weekly: { enabled: Boolean(settings.weekly?.enabled), weekday: settings.weekly?.weekday ?? 0, autoPost: Boolean(settings.weekly?.auto_post) },
    channel: settings.slack?.channel_name ? `#${settings.slack.channel_name}` : null,
  };
}

/** "Batch A on Mon, Thu · Batch B on Tue, Fri · other days: alerts only". */
export function batchWords(batches) {
  const used = batches.filter((b) => b.weekdays?.length);
  const parts = used.map((b) => `${b.name} on ${weekdaysWords(b.weekdays)}`);
  const covered = new Set(used.flatMap((b) => b.weekdays));
  if (covered.size < 7) parts.push("other days: alerts only");
  return parts.join(" · ");
}

/** Whether the agent is running its schedule. A draft or a turned-off agent sends nothing. */
export const agentRunning = (agent) => agent?.status === "active";

/**
 * The agent's reports as the Reports list shows them: the morning report, and the weekly one when it is on.
 * @param {object} agent the Media Buying Agent (GET /api/agents/{id})
 * @param {object|null} latest its newest run (GET /runs/latest), if any
 */
export function buyerReports(agent, latest, now = new Date()) {
  const s = agentSchedule(agent);
  const on = agentRunning(agent);
  const at = `${clockWords(s.time)} ${zoneCity(s.tz)}`;
  const goesTo = s.channel ? `${s.channel} in Slack` : "Birdy only (no Slack channel set)";
  const nextDaily = on ? nextRun({ time: s.time, tz: s.tz }, now) : null;
  const morning = {
    key: "morning",
    name: "Morning report",
    what: "Every client against its CPL zones, and the changes that need you",
    when: `Every day · ${at}`,
    detail: batchWords(s.batches),
    goesTo,
    channel: s.channel ? "Slack" : "Birdy",
    on,
    next: nextDaily ? whenWords(nextDaily, now, s.tz) : null,
    last: latest?.local_date ? dayLabel(latest.local_date) : null,
  };
  const reports = [morning];
  if (s.weekly.enabled) {
    const nextWeekly = on ? nextRun({ time: s.time, tz: s.tz, weekdays: [s.weekly.weekday] }, now) : null;
    reports.push({
      key: "weekly",
      name: "Weekly report",
      what: "Last Monday to Sunday against the week before, client by client",
      when: `${WEEKDAYS[s.weekly.weekday] ?? "Monday"}s · with the morning report`,
      detail: s.weekly.autoPost ? "Posted to Slack by itself" : "Waits in the morning report for you to post it",
      goesTo,
      channel: s.channel ? "Slack" : "Birdy",
      on,
      next: nextWeekly ? whenWords(nextWeekly, now, s.tz) : null,
      last: null,
    });
  }
  return reports;
}

/** Monday-first weekday of a "YYYY-MM-DD" day. */
const weekdayOf = (iso) => (new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7;

/** The runs that belong to a report: every run for the morning report, the weekly's weekday for the weekly. */
export function runsOf(key, runs, agent) {
  if (key !== "weekly") return runs;
  const day = agentSchedule(agent).weekly.weekday;
  return runs.filter((r) => r.local_date && weekdayOf(r.local_date) === day);
}

/** One run as a line in a report's Runs list: its day, then what it covered and whether it reached Slack. */
export function runLine(run, batches = DEFAULT_BATCHES) {
  const clients = Object.values(run.clients ?? {});
  const checked = clients.filter((c) => c.carded).length;
  const alerts = Array.isArray(run.alerts) ? run.alerts.length : 0;
  const batch = run.kind === "batch" ? batches.find((b) => b.id === run.batch_id)?.name ?? `Batch ${String(run.batch_id ?? "").toUpperCase()}` : "Alerts only";
  const parts = [batch];
  if (run.kind === "batch") parts.push(`${checked} ${checked === 1 ? "client" : "clients"} checked`);
  parts.push(`${alerts} ${alerts === 1 ? "alert" : "alerts"}`);
  let state = null;
  if (run.phase && run.phase !== "done") state = { tone: "accent", label: "Running" };
  else if (run.publish_error) state = { tone: "danger", label: "Not posted" };
  else if (run.slack?.ts) state = { tone: "success", label: "Posted" };
  return { title: dayLabel(run.local_date), line: parts.join(" · "), state };
}
