"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  Ellipsis,
  Pencil,
  Trash2,
  Play,
  Pause,
  BellRing,
  RefreshCw,
  BellOff,
  Zap,
  User,
  Layers,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Stagger, StaggerItem } from "@/components/motion"
import {
  METRIC_OPTIONS,
  statusBadge, formatRelative, conditionSummary, ProgressToTrigger, metricIcon
} from "@/lib/alert-helpers"
import { GroupHeaderRow, SubAlertRow, groupTriggeredRows } from "./AlertDetail"

// ── Regular (non-grouped) alert row ──────────────────────────────────────────

function AlertRow({ alert, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete }) {
  const isVirtual = !!alert._virtual
  const isEval    = evaluating === (alert._virtual_id ?? alert.id)

  return (
    <StaggerItem as="tr" className={`border-b border-pd-row-border transition-colors hover:bg-pd-table-head h-14 ${isVirtual ? "bg-pd-primary-tint/40" : "bg-pd-surface"}`}>
      <td className={`py-3 px-4 align-middle min-w-[180px] ${alert.status === "triggered" ? "shadow-[inset_3px_0_0_var(--pd-danger)]" : ""}`}>
        <div>
          <div className="font-semibold text-pd-ink">{alert.name}</div>
          {alert.description && (
            <div className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate">{alert.description}</div>
          )}
        </div>
      </td>
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{metricIcon(alert.condition?.metric)}</span>
          <span>{METRIC_OPTIONS.find(m => m.value === alert.condition?.metric)?.label || alert.condition?.metric}</span>
        </div>
      </td>
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="text-sm font-semibold tabular-nums text-pd-ink">{conditionSummary(alert)}</div>
        {alert.condition?.period && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {["pct_drop", "pct_rise"].includes(alert.condition?.operator) ? "vs " : "window: "}
            {alert.condition.period}
          </div>
        )}
      </td>
      <td className="py-3 px-4 align-middle"><ProgressToTrigger alert={alert} /></td>
      <td className="py-3 px-4 align-middle min-w-[120px]">{statusBadge(alert.status, alert.snoozed_until)}</td>
      <td className="py-3 px-4 align-middle min-w-[140px]">
        {alert.target_group_ids?.length ? (
          <div className="flex flex-col gap-0.5 max-w-[180px]">
            <div className="flex items-center gap-1.5 mb-0.5">
              {alert.tracking_mode === "per_client" ? (
                <Badge className="text-[10.5px] px-2 py-0 gap-1">
                  <User className="h-2.5 w-2.5" /> Per Client
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10.5px] px-2 py-0 gap-1">
                  <Layers className="h-2.5 w-2.5" /> Total
                </Badge>
              )}
            </div>
            {(alert.target_group_names?.length ? alert.target_group_names : alert.target_group_ids)
              .slice(0, 2).map((name, i) => <span key={i} className="text-sm truncate">{name}</span>)}
            {alert.target_group_ids.length > 2 && (
              <span className="text-xs text-muted-foreground">+{alert.target_group_ids.length - 2} more</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <Badge variant="secondary" className="text-[10.5px] px-2 py-0 gap-1 w-fit">
              <Layers className="h-2.5 w-2.5" /> Total
            </Badge>
            <span className="text-sm text-muted-foreground">Global (All)</span>
          </div>
        )}
      </td>
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="text-sm text-pd-subtle">{formatRelative(new Date(alert.updated_at))}</div>
        {alert.last_triggered_at && (
          <div className="text-xs text-pd-danger mt-0.5 flex items-center gap-1">
            <BellRing className="h-3 w-3" />
            {formatRelative(new Date(alert.last_triggered_at))}
          </div>
        )}
      </td>
      <td className="py-3 px-4 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Alert actions"><Ellipsis className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(alert)} className="gap-2 cursor-pointer">
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEvaluate(alert)} disabled={!!evaluating} className="gap-2 cursor-pointer">
              {isEval ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Evaluate now
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTogglePause(alert)} className="gap-2 cursor-pointer">
              {alert.status === "paused" ? <><Play className="h-4 w-4" /> Activate</> : <><Pause className="h-4 w-4" /> Pause</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(alert)} className="gap-2 cursor-pointer">
              <BellOff className="h-4 w-4" /> Snooze
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(alert)}
              className="gap-2 cursor-pointer text-pd-danger focus:bg-pd-danger-bg focus:text-pd-danger"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </StaggerItem>
  )
}

const EMPTY_HINTS = {
  active: "Create an alert and Birdy will keep an eye on the numbers for you.",
  triggered: "Nothing has crossed a threshold.",
  paused: "Alerts you snooze or pause wait here.",
}

