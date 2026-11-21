"use client";

// Create, edit or duplicate a custom metric: its name and description, the
// formula built from the metrics already tracked, where it shows, and how it
// reads. Saves with the same payload the old /metrics page sent.

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Button, Checkbox, Dialog, DialogBody, DialogContent, DialogFooter, Radio, RadioGroup, TextField, Tooltip, cn,
} from "@/components/by";
import {
  AGGREGATIONS, DASHBOARD_OPTIONS, FORMATS, OPERATORS, addOperand, canAddOperand, canAddOperator, dashboardDisabled, formatSample, formulaLevel, formulaProblem, formulaText,
  formulaWords, isEmpty, nameTaken, removePart, sampleResult,
} from "@/lib/formula-builder";
import { sourceForCategory } from "@/lib/metric-sources";
import { MetricPicker } from "./metric-picker";
import { SourceMark } from "./source-mark";

const HEAD = { new: "New formula", edit: "Edit formula", dup: "Duplicate formula" };
const SAVE = { new: "Save formula", edit: "Update formula", dup: "Save duplicate" };

/** A small labelled group of radio buttons. */
function Choice({ label, value, onChange, options }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-by-body-sm font-medium">{label}</legend>
      <RadioGroup value={value} onValueChange={onChange} aria-label={label}>
        {options.map((o) => <Radio key={o.value} value={o.value} label={o.label} />)}
      </RadioGroup>
    </fieldset>
  );
}

/** Adds a fixed number to the formula. */
function NumberInput({ onAdd, disabled }) {
  const [value, setValue] = useState("");
  const add = () => {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return;
    onAdd(n);
    setValue("");
  };
  return (
    <div className="flex items-center gap-1.5">
      <TextField
        aria-label="A number to add"
        type="number"
        inputMode="decimal"
        placeholder="e.g. 100"
        value={value}
        disabled={disabled}
        className="w-28"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
      <Button size="sm" disabled={disabled || value === ""} onClick={add}><Plus aria-hidden="true" />Add number</Button>
    </div>
  );
}

/**
 * @param {"new"|"edit"|"dup"} props.mode
 * @param {{name: string, description: string, dashboards: string[], formulaParts: object[], formatType: string, aggregation: string}} props.initial
 * @param {{id: string, label: string, category: string}[]} props.options what can go in the formula
 * @param {object[]} props.customs every custom metric, for the name check and the preview
 * @param {string} [props.editingId] the metric being edited; its own name is not "taken"
 * @param {(metric: object) => string|undefined} props.labelOf a metric id's label
 * @param {(payload: object) => Promise<boolean>} props.onSave
 * @param {() => void} props.onClose
 */
