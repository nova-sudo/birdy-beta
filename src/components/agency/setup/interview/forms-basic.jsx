"use client";

import { useMemo, useState } from "react";
import getSymbolFromCurrency from "currency-symbol-map";
import { Checkbox, NativeSelectField, Radio, RadioGroup, Segmented, Switch, TextField, cn } from "@/components/by";
import {
  ALL, PERMISSIONS, SPEED_CHOICES, clientsBody, clientsInitial, cplBody, cplInitial, permissionsBody, permissionsInitial,
  scheduleBody, scheduleInitial, TIME_RE, speedBody, zonesWith,
} from "@/lib/team-setup-forms";
import { FormShell, useSave } from "./form-shell";

const LIST = "max-h-60 overflow-y-auto overscroll-contain rounded-by-md border border-by-line bg-by-surface";
const symbolOf = (code) => getSymbolFromCurrency(code || "GBP") || code || "£";
const decimal = (v) => v.replace(/[^\d.]/g, "");

/** Which clients the agent works on: all of them, or the ones picked. */
export function ClientsForm({ initial, data, ctx, onSubmit, saveLabel }) {
  const start = clientsInitial(initial);
  const [mode, setMode] = useState(start.mode);
  const [ids, setIds] = useState(start.ids);
  const { busy, error, setError, run } = useSave(onSubmit);
  // The reply lists the account's clients (`options`); without it, the active ones the app already has.
  const clients = Array.isArray(data?.options) ? data.options.filter((o) => o?.id).map((o) => ({ id: o.id, name: o.name || o.id })) : ctx.clients;
  const save = () => {
    const body = clientsBody(mode, ids);
    if (!body) return setError("Pick at least one client.");
    run(body);
  };
  const toggle = (id, on) => setIds((list) => (on ? [...list, id] : list.filter((x) => x !== id)));
  return (
    <FormShell label="Clients" error={error} busy={busy} onSave={save} saveLabel={saveLabel}>
      <RadioGroup value={mode} onValueChange={setMode} aria-label="Which clients" className="flex-col gap-2">
        <Radio value={ALL} label={Array.isArray(data?.options) ? `All clients${clients.length ? ` (${clients.length})` : ""}` : `All active clients${clients.length ? ` (${clients.length})` : ""}`} />
        <Radio value="some" label="Only some of them" />
      </RadioGroup>
      {mode === "some" && (
        clients.length ? (
          <ul className={LIST} aria-label="Clients to watch">
            {clients.map((g) => (
              <li key={g.id} className="border-t border-by-line-soft px-3 py-2 first:border-t-0">
                <Checkbox label={g.name} checked={ids.includes(g.id)} onCheckedChange={(on) => toggle(g.id, on === true)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-by-body-sm text-by-muted">{ctx.clientsLoading ? "Loading your clients…" : "You have no active clients yet."}</p>
        )
      )}
    </FormShell>
  );
}

/** Cost-per-lead limits: one for every client, or one each. */
export function CplForm({ initial, data, ctx, onSubmit, saveLabel }) {
  const start = cplInitial(initial);
  const [mode, setMode] = useState(start.mode);
  const [all, setAll] = useState(start.all);
  const [each, setEach] = useState(start.each);
  const { busy, error, setError, run } = useSave(onSubmit);
  const sym = symbolOf(data?.currency || ctx.currency);
  // The reply lists the clients Media Buyer watches with their currency and current CPL target.
  const watched = Array.isArray(data?.clients)
    ? data.clients.filter((c) => c?.id).map((c) => ({ id: c.id, name: c.name || c.id, ad_account_currency: c.currency, target: c.target }))
    : ctx.watched;
  const save = () => {
    const out = cplBody(mode, all, each);
    if (out.error) return setError(out.error);
    run(out.body);
  };
  return (
    <FormShell label="Cost per lead limits" error={error} busy={busy} onSave={save} saveLabel={saveLabel}>
      <Segmented
        aria-label="One limit or one per client"
        items={[{ value: "one", label: "One limit for all" }, { value: "each", label: "One per client" }]}
        value={mode}
        onValueChange={setMode}
        className="self-start"
      />
      {mode === "one" ? (
        <TextField
          label="Cost per lead limit"
          inputMode="decimal"
          value={all}
          onChange={(e) => setAll(decimal(e.target.value))}
          leading={<span aria-hidden="true" className="text-by-muted">{sym}</span>}
          help="I flag any client whose leads cost more than this."
          className="max-w-56"
        />
      ) : watched.length ? (
        <ul className={LIST} aria-label="Limits per client">
          {watched.map((g) => (
            <li key={g.id} className="flex items-center gap-3 border-t border-by-line-soft px-3 py-2 first:border-t-0">
              <span className="min-w-0 flex-1 truncate text-by-body">{g.name}</span>
              <TextField
                aria-label={`${g.name}’s cost per lead limit`}
                inputMode="decimal"
                value={each[g.id] ?? ""}
                placeholder={g.target != null ? String(g.target) : undefined}
                onChange={(e) => setEach({ ...each, [g.id]: decimal(e.target.value) })}
                leading={<span aria-hidden="true" className="text-by-muted">{symbolOf(g.ad_account_currency || ctx.currency)}</span>}
                className="w-32 shrink-0"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-by-body-sm text-by-muted">{ctx.clientsLoading ? "Loading your clients…" : "There are no clients to set limits for yet."}</p>
      )}
    </FormShell>
  );
}

/** Something the agent offers: shown beside the form, applied only when the owner presses it. */
function Suggestion({ onUse, children }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-by-body-sm text-by-muted">
      <span>Suggestion: {children}</span>
      <button type="button" onClick={onUse} className="cursor-pointer font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">Use it</button>
    </p>
  );
}

/** What it may change in Meta without asking. Budgets are never on the list. */
export function PermissionsForm({ initial, data, onSubmit, saveLabel }) {
  // A suggestion is offered, never pre-set: everything starts off until the owner chooses.
  const [state, setState] = useState(() => permissionsInitial(initial));
  const { busy, error, run } = useSave(onSubmit);
  const suggested = !initial && data?.suggestion && PERMISSIONS.some((p) => data.suggestion[p.key]) ? permissionsInitial(data.suggestion) : null;
  return (
    <FormShell label="Permissions" error={error} busy={busy} onSave={() => run(permissionsBody(state))} saveLabel={saveLabel}>
      <p className="text-by-body-sm text-by-text-2">Switched off, I ask you first. I never change budgets.</p>
      {suggested && (
        <Suggestion onUse={() => setState(suggested)}>
          {PERMISSIONS.filter((p) => suggested[p.key]).map((p) => p.label.toLowerCase()).join(", ")}
        </Suggestion>
      )}
      <ul className="flex flex-col gap-2.5">
        {PERMISSIONS.map((p) => (
          <li key={p.key}>
            <Switch label={p.label} checked={state[p.key]} onCheckedChange={(on) => setState({ ...state, [p.key]: on })} />
          </li>
        ))}
      </ul>
    </FormShell>
  );
}

/** When it runs: a time, a time zone, every day or weekdays. */
export function ScheduleForm({ initial, data, onSubmit, saveLabel }) {
  // Nothing saved yet: the time is left empty (a suggestion is offered, never pre-set); the time
  // zone is the owner's own, which is a fact about the account.
  const [state, setState] = useState(() => (initial ? scheduleInitial(initial) : { ...scheduleInitial({ tz: data?.default?.tz }), time: "" }));
  const suggested = !initial && TIME_RE.test(data?.default?.time ?? "") ? scheduleInitial(data.default) : null;
  const { busy, error, setError, run } = useSave(onSubmit);
  const zones = useMemo(() => zonesWith(state.tz).map((z) => ({ value: z, label: z.replace(/_/g, " ") })), [state.tz]);
  const save = () => {
    const out = scheduleBody(state);
    if (out.error) return setError(out.error);
    run(out.body);
  };
  return (
    <FormShell label="Schedule" error={error} busy={busy} onSave={save} saveLabel={saveLabel}>
      {suggested && (
        <Suggestion onUse={() => setState(suggested)}>
          {suggested.time}, {suggested.days === "weekdays" ? "weekdays only" : "every day"}
        </Suggestion>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Time" type="time" value={state.time} onChange={(e) => setState({ ...state, time: e.target.value })} className="w-36" />
        <NativeSelectField label="Time zone" options={zones} value={state.tz} onChange={(e) => setState({ ...state, tz: e.target.value })} className="min-w-0 flex-1 basis-48" />
      </div>
      <Segmented
        aria-label="Which days"
        items={[{ value: "daily", label: "Every day" }, { value: "weekdays", label: "Weekdays only" }]}
        value={state.days}
        onValueChange={(days) => setState({ ...state, days })}
        className="self-start"
      />
    </FormShell>
  );
}

/** Speed to lead: how long a new lead may wait for a first call. */
export function SpeedForm({ initial, onSubmit, saveLabel }) {
  const [minutes, setMinutes] = useState(initial?.minutes != null ? String(initial.minutes) : "");
  const { busy, error, setError, run } = useSave(onSubmit);
  const save = () => {
    const out = speedBody(minutes);
    if (out.error) return setError(out.error);
    run(out.body);
  };
  return (
    <FormShell label="Speed to lead" error={error} busy={busy} onSave={save} saveLabel={saveLabel}>
      <div role="group" aria-label="Common answers" className="flex flex-wrap gap-2">
        {SPEED_CHOICES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={minutes === String(n)}
            onClick={() => setMinutes(String(n))}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center rounded-by-md border px-3 font-by-body text-by-body-sm font-medium transition-colors duration-(--by-dur-fast) ease-by-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent",
              minutes === String(n) ? "border-by-accent bg-by-accent-soft text-by-accent" : "border-by-line-strong bg-by-surface text-by-text hover:bg-by-canvas",
            )}
          >
            {n < 60 ? `${n} minutes` : "1 hour"}
          </button>
        ))}
      </div>
      <TextField label="Minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} className="w-32" />
    </FormShell>
  );
}