function EmptyState({ label }) {
  return (
    <tr>
      <td colSpan={8} className="py-16">
        <div className="mx-auto flex max-w-xs flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-pd-primary-tint text-pd-primary">
            <Bell className="size-5" />
          </span>
          <p className="font-pd-display text-[15px] font-semibold text-pd-ink">No {label} alerts</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-pd-subtle">{EMPTY_HINTS[label]}</p>
        </div>
      </td>
    </tr>
  )
}

// ── Table chrome shared by every tab ──────────────────────────────────────────

const ALERT_COLUMNS = ["Alert Name", "Metric", "Condition", "Progress", "Status", "Targets", "Last Updated", "Actions"]

function AlertTableShell({ children }) {
  return (
    <div className="relative w-full overflow-auto rounded-xl border border-pd-border bg-pd-surface shadow-sm">
      <table className="w-full caption-bottom text-[13.5px]">
        <thead className="sticky top-0 z-20">
          <tr className="h-11 border-b border-pd-divider">
            {ALERT_COLUMNS.map(h => (
              <th key={h} className="h-11 bg-pd-table-head px-4 text-left align-middle text-[11.5px] font-bold uppercase tracking-[.04em] text-pd-faint">{h}</th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  )
}

/** Shown while alerts load: the table's own shape, so nothing jumps when rows land. */
export function AlertTableSkeleton() {
  return (
    <AlertTableShell>
      <tbody>
        {Array.from({ length: 6 }, (_, i) => (
          <tr key={i} className="h-14 border-b border-pd-row-border last:border-0">
            <td className="px-4"><Skeleton className="h-3.5 w-36" /><Skeleton className="mt-2 h-2.5 w-24" /></td>
            <td className="px-4"><Skeleton className="h-3.5 w-20" /></td>
            <td className="px-4"><Skeleton className="h-3.5 w-16" /></td>
            <td className="px-4"><Skeleton className="h-2 w-32 rounded-full" /></td>
            <td className="px-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
            <td className="px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
            <td className="px-4"><Skeleton className="h-3 w-16" /></td>
            <td className="px-4"><Skeleton className="size-8 rounded-full" /></td>
          </tr>
        ))}
      </tbody>
    </AlertTableShell>
  )
}

// ── Standard alert table (active / paused tabs) ───────────────────────────────

export function AlertTable({ rows, emptyLabel, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete }) {
  return (
    <AlertTableShell>
        <Stagger as="tbody" gap={0.05} className="[&_tr:last-child]:border-0">
          {rows.length === 0
            ? <EmptyState label={emptyLabel} />
            : rows.map(a => (
                <AlertRow
                  key={a._virtual_id ?? a.id}
                  alert={a}
                  evaluating={evaluating}
                  onEdit={onEdit}
                  onEvaluate={onEvaluate}
                  onTogglePause={onTogglePause}
                  onSnooze={onSnooze}
                  onDelete={onDelete}
                />
              ))
          }
        </Stagger>
    </AlertTableShell>
  )
}

// ── Triggered table — grouped by parent alert ─────────────────────────────────

export function TriggeredTable({ rows, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete, onDeleteSub }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const groups = useMemo(() => groupTriggeredRows(rows), [rows])

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <AlertTableShell>
        <tbody><EmptyState label="triggered" /></tbody>
      </AlertTableShell>
    )
  }

  return (
    <AlertTableShell>
        <Stagger as="tbody" gap={0.05} className="[&_tr:last-child]:border-0">
          {groups.map(group => {
            const groupKey = group.children.length > 0
              ? `group_${group.parentAlert.id}`
              : `real_${group.parentAlert.id}`
            const isExpanded = expandedGroups.has(groupKey)
            const hasChildren = group.children.length > 0

            if (!hasChildren) {
              return (
                <AlertRow
                  key={groupKey}
                  alert={group.parentAlert}
                  evaluating={evaluating}
                  onEdit={onEdit}
                  onEvaluate={onEvaluate}
                  onTogglePause={onTogglePause}
                  onSnooze={onSnooze}
                  onDelete={onDelete}
                />
              )
            }

            return [
              <GroupHeaderRow
                key={groupKey}
                group={group}
                isExpanded={isExpanded}
                onToggle={() => toggleGroup(groupKey)}
                onEdit={onEdit}
                onSnooze={onSnooze}
                onEvaluate={onEvaluate}
                evaluating={evaluating}
                onDelete={onDelete}
              />,
              ...(isExpanded
                ? group.children.map(child => (
                    <SubAlertRow
                      key={child._virtual_id ?? `${child.id}_${child._client_id}`}
                      row={child}
                      evaluating={evaluating}
                      onEvaluate={onEvaluate}
                      onSnooze={onSnooze}
                      onDelete={onDeleteSub}
                    />
                  ))
                : []
              ),
            ]
          })}
        </Stagger>
    </AlertTableShell>
  )
}