export function FormulaDialog({ mode, initial, options, customs, editingId, labelOf, onSave, onClose }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [parts, setParts] = useState(isEmpty(initial.formulaParts) ? [] : initial.formulaParts.map((p) => ({ ...p })));
  const [dashboards, setDashboards] = useState(initial.dashboards);
  const [formatType, setFormatType] = useState(initial.formatType);
  const [aggregation, setAggregation] = useState(initial.aggregation);
  const [picking, setPicking] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const clean = name.trim();
  const nameError = !clean ? "Give this formula a name." : nameTaken(clean, customs, editingId) ? `There’s already a metric called “${clean}”. Pick another name.` : null;
  const shapeError = formulaProblem(parts);
  const { mixed } = formulaLevel(parts);
  // A dashboard the formula can no longer show on is dropped from what is saved.
  const usable = dashboards.filter((d) => !dashboardDisabled(parts, d));
  const dashError = mixed ? "This formula mixes group-level and campaign-level metrics, which can’t be worked out together." : usable.length === 0 ? "Pick at least one dashboard." : null;
  const sample = useMemo(() => sampleResult(parts, customs), [parts, customs]);

  const addOp = (value) => setParts((p) => [...p, { type: "operator", value }]);
  const addMetric = (id) => {
    setParts((p) => addOperand(p, { type: "metric", value: id }));
    setPicking(false);
  };
  const addNumber = (n) => setParts((p) => addOperand(p, { type: "number", value: n, label: String(n) }));

  const save = async (e) => {
    e.preventDefault();
    setTried(true);
    if (nameError || shapeError || dashError) return;
    setSaving(true);
    const ok = await onSave({
      name: clean,
      description: description || "",
      formula_parts: parts,
      formula_display: formulaText(parts, labelOf),
      dashboards: usable,
      format_type: formatType || "integer",
      aggregation: aggregation || "total",
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent size="xl" title={HEAD[mode]} description="Build a metric from the ones you already track.">
        <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Name" placeholder="e.g. CPA" maxLength={60} autoFocus value={name} onChange={(e) => setName(e.target.value)} error={tried && nameError ? nameError : undefined} />
              <TextField label="Description" placeholder="What this metric measures" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div>
              <span id="fd-formula" className="mb-1.5 block text-by-body-sm font-medium">Formula</span>
              <div
                role="group"
                aria-labelledby="fd-formula"
                className={cn("flex min-h-12 flex-wrap items-center gap-1.5 rounded-by-md border bg-by-canvas px-2.5 py-2", tried && shapeError ? "border-by-danger-solid" : "border-by-line")}
              >
                {parts.length === 0 && <span className="px-1 text-by-body-sm text-by-muted">Nothing yet. Add a metric below.</span>}
                {parts.map((p, i) => {
                  if (p.type === "operator") {
                    const o = OPERATORS.find((x) => x.value === p.value);
                    return <span key={i} aria-label={o?.name ?? p.value} className="grid size-7 place-items-center rounded-full bg-by-sunken font-by-display text-by-body font-bold text-by-text-2">{o?.sign ?? p.value}</span>;
                  }
                  const label = p.type === "metric" ? labelOf(p.value) ?? p.value : String(p.label ?? p.value);
                  const option = p.type === "metric" ? options.find((m) => m.id === p.value) : null;
                  return (
                    <span key={i} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-by-md py-1 pr-1 pl-2 text-by-body-sm font-semibold", p.type === "number" ? "bg-by-warning-bg text-by-warning tabular-nums" : "border border-by-line bg-by-surface text-by-text")}>
                      {option && <SourceMark source={sourceForCategory(option.category)} />}
                      <span className="truncate">{label}</span>
                      <button type="button" aria-label={`Remove ${label}`} onClick={() => setParts((ps) => removePart(ps, i))} className="grid size-5 cursor-pointer place-items-center rounded-by-sm text-by-muted hover:bg-by-sunken hover:text-by-danger focus-visible:outline-2 focus-visible:outline-by-accent">
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button size="sm" aria-expanded={picking} disabled={!canAddOperand(parts)} onClick={() => setPicking((v) => !v)}><Plus aria-hidden="true" />Add metric</Button>
                <div role="group" aria-label="Operators" className="flex gap-1">
                  {OPERATORS.map((o) => (
                    <Tooltip key={o.value} label={canAddOperator(parts) ? o.name : "Add a metric or number first"}>
                      <span>
                        <Button size="sm" iconOnly aria-label={o.name} disabled={!canAddOperator(parts)} onClick={() => addOp(o.value)} className="font-by-display text-by-body-lg">{o.sign}</Button>
                      </span>
                    </Tooltip>
                  ))}
                </div>
                <NumberInput onAdd={addNumber} disabled={!canAddOperand(parts)} />
                {tried && shapeError && <span role="alert" className="text-by-caption font-medium text-by-danger">{shapeError}</span>}
              </div>
              {picking && (
                <div className="mt-2">
                  <MetricPicker metrics={options} onPick={addMetric} onClose={() => setPicking(false)} />
                </div>
              )}
            </div>

            <fieldset>
              <legend className="mb-1.5 text-by-body-sm font-medium">Show on dashboards</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {DASHBOARD_OPTIONS.map((d) => (
                  <Checkbox
                    key={d.value}
                    label={d.label}
                    checked={usable.includes(d.value)}
                    disabled={dashboardDisabled(parts, d.value)}
                    onCheckedChange={(c) => setDashboards((ds) => (c ? [...ds.filter((x) => x !== d.value), d.value] : ds.filter((x) => x !== d.value)))}
                  />
                ))}
              </div>
              {tried && dashError ? <p role="alert" className="mt-1.5 text-by-caption font-medium text-by-danger">{dashError}</p> : mixed && <p className="mt-1.5 text-by-caption font-medium text-by-danger">{dashError}</p>}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <Choice label="Format" value={formatType} onChange={setFormatType} options={FORMATS} />
              <Choice label="Aggregation" value={aggregation} onChange={setAggregation} options={AGGREGATIONS} />
              <div aria-live="polite" className="rounded-by-lg bg-by-sunken px-3.5 py-2.5">
                <div className="text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted">Sample preview</div>
                <div className="mt-0.5 font-by-display text-by-title font-bold tabular-nums">{formatSample(sample, formatType)}</div>
                <div className="truncate text-by-caption text-by-muted">{parts.length ? formulaWords(parts, labelOf) : "No formula yet"} · example figures</div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" kind="primary" loading={saving}>{saving ? "Saving…" : SAVE[mode]}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
