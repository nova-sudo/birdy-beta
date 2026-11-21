"use client";

// Settings › Alerts' rows. A rule reads as a settings row: its name and
// status, what it watches and for whom, how close it is to firing, then its
// switch and a menu on the right. A per-client rule that fired folds its
// clients under it, each with its own snooze and clear.

import { useState } from "react";
import { BellOff, ChevronRight, Ellipsis, Pencil, RefreshCw, Trash2, Zap } from "lucide-react";
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Pill, Switch, cn } from "@/components/by";
import { formatRelative } from "@/lib/alert-helpers";
import { conditionLine, formatFigure, isOn, progressOf, statusOf, targetsLine } from "@/lib/alert-rules";

const BAR = { danger: "bg-by-danger-solid", warning: "bg-by-warning-solid", accent: "bg-by-accent" };

/** How close a rule (or one client) is to firing. */
function Progress({ alert }) {
  const p = progressOf(alert);
  if (!p) return <span className="text-by-caption text-by-muted">Not checked yet</span>;
  return (
    <div className="w-full min-w-0 sm:w-40">
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-by-body-sm font-semibold">{p.current}</span>
        <span className="truncate text-by-caption text-by-muted">{p.threshold}</span>
      </div>
      <div role="meter" aria-label="Progress to firing" aria-valuenow={Math.round(p.pct)} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1.5 overflow-hidden rounded-full bg-by-sunken">
        <div className={cn("h-full rounded-full", BAR[p.tone])} style={{ width: `${p.pct}%` }} />
      </div>
      <div className="mt-1 truncate text-by-caption text-by-muted">{p.line}</div>
    </div>
  );
}

/** When a rule last changed, and when it last fired. */
function When({ alert }) {
  const bits = [];
  if (alert.last_triggered_at) bits.push(`Fired ${formatRelative(new Date(alert.last_triggered_at))}`);
  if (alert.status === "paused" && alert.snoozed_until) bits.push(`Snoozed until ${formatRelative(new Date(alert.snoozed_until))}`);
  if (alert.updated_at) bits.push(`Updated ${formatRelative(new Date(alert.updated_at))}`);
  return bits.length ? <span>{bits.join(" · ")}</span> : null;
}

function RowMenu({ label, children }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button kind="ghost" size="sm" iconOnly aria-label={label}><Ellipsis aria-hidden="true" /></Button>
      </MenuTrigger>
      <MenuContent align="end">{children}</MenuContent>
    </Menu>
  );
}

function EvaluateItem({ alert, evaluating, onEvaluate }) {
  const mine = evaluating === (alert._virtual_id ?? alert.id);
  return (
    <MenuItem disabled={!!evaluating} onSelect={() => onEvaluate(alert)}>
      {mine ? <RefreshCw aria-hidden="true" className="motion-safe:animate-spin" /> : <Zap aria-hidden="true" />}
      Check now
    </MenuItem>
  );
}

/**
 * One rule.
 * @param {object} props.alert a rule from GET /api/alerts
 * @param {object[]} props.options the metric list, for names
 * @param {Record<string, string>} props.testCodes creative test id → code
 * @param {React.ReactNode} [props.lead] sits before the name, e.g. the fold button
 * @param {React.ReactNode} [props.aside] extra words after the status pill
 */
