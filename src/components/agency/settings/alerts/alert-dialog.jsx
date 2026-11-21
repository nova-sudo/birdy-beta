"use client";

// Create or edit an alert: what it is, what it watches, when it fires, for
// whom, and how it tells you. Saves only on the Create or Save button, with
// the payload the old /alerts page sent (lib/alert-rules alertPayload).

import { useState } from "react";
import { Bell, Mail, MessageSquare } from "lucide-react";
import {
  Button, Dialog, DialogBody, DialogContent, DialogFooter, DropdownTrigger, Pill, Radio, RadioGroup, SelectField, Switch, TextField,
} from "@/components/by";
import { TYPE_OPTIONS, hasEmailChannel, withEmailChannel } from "@/lib/alert-helpers";
import {
  CREATIVE_METRIC_OPTIONS, FREQUENCY_OPTIONS, PERIOD_OPTIONS, alertPayload, fixedCondition, formProblems, formSentence, metricName,
  operatorOptions, perLabel, trackingHelp, withChannel, withCreativeMetric, withScope,
} from "@/lib/alert-rules";
import { sourceForCategory } from "@/lib/metric-sources";
import { MetricPicker } from "../metrics/metric-picker";
import { SourceMark } from "../metrics/source-mark";
import { ClientTargets, TestTargets } from "./alert-targets";

const asOptions = (list) => list.map((o) => ({ value: o.value, label: o.label }));

