"use client"

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
  BellRing,
  Ellipsis,
  Pencil,
  Trash2,
  RefreshCw,
  BellOff,
  Zap,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { motion } from "framer-motion"
import { StaggerItem, EASE_OUT } from "@/components/motion"
import { METRIC_OPTIONS, formatRelative, conditionSummary, metricIcon } from "@/lib/alert-helpers"

// The triggered tab's per-client detail: a rule that fired for several clients
// collapses to one header row, and expands into one row per client.

// ── Progress bar ──────────────────────────────────────────────────────────────

export function ClientProgressBar({ pct }) {
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

export function groupTriggeredRows(rows) {
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

export function SubAlertRow({ row, onSnooze, onDelete, evaluating, onEvaluate }) {
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

export function GroupHeaderRow({ group, isExpanded, onToggle, onEdit, onSnooze, onEvaluate, evaluating, onDelete }) {
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

