// The Slack report form's state and the request it sends, shared by BirdyHub's
// report sheet (components/reports/ReportPanel) and the agent pages' Reports
// (components/agency/reports-*). The API is routers/slack_reports.py.

export const ACCOUNT_TZ = "__account__";
export const ANY_ALERT = "__any__";
export const BIRDY_CHANNEL = "__birdy__";

/** The form's state for a report, or for a new one. */
export function initialForm(report) {
  const t = report?.trigger;
  return {
    name: report?.name ?? "",
    kind: t?.type ?? "schedule",
    frequency: t?.type === "schedule" ? t.frequency : "daily",
    day: (t?.type === "schedule" && t.day) || "Monday",
    time: (t?.type === "schedule" && t.time) || "09:00",
    timezone: (t?.type === "schedule" && t.timezone) || ACCOUNT_TZ,
    event: (t?.type === "event" && t.event) || "alert_fired",
    alertId: (t?.type === "event" && t.alert_id) || ANY_ALERT,
    channelId: report?.channel_id || BIRDY_CHANNEL,
    window: report?.template?.frequency ?? "daily",
    template: report?.template ?? null,
  };
}

/** The request body for a form, or { error } saying what to fix first. */
export function bodyFor(form, { isDefault = false, channels = [] } = {}) {
  if (!form.name.trim()) return { error: "Give the report a name" };
  if (form.kind === "schedule" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) return { error: "Choose a time" };
  const trigger = form.kind === "schedule"
    ? {
      type: "schedule", frequency: form.frequency, day: form.frequency === "weekly" ? form.day : null,
      time: form.time, timezone: form.timezone === ACCOUNT_TZ ? null : form.timezone,
    }
    : { type: "event", event: form.event, alert_id: form.event === "alert_fired" && form.alertId !== ANY_ALERT ? form.alertId : null };
  // The brief's numbers always cover its own period: daily → yesterday, weekly → last 7 days.
  const window = isDefault ? form.frequency : form.window;
  const body = { name: form.name.trim(), trigger };
  const channel = channels.find((c) => c.id === form.channelId);
  body.channel_id = form.channelId === BIRDY_CHANNEL ? "" : form.channelId;
  body.channel_name = channel?.name ?? null;
  // Without content of its own the server keeps the report's (or the standard brief's) blocks.
  body.template = form.template ? { frequency: window, blocks: form.template.blocks } : { frequency: window };
  return { body };
}
