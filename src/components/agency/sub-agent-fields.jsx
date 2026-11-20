"use client";

// The fields of a sub-agent, shared by the proposal in the chat (one question
// at a time) and the Edit dialog on Context (all at once).

import { useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogBody, DialogContent, DialogFooter, Notice, OptionCard, TextArea, TextField, cn } from "@/components/by";
import { isActive } from "@/lib/client-status";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import {
  ALL_CLIENTS, DAYS, NAME_MAX, PARENT_NAMES, changeSubAgent, draftErrors, draftOf, localTimezone, patchOf, subAgentErrorMessage, toolOptions, useSubAgentTools,
} from "@/lib/sub-agents";
import { useClientGroups } from "@/lib/useClientGroups";

/**
 * The clients a sub-agent can be given: the active ones, plus any it already has that are not
 * active any more (so taking one away is still possible).
 * @param {object} record a normalized sub-agent
 */
export function useClientOptions(record) {
  const { clientGroups, loading } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const options = useMemo(() => {
    const list = (clientGroups ?? []).filter(isActive).map((g) => ({ id: g.id, name: g.name }));
    const known = new Set(list.map((c) => c.id));
    const extra = record?.clients === ALL_CLIENTS ? [] : (record?.clients ?? []).filter((c) => !known.has(c.id)).map((c) => ({ id: c.id, name: c.name || "A removed client" }));
    return [...list, ...extra].sort((a, b) => a.name.localeCompare(b.name));
  }, [clientGroups, record]);
  return { options, loading: Boolean(loading) && options.length === 0 };
}

export function NameField({ value, onChange, error, hint, autoFocus, id }) {
  return (
    <TextField
      id={id}
      label="Name"
      value={value}
      maxLength={NAME_MAX}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      help={hint}
    />
  );
}

export function JobFields({ purpose, instructions, onChange, errors = {}, hint, autoFocus }) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="What it does, in one line" value={purpose} autoFocus={autoFocus} onChange={(e) => onChange({ purpose: e.target.value })} error={errors.purpose} help={hint} />
      <TextArea label="How it does the job" rows={4} value={instructions} onChange={(e) => onChange({ instructions: e.target.value })} help="Written out for the sub-agent. It follows these every time it works." />
    </div>
  );
}

/**
 * The tools it may use: only the ones on offer, never more. A proposal offers the tools its main
 * agent picked; the Edit dialog offers every tool the main agent can hand out.
 * @param {{name: string, label: string}[]} props.tools
 */
export function ToolsChoice({ tools, value, onChange, error }) {
  const toggle = (name) => onChange(value.includes(name) ? value.filter((t) => t !== name) : [...value, name]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Tools</legend>
      {/* A long list goes in two columns, so the dialog stays short. */}
      <div className={cn("grid gap-2", tools.length > 4 && "sm:grid-cols-2")}>
        {tools.map((t) => (
          <OptionCard key={t.name} role="checkbox" selected={value.includes(t.name)} onSelect={() => toggle(t.name)} title={t.label} />
        ))}
      </div>
      {error && <p className="text-by-caption text-by-danger">{error}</p>}
    </fieldset>
  );
}

/**
 * All clients, or a chosen few.
 * @param {string} [props.pick] the proposing agent's own choice, said under it ("My pick: …")
 */
