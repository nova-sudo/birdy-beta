"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, NativeSelectField, Notice, Radio, RadioGroup, Switch, TextField } from "@/components/by";
import { timezoneOptions } from "@/components/reports/report-format";
import { LATEST_RUN_TIME, timeProblem } from "@/components/agents/stock/SetupSchedule";
import { agentSchedule } from "@/lib/agency-reports";
import { patchAgent } from "@/lib/agents-api";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import { revalidateStock, useStockActions } from "@/lib/stock-agent-api";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const NO_CHANNEL = "__none__";

function Group({ label, children, hint }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-by-body-sm font-medium text-by-text">{label}</legend>
      {children}
      {hint && <p className="text-by-caption text-by-muted">{hint}</p>}
    </fieldset>
  );
}

function initial(agent) {
  const s = agentSchedule(agent);
  const slack = agent?.settings?.slack ?? {};
  return {
    time: agent?.scope?.schedule?.time ?? "07:00",
    tz: agent?.scope?.schedule?.tz ?? "Europe/London",
    channelId: slack.channel_id ?? NO_CHANNEL,
    weeklyOn: s.weekly.enabled,
    weekday: s.weekly.weekday,
    autoPost: s.weekly.autoPost,
  };
}

/**
 * Change one of the Media Buying Agent's reports, with the same settings its old settings page had.
 * The morning report: the time and zone the day's run starts, and the Slack channel. The weekly
 * report: on or off, its weekday, whether it posts by itself, and the same channel. The channel is
 * the agent's one channel, shared by both reports and the client cards.
 *
 * The time lives on the agent (PATCH /api/agents/{id}, scope) and the rest in its settings (PATCH
 * /settings), so a save is up to two requests. The scope is only sent when it changed: a live agent
 * re-checks its client claims on every scope patch.
 *
 * @param {"morning"|"weekly"} props.reportKey
 * @param {object} props.agent the full agent
 * @param {object|null} props.slack Slack's status (installed, ...)
 */
export function AgentReportDialog({ open, onOpenChange, reportKey, agent, slack, onSaved }) {
  const actions = useStockActions(agent.id);
  const { mutate } = useSWRConfig();
  const [form, setForm] = useState(() => initial(agent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const weekly = reportKey === "weekly";

  useEffect(() => {
    if (open) {
      setForm(initial(agent));
      setError(null);
    }
  }, [open, agent]);

  const { data: channelData, error: channelError } = useSWR(open && slack?.installed ? queryKeys.slackChannels() : null, fetcher);
  const channels = useMemo(() => channelData?.channels ?? [], [channelData]);
  const zones = useMemo(() => timezoneOptions(form.tz), [form.tz]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const stored = agent?.settings?.slack ?? {};

  const channelOptions = [
    { value: NO_CHANNEL, label: "No channel (shown in Birdy only)" },
    ...(form.channelId !== NO_CHANNEL && !channels.some((c) => c.id === form.channelId) ? [{ value: form.channelId, label: `#${stored.channel_name || form.channelId}` }] : []),
    ...channels.map((c) => ({ value: c.id, label: `#${c.name}${c.is_private ? " (private)" : ""}` })),
  ];

  const timeError = weekly ? null : timeProblem(form.time);

  async function save(e) {
    e.preventDefault();
    if (timeError) return setError(timeError);
    setSaving(true);
    setError(null);
    const was = initial(agent);
    let scopeSaved = false;
    try {
      if (!weekly && (form.time !== was.time || form.tz !== was.tz)) {
        await patchAgent(agent.id, { scope: { schedule: { time: form.time, tz: form.tz } } });
        scopeSaved = true;
      }
      const settings = {};
      if (form.channelId !== was.channelId) {
        const channel = channels.find((c) => c.id === form.channelId);
        settings.slack = form.channelId === NO_CHANNEL ? { channel_id: null, channel_name: null } : { channel_id: form.channelId, channel_name: channel?.name ?? stored.channel_name ?? null };
      }
      if (weekly && (form.weeklyOn !== was.weeklyOn || form.weekday !== was.weekday || form.autoPost !== was.autoPost)) {
        settings.weekly = { enabled: form.weeklyOn, weekday: form.weekday, auto_post: form.autoPost };
      }
      if (Object.keys(settings).length) await actions.patchSettings({ settings });
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      const message = err?.errors?.length ? String(err.errors[0]) : err?.message || "Couldn't save the report. Try again.";
      setError(scopeSaved ? `${message} The time was saved, but the rest wasn't.` : message);
    } finally {
      setSaving(false);
      if (scopeSaved) await Promise.all([revalidateStock(mutate, agent.id), mutate(queryKeys.agents())]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={weekly ? "Change Weekly report" : "Change Morning report"}
        description={weekly ? "A wrap-up of last week, built in the morning run on its day." : "The Media Buying Agent's daily check of every client."}
      >
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogBody className="flex flex-col gap-5">
            {weekly ? (
              <>
                <Switch label="Send a weekly report" checked={form.weeklyOn} onCheckedChange={(weeklyOn) => set({ weeklyOn })} />
                {form.weeklyOn && (
                  <>
                    <Group label="Day" hint="It is built in that day's morning run.">
                      <RadioGroup value={String(form.weekday)} onValueChange={(d) => set({ weekday: Number(d) })} aria-label="Day" className="gap-x-4">
                        {WEEKDAYS.map((d, i) => <Radio key={d} value={String(i)} label={d.slice(0, 3)} aria-label={d} />)}
                      </RadioGroup>
                    </Group>
                    <Switch
                      label="Post it to Slack by itself"
                      checked={form.autoPost}
                      onCheckedChange={(autoPost) => set({ autoPost })}
                    />
                    <p className="-mt-3 text-by-caption text-by-muted">When this is off, it waits in the morning report for you to post it.</p>
                  </>
                )}
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <TextField
                  label="Time"
                  type="time"
                  max={LATEST_RUN_TIME}
                  value={form.time}
                  onChange={(e) => e.target.value && set({ time: e.target.value })}
                  error={timeError ?? undefined}
                  help={timeError ? undefined : `Every day. The latest you can pick is ${LATEST_RUN_TIME}.`}
                />
                <NativeSelectField
                  label="Timezone"
                  value={form.tz}
                  onChange={(e) => set({ tz: e.target.value })}
                  options={zones.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))}
                />
              </div>
            )}

            {slack?.installed ? (
              <NativeSelectField
                label="Channel"
                value={form.channelId}
                onChange={(e) => set({ channelId: e.target.value })}
                options={channelOptions}
                help={channelError ? "Couldn't list your Slack channels. Reconnect Slack in Settings." : "The morning report, the weekly report and the client cards all post here."}
              />
            ) : (
              <Notice tone="info">Slack isn’t connected, so the reports stay in Birdy. Connect it in Settings to pick a channel.</Notice>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button kind="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button kind="primary" type="submit" loading={saving}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
