"use client"

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useSearchParams } from "next/navigation"
import { usePageHeader } from "@/components/page-header"
import { pdFontClass } from "@/lib/fonts"
import { PageTabs } from "@/components/portfolio"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  Bell,
  Sparkles,
  CirclePlus,
  Ellipsis,
  Pencil,
  Trash2,
  Play,
  Pause,
  BellRing,
  RefreshCw,
  BellOff,
  Zap,
  Target,
  Users,
  Clock,
  Mail,
  Slack,
  Layers,
  User,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import { Stagger, StaggerItem, EASE_OUT } from "@/components/motion"
import Image from "next/image"
import { ghlIcon } from "@/lib/icons"
import { apiRequest } from "@/lib/api"
import MetricPicker from "@/components/ui/MetricPicker"
import { buildMetricPickerOptions } from "@/lib/metric-picker-options"
import {
  METRIC_OPTIONS, OPERATOR_OPTIONS, PERIOD_OPTIONS, SNOOZE_OPTIONS, EMPTY_FORM,
  TYPE_OPTIONS, FREQUENCY_OPTIONS,
  statusBadge, formatRelative, conditionSummary, ProgressToTrigger, metricIcon
} from "@/lib/alert-helpers"
import ChatConversation from "@/components/chat/ChatConversation"
import { activeGroups } from "@/lib/client-status"

// ── Tracking mode toggle ──────────────────────────────────────────────────────

function TrackingModeToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-muted w-fit">
      <button
        type="button"
        onClick={() => onChange("total")}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          value === "total"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Layers className="h-3.5 w-3.5" />
        Total
      </button>
      <button
        type="button"
        onClick={() => onChange("per_client")}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          value === "per_client"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <User className="h-3.5 w-3.5" />
        Per Client
      </button>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ClientProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct ?? 0))
  const color =
    clamped >= 100 ? "bg-pd-danger" :
    clamped >= 75  ? "bg-pd-warning" :
    "bg-pd-primary"
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 rounded-full bg-pd-divider overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
        />
      </div>
      <span className="text-xs tabular-nums text-pd-subtle w-8 text-right">{clamped.toFixed(0)}%</span>
    </div>
  )
}

// ── Group triggered rows by parent alert ──────────────────────────────────────

function groupTriggeredRows(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!row._virtual) {
      const key = `real_${row.id}`
      map.set(key, { parentAlert: row, children: [] })
      continue
    }
    const key = String(row.id)
    if (!map.has(key)) {
      map.set(key, {
        parentAlert: {
          id: row.id,
          name: row.name,
          description: row.description,
          condition: row.condition,
          tracking_mode: row.tracking_mode,
          target_group_ids: row.target_group_ids,
          target_group_names: row.target_group_names,
          updated_at: row.updated_at,
          last_triggered_at: row.last_triggered_at,
          status: "triggered",
          _isGroup: true,
        },
        children: [],
      })
    }
    map.get(key).children.push(row)
  }
  return [...map.values()]
}

// ── Sub-alert row (client inside an expanded group) ───────────────────────────