export function ClientsChoice({ value, onChange, options, loading, error, pick }) {
  const all = value === ALL_CLIENTS;
  const chosen = all ? [] : value;
  const toggle = (id) => onChange(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]);
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Clients" className="flex flex-col gap-2">
        <OptionCard selected={all} onSelect={() => onChange(ALL_CLIENTS)} title="All clients" subtitle={pick === "all" ? "My pick" : "Every client, including ones you add later"} />
        <OptionCard selected={!all} onSelect={() => all && onChange([])} title="Only clients I choose" subtitle={pick === "some" ? "My pick" : undefined} />
      </div>
      {!all && (
        <div className="max-h-56 overflow-y-auto overscroll-contain rounded-by-md border border-by-line bg-by-surface px-3 py-1.5">
          {loading ? (
            <p className="py-1.5 text-by-body-sm text-by-muted">Loading your clients…</p>
          ) : options.length === 0 ? (
            <p className="py-1.5 text-by-body-sm text-by-muted">No active clients to pick from.</p>
          ) : (
            <ul aria-label="Clients to cover" className="flex flex-col">
              {options.map((c) => (
                <li key={c.id} className="py-1.5"><Checkbox label={c.name} checked={chosen.includes(c.id)} onCheckedChange={() => toggle(c.id)} /></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-by-caption text-by-danger">{error}</p>}
    </div>
  );
}

/** Only when asked, or on a schedule: a time, the days, the time zone. */
export function ScheduleChoice({ value, onChange, error, pick, parentName = "Its main agent" }) {
  const on = Boolean(value);
  const days = value?.days ?? [];
  const toggleDay = (d) => onChange({ ...value, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="When it runs" className="flex flex-col gap-2">
        <OptionCard selected={!on} onSelect={() => onChange(null)} title="Only when asked" subtitle={pick === "asked" ? "My pick" : `${parentName} asks it during a chat`} />
        <OptionCard selected={on} onSelect={() => on || onChange({ time: "08:00", timezone: localTimezone(), days: DAYS.slice(0, 5).map(([k]) => k) })} title="On a schedule" subtitle={pick === "scheduled" ? "My pick" : undefined} />
      </div>
      {on && (
        <div className="flex flex-col gap-3 rounded-by-md bg-by-canvas px-3 py-3">
          <TextField type="time" label="Time" className="w-36" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} error={error} />
          <fieldset>
            <legend className="mb-1.5 text-by-body-sm font-medium text-by-text">Days</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(([key, label]) => {
                const pressed = days.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggleDay(key)}
                    className={cn(
                      "h-8 min-w-11 cursor-pointer rounded-by-md border px-2.5 text-by-body-sm font-semibold transition-colors duration-(--by-dur-fast) ease-by-out",
                      pressed ? "border-by-accent bg-by-accent-soft text-by-accent" : "border-by-line bg-by-surface text-by-text-2 hover:border-by-line-strong",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-by-caption text-by-muted">{days.length === 0 ? "No days picked: it runs every day." : `Times are ${value.timezone || "UTC"}.`}</p>
          </fieldset>
        </div>
      )}
    </div>
  );
}

/**
 * Edit a sub-agent on Context: every field at once, saved with one PATCH of what changed.
 * Tools it has can be taken away, and any tool its main agent can hand out
 * (GET /api/agents/sub/tools?parent=) can be added.
 *
 * @param {object} props.record a normalized sub-agent
 * @param {(saved: object) => void} props.onSaved
 */
export function SubAgentEditDialog({ record, open, onOpenChange, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && record && <EditForm record={record} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
    </Dialog>
  );
}

function EditForm({ record, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => draftOf(record));
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);
  const { options, loading } = useClientOptions(record);
  const { tools: available, unavailable: noToolList, isLoading: toolsLoading } = useSubAgentTools(record.parent);
  const tools = useMemo(() => toolOptions(record, available), [record, available]);
  const parentName = PARENT_NAMES[record.parent] ?? "Its main agent";
  const errors = shown ? draftErrors(draft) : {};
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setShown(true);
    if (Object.keys(draftErrors(draft)).length) return;
    const body = patchOf(record, draft);
    if (!Object.keys(body).length) return onClose();
    setSaving(true);
    setFailure(null);
    try {
      const saved = await changeSubAgent(record.id, body);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setFailure(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent title={`Edit ${record.name}`} description="Changes apply from its next run.">
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DialogBody className="flex flex-col gap-5">
          {failure && <Notice tone="danger">{subAgentErrorMessage(failure)}</Notice>}
          <NameField value={draft.name} onChange={(name) => set({ name })} error={errors.name ?? (failure?.code === "duplicate_name" ? "That name is taken." : undefined)} />
          <JobFields purpose={draft.purpose} instructions={draft.instructions} onChange={set} errors={errors} />
          <section aria-labelledby="sa-edit-tools">
            <h3 id="sa-edit-tools" className="text-by-body-sm font-medium">Tools</h3>
            <p className="mb-2 text-by-caption text-by-muted">
              {noToolList
                ? "Adding tools is not available yet. You can take tools away."
                : toolsLoading
                  ? `Loading the tools ${parentName} can hand out…`
                  : `Any tool ${parentName} has can be given to it. It works only in ${parentName}’s area.`}
            </p>
            <ToolsChoice tools={tools} value={draft.tools} onChange={(next) => set({ tools: next })} error={errors.tools} />
          </section>
          <section aria-labelledby="sa-edit-clients">
            <h3 id="sa-edit-clients" className="mb-1.5 text-by-body-sm font-medium">Clients</h3>
            <ClientsChoice value={draft.clients} onChange={(clients) => set({ clients })} options={options} loading={loading} error={errors.clients} />
          </section>
          <section aria-labelledby="sa-edit-schedule">
            <h3 id="sa-edit-schedule" className="mb-1.5 text-by-body-sm font-medium">When it runs</h3>
            <ScheduleChoice value={draft.schedule} onChange={(schedule) => set({ schedule })} error={errors.schedule} parentName={parentName} />
          </section>
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button kind="primary" type="submit" loading={saving}>Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
