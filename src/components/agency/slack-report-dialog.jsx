"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, Notice, Radio, RadioGroup, SelectField, TextField } from "@/components/by";
import { DATA_WINDOWS, EVENTS, WEEKDAYS, timezoneOptions } from "@/components/reports/report-format";
import { ACCOUNT_TZ, ANY_ALERT, BIRDY_CHANNEL, bodyFor, initialForm } from "@/lib/slack-report-form";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";

function Group({ label, children, hint }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-by-body-sm font-medium text-by-text">{label}</legend>
      {children}
      {hint && <p className="text-by-caption text-by-muted">{hint}</p>}
    </fieldset>
  );
}

/**
 * Create or change one Slack report: its name, what starts it, the window its numbers cover and
 * the channel. What it says (its blocks) is kept as it is: a new report starts from the standard
 * brief, and the content is designed with Birdy in BirdyHub › Reports.
 *
 * @param {object|null} props.report null for a new report
 * @param {{create: Function, update: Function}} props.api from useSlackReports
 * @param {(report: object) => void} [props.onSaved]
 */
export function SlackReportDialog({ open, onOpenChange, report, api, alerts = [], slack, accountTz, onSaved }) {
  const isNew = !report;
  const isDefault = Boolean(report?.is_default);
  const [form, setForm] = useState(() => initialForm(report));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(initialForm(report));
      setError(null);
    }
  }, [open, report]);

  const { data: channelData, error: channelError } = useSWR(open && slack?.installed ? queryKeys.slackChannels() : null, fetcher);
  const channels = channelData?.channels ?? [];
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const zones = useMemo(() => timezoneOptions(form.timezone !== ACCOUNT_TZ ? form.timezone : null), [form.timezone]);
  const birdyChannel = slack?.notify_channel_name ? `#${slack.notify_channel_name}` : "Birdy's channel";

  const channelOptions = [
    { value: BIRDY_CHANNEL, label: `${birdyChannel} (Birdy's channel)` },
    ...(form.channelId !== BIRDY_CHANNEL && !channels.some((c) => c.id === form.channelId) ? [{ value: form.channelId, label: `#${report?.channel_name || form.channelId}` }] : []),
    ...channels.map((c) => ({ value: c.id, label: `#${c.name}${c.is_private ? " (private)" : ""}` })),
  ];

  async function save(e) {
    e.preventDefault();
    const { body, error: problem } = bodyFor(form, { isDefault, channels });
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await api.create(body) : await api.update(report.id, body);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || "Couldn't save the report. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isNew ? "New report" : `Change ${report.name}`}
        description={isDefault ? "Your daily or weekly brief. Also set in onboarding and Settings." : "Posted to Slack, built from your live numbers."}
      >
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogBody className="flex flex-col gap-5">
            <TextField label="Name" value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Weekly leadership" />

            <Group label="When it sends">
              <RadioGroup value={form.kind} onValueChange={(kind) => set({ kind })} aria-label="When it sends">
                <Radio value="schedule" label="On a schedule" />
                <Radio value="event" label="When something happens in Birdy" disabled={isDefault} />
              </RadioGroup>
            </Group>

            {form.kind === "schedule" ? (
              <>
                <Group label="Repeats">
                  <RadioGroup value={form.frequency} onValueChange={(frequency) => set({ frequency })} aria-label="Repeats">
                    <Radio value="daily" label="Every day" />
                    <Radio value="weekly" label="Weekly" />
                  </RadioGroup>
                </Group>
                {form.frequency === "weekly" && (
                  <Group label="Day">
                    <RadioGroup value={form.day} onValueChange={(day) => set({ day })} aria-label="Day" className="gap-x-4">
                      {WEEKDAYS.map((d) => <Radio key={d} value={d} label={d.slice(0, 3)} aria-label={d} />)}
                    </RadioGroup>
                  </Group>
                )}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <TextField label="Time" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} help="Arrives within 5 minutes of it." />
                  <SelectField
                    label="Timezone"
                    value={form.timezone}
                    onChange={(e) => set({ timezone: e.target.value })}
                    options={[{ value: ACCOUNT_TZ, label: `Account (${accountTz || "Europe/London"})` }, ...zones.map((tz) => ({ value: tz, label: tz }))]}
                  />
                </div>
              </>
            ) : (
              <Group label="Send when">
                <RadioGroup value={form.event} onValueChange={(event) => set({ event })} aria-label="Send when" className="flex-col gap-y-3">
                  {EVENTS.map((ev) => (
                    <div key={ev.value} className="flex flex-col gap-1">
                      <Radio value={ev.value} label={ev.label} />
                      <p className="pl-6.5 text-by-caption text-by-muted">{ev.hint}</p>
                    </div>
                  ))}
                </RadioGroup>
                {form.event === "alert_fired" && (
                  <SelectField
                    className="pl-6.5"
                    aria-label="Which alert"
                    value={form.alertId}
                    onChange={(e) => set({ alertId: e.target.value })}
                    options={[{ value: ANY_ALERT, label: "Any alert" }, ...alerts.map((a) => ({ value: a.id, label: a.name }))]}
                  />
                )}
              </Group>
            )}

            {!isDefault && (
              <Group label="Numbers cover" hint={form.kind === "event" ? "The window the report's figures use when the event happens." : undefined}>
                <RadioGroup value={form.window} onValueChange={(window) => set({ window })} aria-label="Numbers cover">
                  {DATA_WINDOWS.map((w) => <Radio key={w.value} value={w.value} label={w.label} />)}
                </RadioGroup>
              </Group>
            )}

            <SelectField
              label="Channel"
              value={form.channelId}
              onChange={(e) => set({ channelId: e.target.value })}
              options={channelOptions}
              help={channelError ? "Couldn't list your Slack channels. Reconnect Slack in Settings." : "Private channels need Birdy invited first (/invite @Birdy)."}
            />

            {error && <Notice tone="danger">{error}</Notice>}
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button kind="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button kind="primary" type="submit" loading={saving}>{isNew ? "Create report" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