function SubAlertRow({ row, onSnooze, onDelete, evaluating, onEvaluate }) {
  const isEval = evaluating === row._virtual_id
  return (
    <StaggerItem as="tr" className="border-b border-pd-row-border bg-pd-primary-tint/40 hover:bg-pd-primary-tint/70 transition-colors h-14">
      {/* Name — indented */}
      <td className="py-3 px-4 align-middle min-w-[180px]">
        <div className="flex items-start gap-2 pl-8">
          <div className="w-0.5 self-stretch rounded-full bg-pd-primary-pale shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-pd-primary shrink-0" />
              <span className="font-semibold text-sm text-pd-ink">{row._client_name}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Metric */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{metricIcon(row.condition?.metric)}</span>
          <span>{METRIC_OPTIONS.find(m => m.value === row.condition?.metric)?.label || row.condition?.metric}</span>
        </div>
      </td>

      {/* Condition + actual */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="text-sm font-semibold tabular-nums text-pd-ink">{conditionSummary(row)}</div>
        {row._client_value != null && (
          <div className="text-xs text-pd-danger tabular-nums mt-0.5">actual: {row._client_value?.toFixed(2)}</div>
        )}
      </td>

      {/* Progress */}
      <td className="py-3 px-4 align-middle">
        <ClientProgressBar pct={row._client_progress} />
      </td>

      {/* Status */}
      <td className="py-3 px-4 align-middle">
        <Badge variant="destructive" className="gap-1 text-xs">
          <BellRing className="h-3 w-3" /> Triggered
        </Badge>
      </td>

      {/* Targets */}
      <td className="py-3 px-4 align-middle">
        <Badge className="text-[10.5px] px-2 py-0 gap-1">
          <User className="h-2.5 w-2.5" /> Per Client
        </Badge>
      </td>

      {/* Last updated */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="text-sm text-pd-subtle">{formatRelative(new Date(row.updated_at))}</div>
        {row.last_triggered_at && (
          <div className="text-xs text-pd-danger mt-0.5 flex items-center gap-1">
            <BellRing className="h-3 w-3" />
            {formatRelative(new Date(row.last_triggered_at))}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Alert actions">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => onEvaluate(row)}
              disabled={!!evaluating}
              className="gap-2 cursor-pointer"
            >
              {isEval ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Evaluate now
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSnooze(row)} className="gap-2 cursor-pointer">
              <BellOff className="h-4 w-4" /> Snooze Client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(row)}
              className="gap-2 cursor-pointer text-pd-danger focus:bg-pd-danger-bg focus:text-pd-danger"
            >
              <Trash2 className="h-4 w-4" /> Delete Entry
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </StaggerItem>
  )
}

// ── Group header row ──────────────────────────────────────────────────────────

function GroupHeaderRow({ group, isExpanded, onToggle, onEdit, onSnooze, onEvaluate, evaluating, onDelete }) {
  const { parentAlert, children } = group
  const isEval = evaluating === parentAlert.id
  const childCount = children.length

  return (
    <StaggerItem
      as="tr"
      className="border-b border-pd-row-border bg-pd-surface hover:bg-pd-table-head transition-colors h-14 cursor-pointer"
      onClick={onToggle}
    >
      {/* Name */}
      <td className="py-3 px-4 align-middle min-w-[180px] shadow-[inset_3px_0_0_var(--pd-danger)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            onClick={e => { e.stopPropagation(); onToggle() }}
          >
            {isExpanded
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </button>
          <div>
            <div className="font-semibold text-pd-ink flex items-center gap-2">
              {parentAlert.name}
              <Badge className="bg-pd-danger-bg text-pd-danger border-0 text-[10.5px] px-2 py-0 gap-1">
                <BellRing className="h-2.5 w-2.5" />
                {childCount} client{childCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            {parentAlert.description && (
              <div className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate">
                {parentAlert.description}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Metric */}
      <td className="py-3 px-4 align-middle whitespace-nowrap" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{metricIcon(parentAlert.condition?.metric)}</span>
          <span>{METRIC_OPTIONS.find(m => m.value === parentAlert.condition?.metric)?.label || parentAlert.condition?.metric}</span>
        </div>
      </td>

      {/* Condition */}
      <td className="py-3 px-4 align-middle whitespace-nowrap" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold tabular-nums text-pd-ink">{conditionSummary(parentAlert)}</div>
        {parentAlert.condition?.period && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {["pct_drop", "pct_rise"].includes(parentAlert.condition?.operator) ? "vs " : "window: "}
            {parentAlert.condition.period}
          </div>
        )}
      </td>

      {/* Progress — show worst client */}
      <td className="py-3 px-4 align-middle" onClick={e => e.stopPropagation()}>
        <ClientProgressBar pct={Math.max(...children.map(c => c._client_progress ?? 0))} />
      </td>

      {/* Status */}
      <td className="py-3 px-4 align-middle" onClick={e => e.stopPropagation()}>
        <Badge variant="destructive" className="gap-1 text-xs">
          <BellRing className="h-3 w-3" /> Triggered
        </Badge>
      </td>

      {/* Targets */}
      <td className="py-3 px-4 align-middle min-w-[140px]" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5 max-w-[180px]">
          <Badge className="text-[10.5px] px-2 py-0 gap-1 w-fit">
            <User className="h-2.5 w-2.5" /> Per Client
          </Badge>
          {(parentAlert.target_group_names?.length ? parentAlert.target_group_names : parentAlert.target_group_ids || [])
            .slice(0, 2)
            .map((name, i) => <span key={i} className="text-sm truncate">{name}</span>)}
          {(parentAlert.target_group_ids?.length ?? 0) > 2 && (
            <span className="text-xs text-muted-foreground">+{parentAlert.target_group_ids.length - 2} more</span>
          )}
        </div>
      </td>

      {/* Last updated */}
      <td className="py-3 px-4 align-middle whitespace-nowrap" onClick={e => e.stopPropagation()}>
        <div className="text-sm text-pd-subtle">{formatRelative(new Date(parentAlert.updated_at))}</div>
        {parentAlert.last_triggered_at && (
          <div className="text-xs text-pd-danger mt-0.5 flex items-center gap-1">
            <BellRing className="h-3 w-3" />
            {formatRelative(new Date(parentAlert.last_triggered_at))}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 align-middle" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Alert actions">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(parentAlert)} className="gap-2 cursor-pointer">
              <Pencil className="h-4 w-4" /> Edit Alert
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onEvaluate(parentAlert)}
              disabled={!!evaluating}
              className="gap-2 cursor-pointer"
            >
              {isEval ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Evaluate now
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSnooze(parentAlert)} className="gap-2 cursor-pointer">
              <BellOff className="h-4 w-4" /> Snooze All
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(parentAlert)}
              className="gap-2 cursor-pointer text-pd-danger focus:bg-pd-danger-bg focus:text-pd-danger"
            >
              <Trash2 className="h-4 w-4" /> Delete Alert
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </StaggerItem>
  )
}

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
function AlertTableSkeleton() {
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

function AlertTable({ rows, emptyLabel, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete }) {
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

function TriggeredTable({ rows, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete, onDeleteSub }) {
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

// ── Main page ─────────────────────────────────────────────────────────────────

const EXTENDED_EMPTY_FORM = {
  ...EMPTY_FORM,
  tracking_mode: "total",
}

// useSearchParams opts a route out of static rendering unless what reads it
// sits behind a Suspense boundary — Next needs something to render while the
// params resolve. This page went years without one because nothing here ever
// rendered on the server: ProtectedLayout returned null until it had hydrated,
// so the requirement never came up. Same shape as /settings and /login.
function AlertsPageContent() {
  const [alerts, setAlerts] = useState({ active: [], triggered: [], paused: [], counts: {} })
  const [clientGroups, setClientGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [customMetrics, setCustomMetrics] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSubTarget, setDeleteSubTarget] = useState(null)
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [snoozeHours, setSnoozeHours] = useState(24)
  const [evaluating, setEvaluating] = useState(null)
  const [form, setForm] = useState(EXTENDED_EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [dialogMode, setDialogMode] = useState("birdy") // "birdy" | "manual"
  const [birdyChatKey, setBirdyChatKey] = useState(0)
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "triggered")

  // Alerts should only ever target active clients
  const activeClientGroups = useMemo(
    () => activeGroups(clientGroups),
    [clientGroups],
  )

  // Extract unique tags from all client groups for the tag metric picker
  const availableTags = useMemo(() => {
    const tagSet = new Set()
    for (const g of clientGroups) {
      const breakdown = g.gohighlevel?.metrics?.tag_breakdown || g.gohighlevel_cache?.metrics?.tag_breakdown || {}
      for (const tag of Object.keys(breakdown)) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort()
  }, [clientGroups])

  // Build metric options for the MetricPicker (tabs + icons)
  const alertMetricOptions = useMemo(() =>
    buildMetricPickerOptions({ availableTags, customMetrics }),
  [availableTags, customMetrics])

  // ── Data fetching ────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiRequest("/api/alerts")
      if (!res.ok) throw new Error("Failed to load alerts")
      const data = await res.json()
      setAlerts(data)
    } catch (e) {
      toast.error("Could not load alerts")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchClientGroups = useCallback(async () => {
    try {
      // Only needs names, ids and status to build the target picker — never a
      // trend chart — so it opts out of the 6.38 MB of per-day series.
      const res = await apiRequest("/api/client-groups?include_daily=false")
      if (!res.ok) return
      const data = await res.json()
      setClientGroups(data.client_groups || [])
    } catch { }
  }, [])

  const fetchCustomMetrics = useCallback(async () => {
    try {
      const res = await apiRequest("/api/custom-metrics")
      if (!res.ok) return
      const data = await res.json()
      setCustomMetrics((data.custom_metrics || []).map(m => ({
        id: m.id, name: m.name, formulaParts: m.formula_parts || [],
      })))
    } catch { }
  }, [])

  useEffect(() => {
    fetchAlerts()
    fetchClientGroups()
    fetchCustomMetrics()
  }, [fetchAlerts, fetchClientGroups, fetchCustomMetrics])

  // ── Form helpers ─────────────────────────────────────────────

  // useCallback because the header memo below closes over it, and an unstable
  // dep there republishes the top bar on every render.
  const openCreate = useCallback(() => {
    setEditingAlert(null)
    setForm(EXTENDED_EMPTY_FORM)
    setClientSearch("")
    setDialogMode("birdy")
    setBirdyChatKey(k => {
      // Clear the stale session so Birdy always starts fresh
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`birdy_alert_session_${k + 1}`)
      }
      return k + 1
    })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((alert) => {
    const realAlert = alert._virtual || alert._isGroup ? { ...alert } : alert
    setEditingAlert(realAlert)
    setForm({
      name: realAlert.name || "",
      description: realAlert.description || "",
      type: realAlert.type || "warning",
      metric: realAlert.condition?.metric || "lead_count",
      operator: realAlert.condition?.operator || "gt",
      value: String(realAlert.condition?.value ?? "0"),
      period: realAlert.condition?.period || "day",
      target_group_ids: realAlert.target_group_ids || [],
      notification_channels: realAlert.notification_channels || ["in_app"],
      frequency: realAlert.frequency || "daily",
      tracking_mode: realAlert.tracking_mode || "total",
    })
    setClientSearch("")
    setDialogMode("manual")
    setDialogOpen(true)
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Alert name is required"); return }
    if (!form.value || isNaN(Number(form.value))) { toast.error("Please enter a valid threshold value"); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        condition: {
          metric: form.metric,
          operator: form.operator,
          value: Number(form.value),
          period: form.period,
        },
        target_group_ids: form.target_group_ids,
        notification_channels: form.notification_channels,
        frequency: form.frequency,
        tracking_mode: form.tracking_mode,
      }

      const url = editingAlert ? `/api/alerts/${editingAlert.id}` : `/api/alerts`
      const method = editingAlert ? "PATCH" : "POST"

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(await res.text())

      toast.success(editingAlert ? "Alert updated" : "Alert created")
      setDialogOpen(false)
      fetchAlerts()
    } catch (e) {
      toast.error("Failed to save alert")
    } finally {
      setSaving(false)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback((alert) => {
    setDeleteTarget(alert)
  }, [])

  const handleDeleteConfirm = async () => {
    const target = deleteTarget
    if (!target) return
    setDeleteTarget(null)
    try {
      const res = await apiRequest(`/api/alerts/${target.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Alert deleted")
      setDeleteTarget(null)
      fetchAlerts()
    } catch {
      toast.error("Failed to delete alert")
    }
  }

  // Sub-alert delete: calls dismiss-client endpoint to surgically remove the
  // client entry from per_client_results (backend auto-flips alert to active
  // if no triggered clients remain)
  const handleDeleteSubRequest = useCallback((row) => {
    setDeleteSubTarget(row)
  }, [])

  const handleDeleteSubConfirm = async () => {
    const target = deleteSubTarget
    if (!target) return
    setDeleteSubTarget(null)
    try {
      const res = await apiRequest(`/api/alerts/${target.id}/dismiss-client`, {
        method: "POST",
        body: JSON.stringify({ client_id: target._client_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(`Removed triggered entry for ${target._client_name}`)
      fetchAlerts()
    } catch {
      toast.error("Failed to remove triggered entry")
    }
  }

  const handleTogglePause = useCallback(async (alert) => {
    const newStatus = alert.status === "active" || alert.status === "triggered" ? "paused" : "active"
    try {
      await apiRequest(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(newStatus === "paused" ? "Alert paused" : "Alert activated")
      fetchAlerts()
    } catch {
      toast.error("Failed to update alert")
    }
  }, [fetchAlerts])

  const handleSnoozeRequest = useCallback((alert) => {
    setSnoozeTarget(alert)
    setSnoozeHours(24)
  }, [])

  const handleSnoozeConfirm = async () => {
    const target = snoozeTarget
    if (!target) return
    try {
      if (target._virtual && target._client_id) {
        await apiRequest(`/api/alerts/${target.id}/snooze-client`, {
          method: "POST",
          body: JSON.stringify({ client_id: target._client_id, hours: snoozeHours }),
        })
      } else {
        await apiRequest(`/api/alerts/${target.id}/snooze`, {
          method: "POST",
          body: JSON.stringify({ hours: snoozeHours }),
        })
      }
      const label = SNOOZE_OPTIONS.find(s => s.value === snoozeHours)?.label
      toast.success(
        target._virtual
          ? `${target._client_name} snoozed for ${label}`
          : `Alert snoozed for ${label}`
      )
      setSnoozeTarget(null)
      fetchAlerts()
    } catch {
      toast.error("Failed to snooze alert")
    }
  }

  const handleEvaluate = useCallback(async (alert) => {
    setEvaluating(alert._virtual_id ?? alert.id)
    try {
      const res = await apiRequest(`/api/alerts/${alert.id}/evaluate`, {
        method: "POST",
      })
      const data = await res.json()
      const ev = data.evaluation
      if (ev?.triggered) {
        toast.warning(`⚡ Alert triggered: ${ev.message}`)
      } else {
        const pct = ev?.progress_pct?.toFixed(0) ?? "0"
        toast.success(`All clear — ${pct}% to trigger (current: ${ev?.current_value?.toFixed(2) ?? "—"})`)
      }
      fetchAlerts()
    } catch {
      toast.error("Evaluation failed")
    } finally {
      setEvaluating(null)
    }
  }, [fetchAlerts])

  const toggleGroup = (id) => {
    setForm(f => ({
      ...f,
      target_group_ids: f.target_group_ids.includes(id)
        ? f.target_group_ids.filter(g => g !== id)
        : [...f.target_group_ids, id],
    }))
  }

  // Title and the create action belong in the global top bar, in place of the
  // Birdy wordmark — the same place Marketing, Sales, Leads and the Client Hub
  // put theirs. See components/page-header.jsx.
  const header = useMemo(
    () => ({
      title: (
        <div className={`${pdFontClass} min-w-0`}>
          <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
            Alerts
          </h1>
          <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">
            Every rule watching your accounts, and everything it has caught
          </p>
        </div>
      ),
      controls: (
        <Button onClick={openCreate} className="gap-2">
          <CirclePlus className="h-4 w-4" />
          Create Alert
        </Button>
      ),
    }),
    [openCreate]
  )
  usePageHeader(header)

  const rowHandlers = {
    evaluating,
    onEdit: openEdit,
    onEvaluate: handleEvaluate,
    onTogglePause: handleTogglePause,
    onSnooze: handleSnoozeRequest,
    onDelete: handleDeleteRequest,
  }

  return (
    <main className={`${pdFontClass} w-full min-w-0`}>
      <div className=" mx-auto">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">  
          {/* The app's page tab bar. Triggered and Snoozed keep their own badge
              colours — red and amber carry meaning here, so they override the
              strip's default tint rather than reading as a plain count. Active
              has no such meaning and takes the default. A count of 0 passes
              undefined, which renders no badge at all. */}
          <div className={pdFontClass}>
            <PageTabs
              label="Alert state"
              tabs={[
                { key: "active", label: "Active Alerts", badge: alerts.counts?.active || undefined },
                {
                  key: "triggered",
                  label: "Triggered",
                  badge: alerts.counts?.triggered || undefined,
                  badgeClassName: "bg-pd-danger-bg text-pd-danger",
                },
                {
                  key: "paused",
                  label: "Snoozed / Paused",
                  badge: alerts.counts?.paused || undefined,
                  badgeClassName: "bg-pd-warning-bg text-pd-amber",
                },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {isLoading ? (
            <div className="mt-2"><AlertTableSkeleton /></div>
          ) : (
            <>
              <TabsContent value="active" className="mt-2">
                <AlertTable rows={alerts.active || []} emptyLabel="active" {...rowHandlers} />
              </TabsContent>
              <TabsContent value="triggered" className="mt-2">
                <TriggeredTable
                  rows={alerts.triggered || []}
                  evaluating={evaluating}
                  onEdit={openEdit}
                  onEvaluate={handleEvaluate}
                  onTogglePause={handleTogglePause}
                  onSnooze={handleSnoozeRequest}
                  onDelete={handleDeleteRequest}
                  onDeleteSub={handleDeleteSubRequest}
                />
              </TabsContent>
              <TabsContent value="paused" className="mt-2">
                <AlertTable rows={alerts.paused || []} emptyLabel="paused" {...rowHandlers} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="w-[min(1120px,94vw)] !max-w-none h-[88vh] p-0 gap-0 flex flex-col overflow-hidden bg-pd-canvas sm:!max-w-none"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="bg-pd-surface px-7 py-5 border-b border-pd-border shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-pd-display text-[22px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
                  {editingAlert ? "Edit Alert" : "Create Alert"}
                </h2>
                <p className="text-[13px] text-pd-subtle mt-1.5">
                  {editingAlert
                    ? "Update the alert configuration."
                    : dialogMode === "birdy"
                      ? "Chat with Birdy to set up your alert — it'll create it for you."
                      : "Fill in the form to configure your alert manually."}
                </p>
              </div>
              {!editingAlert && (
                <div className="flex items-center gap-1 p-1 rounded-full bg-muted shrink-0">
                  <button
                    type="button"
                    onClick={() => setDialogMode("birdy")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      dialogMode === "birdy"
                        ? "bg-pd-primary text-white shadow-pd-segment"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${dialogMode === "birdy" ? "text-white" : "text-muted-foreground"}`} />
                    Ask Birdy
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogMode("manual")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      dialogMode === "manual"
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Manual
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Body — Birdy AI mode */}
          {dialogMode === "birdy" && !editingAlert && (
            <div className="flex-1 min-h-0 flex flex-col bg-pd-canvas overflow-hidden">
              <div className="flex-1 min-h-0 h-full overflow-hidden">
                <ChatConversation
                  key={birdyChatKey}
                  page="alerts"
                  sessionKey={`birdy_alert_session_${birdyChatKey}`}
                  initialMessage="Hi, I want to create a new alert"
                  bubbleWidthClass="max-w-[85%]"
                  composerCompact
                  composerPlaceholder="Type your answer..."
                  showQuickActions={false}
                  quickStarters={[
                    { label: "CPL alert", prompt: "Alert me when cost per lead exceeds a threshold" },
                    { label: "Spend alert", prompt: "Alert me when ad spend goes too high" },
                    { label: "Revenue alert", prompt: "Alert me when GHL revenue drops" },
                    { label: "Calls alert", prompt: "Alert me on call center metrics" },
                  ]}
                  emptyStateTitle="Let's create an alert"
                  emptyStateSubtitle="Tell me what you want to monitor and I'll set it up for you."
                  onToolUsed={(toolName) => {
                    if (toolName === "create_alert") fetchAlerts()
                  }}
                />
              </div>
              <div className="shrink-0 px-7 py-3 border-t border-pd-border bg-pd-surface flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* Body — Manual form mode */}
          {(dialogMode === "manual" || editingAlert) && (
          <div className="px-7 py-6 overflow-y-auto flex-1">
            {/* Form */}
            <form id="create-alert-form" onSubmit={e => { e.preventDefault(); handleSave() }}>
              <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Left Column */}
                <div className="w-full lg:w-2/3 flex-1 space-y-4">
                  {/* Basic Info */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Name</Label>
                        <Input
                          placeholder="e.g. Low ROI Alert"
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Description</Label>
                        <Input
                          placeholder="Describe when this alert fires..."
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Type</Label>
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm space-y-4">
                    <h3 className="font-pd-display text-[16px] font-semibold text-pd-ink">Condition</h3>
                    <div className="grid grid-cols-[2fr_1fr_110px_1fr] gap-4">
                      <div className="space-y-2">
                      <Label className="text-[12.5px] font-semibold text-pd-ink">Metric</Label>
                      <MetricPicker
                        metrics={alertMetricOptions}
                        value={form.metric}
                        onChange={v => setForm(f => ({ ...f, metric: v }))}
                        placeholder="Select metric..."
                        triggerClassName="w-full"
                      />
                      </div>
                      <div className="space-y-2">
                      <Label className="text-[12.5px] font-semibold text-pd-ink">When it</Label>
                      <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        <SelectContent>
                            {OPERATOR_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Value</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-10"
                          value={form.value}
                          onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                      <Label className="text-[12.5px] font-semibold text-pd-ink">Over</Label>
                      <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        <SelectContent>
                            {PERIOD_OPTIONS.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      </div>
                    </div>
                  </div>

                  {/* Target Client Groups */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <h3 className="font-pd-display text-[16px] font-semibold text-pd-ink">Target Client Groups</h3>
                      <div className="flex flex-col items-end gap-1">
                        <TrackingModeToggle value={form.tracking_mode} onChange={v => setForm(f => ({ ...f, tracking_mode: v }))} />
                        <p className="text-xs text-muted-foreground max-w-[280px] text-right">
                          {form.tracking_mode === "total"
                            ? "Alert triggers when the combined value across all selected clients crosses the threshold."
                            : "Alert triggers separately for each client that crosses the threshold on their own."}
                        </p>
                      </div>
                    </div>
                    <Input placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                    <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-pd-border divide-y divide-pd-divider">
                        {/* Select All */}
                      <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-pd-table-head transition-colors font-medium bg-muted/30">
                        <Checkbox
                          checked={activeClientGroups.length > 0 && form.target_group_ids.length === activeClientGroups.length}
                            onCheckedChange={(checked) => {
                              setForm(f => ({
                                ...f,
                                target_group_ids: checked ? activeClientGroups.map(g => g.id) : [],
                              }))
                            }}
                        />
                        <span className="text-sm font-medium">Target All Client Groups</span>
                      </label>
                        {/* Client groups */}
                      {activeClientGroups
                        .filter(g => g.name.toLowerCase().includes(clientSearch.toLowerCase()))
                        .map(g => (
                          <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-pd-table-head transition-colors">
                            <Checkbox checked={form.target_group_ids.includes(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                            <span className="text-sm">{g.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="w-full lg:w-1/3 flex-shrink-0 self-stretch space-y-4">
                  {/* Preview Card */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface shadow-sm flex flex-col">
                    <div className="p-6 pt-6 flex-1 flex flex-col">
                      <div className="text-center p-4 flex-1 flex flex-col justify-center">
                        <div className="font-pd-display text-[20px] font-bold tracking-[-0.01em] text-pd-ink">{form.name || "Unnamed Alert"}</div>
                        <div className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-2">
                          {(() => {
                            const sel = alertMetricOptions.find(m => m.id === form.metric)
                            if (!sel) return "Select a metric to preview"
                            return (
                              <>
                                {sel.icon && <Image src={sel.icon} alt="" width={16} height={16} className="opacity-70" />}
                                {sel.label}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="border-t border-border pt-4 mt-2 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Target className="h-4 w-4" />
                            <span>Scope</span>
                          </div>
                          <Badge variant="secondary" className="capitalize">client</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {form.tracking_mode === "per_client" ? <User className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                            <span>Tracking</span>
                          </div>
                          {form.tracking_mode === "per_client" ? (
                            <Badge className="gap-1 text-xs"><User className="h-3 w-3" /> Per Client</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs"><Layers className="h-3 w-3" /> Total</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span>Targets</span></div>
                          <span className="font-medium">{form.target_group_ids.length ? `${form.target_group_ids.length} selected` : "None"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span>Frequency</span></div>
                          <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCY_OPTIONS.map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>Channels</span>
                          </div>
                          <span className="font-medium">
                            {form.notification_channels.length} active
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notification Channels */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm space-y-4">
                    <h3 className="font-pd-display text-[16px] font-semibold text-pd-ink">Notification Channels</h3>
                    <div className="space-y-3">
                      {/* Internal */}
                      <div className="rounded-2xl border border-pd-border p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Internal</span>
                          </div>
                          <Switch
                            checked={form.notification_channels.includes("in_app")}
                            onCheckedChange={(checked) => {
                              setForm(f => ({
                              ...f,
                              notification_channels: checked
                                ? [...f.notification_channels.filter(c => c !== "in_app"), "in_app"]
                                : f.notification_channels.filter(c => c !== "in_app"),
                              }))
                            }}
                          />
                        </div>
                        {form.notification_channels.includes("in_app") && (
                          <p className="text-xs text-muted-foreground">Notifications will appear in your Birdy dashboard.</p>
                        )}
                      </div>
                      {/* Slack — Coming Soon */}
                      <div className="rounded-2xl border border-pd-border p-3.5 space-y-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Slack className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Slack</span>
                            <Badge className="bg-pd-divider text-pd-body border-0 text-[10px] px-2 py-0">Soon</Badge>
                          </div>
                          <Switch disabled checked={false} />
                        </div>
                      </div>
                      {/* Email — Coming Soon */}
                      <div className="rounded-2xl border border-pd-border p-3.5 space-y-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Email</span>
                            <Badge className="bg-pd-divider text-pd-body border-0 text-[10px] px-2 py-0">Soon</Badge>
                          </div>
                          <Switch disabled checked={false} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          )}

          {/* Footer — only shown in manual/edit mode */}
          {(dialogMode === "manual" || editingAlert) && (
          <div className="bg-pd-surface px-7 py-4 border-t border-pd-border flex-shrink-0">
            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-alert-form"
                disabled={saving}
              >
                {saving
                  ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Saving...</>
                  : (editingAlert ? "Save Changes" : "Create Alert")}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alert?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleteTarget?.name}"</strong> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete sub-alert (client triggered entry) ─────────── */}
      <AlertDialog open={!!deleteSubTarget} onOpenChange={open => { if (!open) setDeleteSubTarget(null) }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove triggered entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will dismiss the triggered entry for <strong>{deleteSubTarget?._client_name}</strong>. The alert will re-trigger if the condition is met again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSubConfirm}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Snooze Dialog ─────────────────────────────────────── */}
      <Dialog open={!!snoozeTarget} onOpenChange={open => !open && setSnoozeTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Snooze Alert</DialogTitle>
            <DialogDescription>
              {snoozeTarget?._virtual
                ? <>Silence <strong>{snoozeTarget._client_name}</strong> for this alert.</>
                : <>Temporarily silence <strong>"{snoozeTarget?.name}"</strong>.</>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Label>Snooze for</Label>
            <Select value={String(snoozeHours)} onValueChange={v => setSnoozeHours(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SNOOZE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeTarget(null)}>Cancel</Button>
            <Button onClick={handleSnoozeConfirm} className="gap-2">
              <BellOff className="h-4 w-4" />
              {snoozeTarget?._virtual ? "Snooze Client" : "Snooze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="mt-[62px]"><AlertTableSkeleton /></div>
      }
    >
      <AlertsPageContent />
    </Suspense>
  )
}