export function RuleRow({ alert, options, testCodes, evaluating, switching, onToggle, onEdit, onEvaluate, onSnooze, onDelete, lead, aside, showSwitch = true }) {
  const status = statusOf(alert);
  return (
    <li className="flex flex-col gap-3 border-b border-by-line-soft px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 gap-2">
        {lead}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="min-w-0 truncate text-by-body font-semibold">{alert.name}</h4>
            <Pill tone={status.tone}>{status.label}</Pill>
            {alert.type === "win" && <Pill tone="accent" dot={false}>Win</Pill>}
            {aside}
          </div>
          {alert.description && <p className="mt-0.5 truncate text-by-body-sm text-by-text-2">{alert.description}</p>}
          <p className="mt-1 text-by-body-sm font-medium tabular-nums">{conditionLine(alert, options)}</p>
          <p className="mt-0.5 truncate text-by-caption text-by-muted">
            {targetsLine(alert, testCodes)}
            {(alert.last_triggered_at || alert.updated_at) && <> · <When alert={alert} /></>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1 sm:flex-none"><Progress alert={alert} /></div>
        {showSwitch && (
          <Switch aria-label={isOn(alert) ? `Pause ${alert.name}` : `Turn on ${alert.name}`} checked={isOn(alert)} disabled={switching} onCheckedChange={() => onToggle(alert)} />
        )}
        <RowMenu label={`Actions for ${alert.name}`}>
          <MenuItem onSelect={() => onEdit(alert)}><Pencil aria-hidden="true" />Edit</MenuItem>
          <EvaluateItem alert={alert} evaluating={evaluating} onEvaluate={onEvaluate} />
          <MenuItem onSelect={() => onSnooze(alert)}><BellOff aria-hidden="true" />{lead ? "Snooze all" : "Snooze"}</MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => onDelete(alert)} className="text-by-danger data-[highlighted]:bg-by-danger-bg"><Trash2 aria-hidden="true" />Delete</MenuItem>
        </RowMenu>
      </div>
    </li>
  );
}

/** One client under a per-client rule that fired. */
function ClientRow({ row, evaluating, onEvaluate, onSnooze, onClear }) {
  const c = row.condition ?? {};
  return (
    <li className="flex items-center gap-3 border-t border-by-line-soft py-2.5 pr-4 pl-11 sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-by-body-sm font-semibold">{row._client_name}</div>
      </div>
      {row._client_value != null && <span className="shrink-0 text-by-body-sm font-semibold text-by-danger tabular-nums">Now {formatFigure(row._client_value, c.metric, c.operator)}</span>}
      <RowMenu label={`Actions for ${row._client_name}`}>
        <EvaluateItem alert={row} evaluating={evaluating} onEvaluate={onEvaluate} />
        <MenuItem onSelect={() => onSnooze(row)}><BellOff aria-hidden="true" />Snooze this client</MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => onClear(row)} className="text-by-danger data-[highlighted]:bg-by-danger-bg"><Trash2 aria-hidden="true" />Clear this entry</MenuItem>
      </RowMenu>
    </li>
  );
}

/** A per-client rule that fired, with its clients folded under it. */
export function FiredGroup({ group, onClear, ...rowProps }) {
  const [open, setOpen] = useState(false);
  const n = group.clients.length;
  const listId = `fired-${group.alert.id}`;
  return (
    <>
      <RuleRow
        {...rowProps}
        alert={group.alert}
        lead={(
          <Button kind="ghost" size="sm" iconOnly aria-expanded={open} aria-controls={listId} aria-label={open ? `Hide the ${n} clients` : `Show the ${n} clients`} onClick={() => setOpen((v) => !v)} className="-ml-1.5 shrink-0">
            <ChevronRight aria-hidden="true" className={cn("transition-transform duration-(--by-dur-fast)", open && "rotate-90")} />
          </Button>
        )}
        aside={<span className="text-by-caption font-semibold text-by-danger">{n} client{n === 1 ? "" : "s"}</span>}
      />
      {open && (
        <li className="border-b border-by-line-soft bg-by-canvas last:border-b-0">
          <ul id={listId} aria-label={`Clients ${group.alert.name} fired for`}>
            {group.clients.map((row) => (
              <ClientRow key={row._virtual_id ?? `${row.id}_${row._client_id}`} row={row} evaluating={rowProps.evaluating} onEvaluate={rowProps.onEvaluate} onSnooze={rowProps.onSnooze} onClear={onClear} />
            ))}
          </ul>
        </li>
      )}
    </>
  );
}