function Group({ title, children, aside }) {
  return (
    <section className="flex flex-col gap-3 border-t border-by-line-soft pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-by-body font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The client metric: a field that opens the searchable metric list under the condition row. */
function MetricField({ value, options, open, onOpenChange }) {
  const chosen = options.find((m) => m.id === value);
  return (
    <div className="min-w-0">
      <span id="alert-metric-l" className="mb-1.5 block text-by-body-sm font-medium">Metric</span>
      <DropdownTrigger
        aria-labelledby="alert-metric-l alert-metric-v"
        aria-expanded={open}
        leading={chosen ? <SourceMark source={sourceForCategory(chosen.category)} /> : undefined}
        onClick={() => onOpenChange(!open)}
        className="w-full shadow-by-field"
      >
        <span id="alert-metric-v" className="truncate">{metricName(value, options)}</span>
      </DropdownTrigger>
    </div>
  );
}

/**
 * @param {object|null} props.editing the rule being edited, or null for a new one
 * @param {object} props.initial the starting form
 * @param {object[]} props.options client metrics
 * @param {object[]} props.clients active clients
 * @param {object[]} props.tests creative tests
 * @param {string} props.email where "Also email me" sends
 * @param {(payload: object, id?: string) => Promise<boolean>} props.onSave
 * @param {() => void} props.onClose
 */
export function AlertDialog({ editing, initial, options, clients, tests, email, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const creative = form.scope === "creative_tests";
  const fixed = fixedCondition(form);
  const problems = formProblems(form);

  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(problems).length) return;
    setSaving(true);
    const ok = await onSave(alertPayload(form), editing?.id);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent size="xl" title={editing ? "Edit alert" : "New alert"} description={editing ? "Change what this alert watches and how it tells you." : "Pick a number to watch and Birdy tells you when it crosses the line."}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <Group title="About">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,0.8fr)]">
                  <TextField label="Name" placeholder="e.g. CPL over target" autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} error={tried ? problems.name : undefined} />
                  <TextField label="Description" placeholder="When this fires, and why it matters" value={form.description} onChange={(e) => set({ description: e.target.value })} />
                  <SelectField label="Type" value={form.type} onValueChange={(type) => set({ type })} options={asOptions(TYPE_OPTIONS)} />
                </div>
              </Group>

              <Group
                title="Condition"
                aside={(
                  <RadioGroup aria-label="What it watches" value={form.scope} onValueChange={(scope) => setForm((f) => withScope(f, scope))}>
                    <Radio value="clients" label="Clients" />
                    <Radio value="creative_tests" label="Creative tests" />
                  </RadioGroup>
                )}
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] [&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1">
                  {creative ? (
                    <SelectField label="Metric" value={form.metric} onValueChange={(m) => setForm((f) => withCreativeMetric(f, m))} options={asOptions(CREATIVE_METRIC_OPTIONS)} />
                  ) : (
                    <MetricField value={form.metric} options={options} open={picking} onOpenChange={setPicking} />
                  )}
                  {fixed ? (
                    <div className="lg:col-span-2">
                      <span className="mb-1.5 block text-by-body-sm font-medium">Fires</span>
                      <p className="flex min-h-10 items-center text-by-body-sm text-by-text-2">{fixed.hint}</p>
                    </div>
                  ) : (
                    <>
                      <SelectField label="When it" value={form.operator} onValueChange={(operator) => set({ operator })} options={asOptions(operatorOptions(form))} />
                      <TextField label="Value" type="number" inputMode="decimal" min="0" step="0.01" value={form.value} onChange={(e) => set({ value: e.target.value })} error={tried ? problems.value : undefined} />
                    </>
                  )}
                  <SelectField label="Over" value={form.period} onValueChange={(period) => set({ period })} options={asOptions(PERIOD_OPTIONS)} />
                </div>
                {picking && !creative && (
                  <MetricPicker metrics={options} onPick={(metric) => { set({ metric }); setPicking(false); }} onClose={() => setPicking(false)} />
                )}
              </Group>

              <Group
                title={creative ? "Creative tests" : "Clients"}
                aside={(
                  <RadioGroup aria-label="How it counts" value={form.tracking_mode} onValueChange={(tracking_mode) => set({ tracking_mode })}>
                    <Radio value="total" label="Total" />
                    <Radio value="per_client" label={perLabel(form.scope)} />
                  </RadioGroup>
                )}
              >
                <p className="-mt-1 text-by-caption text-by-muted">{trackingHelp(form)}</p>
                {creative ? (
                  <TestTargets tests={tests} value={form.creative_test_ids} onChange={(creative_test_ids) => set({ creative_test_ids })} />
                ) : (
                  <ClientTargets clients={clients} value={form.target_group_ids} onChange={(target_group_ids) => set({ target_group_ids })} />
                )}
              </Group>
            </div>

            <aside className="flex flex-col gap-4 rounded-by-lg bg-by-sunken p-4 lg:self-start">
              <div aria-live="polite">
                <div className="text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted">In short</div>
                <p className="mt-1 text-by-body-sm text-by-text">{formSentence(form, options)}</p>
              </div>
              <SelectField label="Check" value={form.frequency} onValueChange={(frequency) => set({ frequency })} options={asOptions(FREQUENCY_OPTIONS)} />
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-by-body-sm font-medium">Tell me</legend>
                <div className="flex items-center gap-2">
                  <Bell aria-hidden="true" className="size-4 shrink-0 text-by-muted" />
                  <Switch label="In Birdy" checked={form.notification_channels.includes("in_app")} onCheckedChange={(on) => set({ notification_channels: withChannel(form.notification_channels, "in_app", on) })} className="flex-1 flex-row-reverse justify-between text-by-body-sm" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Mail aria-hidden="true" className="size-4 shrink-0 text-by-muted" />
                    <Switch label="Also email me" checked={hasEmailChannel(form.notification_channels)} onCheckedChange={(on) => set({ notification_channels: withEmailChannel(form.notification_channels, on) })} className="flex-1 flex-row-reverse justify-between text-by-body-sm" />
                  </div>
                  <p className="mt-1 pl-6 text-by-caption text-by-muted">Sent to {email || "your account email"} each time it fires.</p>
                </div>
                <div className="flex items-center gap-2 opacity-60">
                  <MessageSquare aria-hidden="true" className="size-4 shrink-0 text-by-muted" />
                  <span className="flex-1 text-by-body-sm">Slack</span>
                  <Pill tone="neutral" dot={false}>Soon</Pill>
                </div>
              </fieldset>
            </aside>
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" kind="primary" loading={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create alert"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
