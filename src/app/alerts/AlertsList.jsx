"use client"

import { useMemo, useState } from "react"
import { Bell, BellOff, BellRing, Ellipsis, Layers, Pause, Pencil, Play, RefreshCw, Trash2, User, Zap } from "lucide-react"
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
} from "@/components/ds"
import { useCurrency } from "@/hooks/useCurrency"
import { METRIC_OPTIONS, RelativeTime, localiseMetricLabel, conditionSummary, statusBadge, ProgressToTrigger, metricIcon } from "@/lib/alert-helpers"
import {
  ClientActions,
  ClientNameCell,
  ClientProgress,
  GroupNameCell,
  GroupProgress,
  groupTriggeredRows,
} from "./AlertDetail"

const EMPTY_HINTS = {
  active: "Create an alert and Birdy will keep an eye on the numbers for you.",
  triggered: "Nothing has crossed a threshold.",
  paused: "Alerts you snooze or pause wait here.",
}

const metricLabel = (alert, symbol) =>
  localiseMetricLabel(
    METRIC_OPTIONS.find((m) => m.value === alert.condition?.metric)?.label || alert.condition?.metric,
    symbol
  )

function NameCell({ alert }) {
  return (
    <div className="min-w-[160px]">
      <div className="text-sm font-medium text-foreground">{alert.name}</div>
      {alert.description && (
        <div className="max-w-[220px] truncate text-xs text-muted-foreground">{alert.description}</div>
      )}
    </div>
  )
}

function ConditionCell({ alert }) {
  return (
    <div>
      <div className="num text-sm font-medium text-foreground">{conditionSummary(alert)}</div>
      {alert.condition?.period && (
        <div className="text-xs text-muted-foreground">
          {["pct_drop", "pct_rise"].includes(alert.condition?.operator) ? "vs " : "window: "}
          {alert.condition.period}
        </div>
      )}
    </div>
  )
}

function TargetsCell({ alert }) {
  // A group row is a per-client rule by construction.
  const perClient = alert._isGroup || alert.tracking_mode === "per_client"
  if (!alert.target_group_ids?.length && !alert._isGroup) {
    return (
      <div className="flex flex-col gap-1">
        <Badge>
          <Layers /> Total
        </Badge>
        <span className="text-sm text-muted-foreground">Global (All)</span>
      </div>
    )
  }
  const names = alert.target_group_names?.length ? alert.target_group_names : alert.target_group_ids || []
  return (
    <div className="flex max-w-[180px] flex-col gap-1">
      {perClient ? (
        <Badge tone="primary">
          <User /> Per Client
        </Badge>
      ) : (
        <Badge>
          <Layers /> Total
        </Badge>
      )}
      {names.slice(0, 2).map((name, i) => (
        <span key={i} className="truncate text-sm">
          {name}
        </span>
      ))}
      {(alert.target_group_ids?.length ?? 0) > 2 && (
        <span className="text-xs text-muted-foreground">+{alert.target_group_ids.length - 2} more</span>
      )}
    </div>
  )
}

function UpdatedCell({ alert }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">
        <RelativeTime value={alert.updated_at} />
      </div>
      {alert.last_triggered_at && (
        <div className="flex items-center gap-1 text-xs text-danger-ink">
          <BellRing className="size-3" />
          <RelativeTime value={alert.last_triggered_at} />
        </div>
      )}
    </div>
  )
}

/** Rule-level actions: a menu for the rest, and an icon-only trash for delete. */
function RuleActions({ alert, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete }) {
  const isGroup = !!alert._isGroup
  const isEval = evaluating === (alert._virtual_id ?? alert.id)
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Alert actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onEdit(alert)}>
            <Pencil /> {isGroup ? "Edit Alert" : "Edit"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEvaluate(alert)} disabled={!!evaluating}>
            {isEval ? <RefreshCw className="animate-spin" /> : <Zap />}
            Evaluate now
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!isGroup && (
            <DropdownMenuItem onClick={() => onTogglePause(alert)}>
              {alert.status === "paused" ? (
                <>
                  <Play /> Activate
                </>
              ) : (
                <>
                  <Pause /> Pause
                </>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onSnooze(alert)}>
            <BellOff /> {isGroup ? "Snooze All" : "Snooze"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${alert.name}`} onClick={() => onDelete(alert)}>
        <Trash2 />
      </Button>
    </div>
  )
}

/**
 * The alerts of one tab as a ds DataTable. On the triggered tab a rule that fired
 * for several clients is one expandable row with a row per client.
 *
 * @param {object} props
 * @param {object[]} props.rows Alerts for the tab, as the API returns them
 * @param {"active"|"triggered"|"paused"} props.tab
 * @param {boolean} [props.loading]
 * @param {string|null} props.evaluating Id of the alert (or client entry) being evaluated
 * @param {(alert: object) => void} props.onEdit
 * @param {(alert: object) => void} props.onEvaluate
 * @param {(alert: object) => void} props.onTogglePause
 * @param {(alert: object) => void} props.onSnooze
 * @param {(alert: object) => void} props.onDelete
 * @param {(client: object) => void} props.onDeleteSub Dismisses one client's triggered entry
 */
export default function AlertsList({
  rows, tab, loading = false, evaluating, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete, onDeleteSub,
}) {
  const [expanded, setExpanded] = useState({})
  const { currencySymbol } = useCurrency("GBP")

  const data = useMemo(
    () => (tab === "triggered" ? groupTriggeredRows(rows) : rows.map((a) => ({ ...a, _rowKey: String(a.id) }))),
    [rows, tab]
  )

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: "Alert Name",
        accessorFn: (a) => a._client_name ?? a.name,
        meta: { label: "Alert Name", minWidth: 220 },
        cell: ({ row }) =>
          row.depth > 0 ? (
            <ClientNameCell client={row.original} />
          ) : row.original._isGroup ? (
            <GroupNameCell alert={row.original} row={row} />
          ) : (
            <NameCell alert={row.original} />
          ),
      },
      {
        id: "metric",
        header: "Metric",
        accessorFn: (a) => (a._virtual ? undefined : metricLabel(a, currencySymbol)),
        meta: { label: "Metric" },
        // A client row inherits the rule's metric, condition and targets; it leaves those cells blank.
        cell: ({ row }) =>
          row.depth > 0 ? null : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{metricIcon(row.original.condition?.metric)}</span>
              {metricLabel(row.original, currencySymbol)}
            </div>
          ),
      },
      {
        id: "condition",
        header: "Condition",
        enableSorting: false,
        accessorFn: (a) => (a._virtual ? undefined : conditionSummary(a)),
        meta: { label: "Condition" },
        cell: ({ row }) => (row.depth > 0 ? null : <ConditionCell alert={row.original} />),
      },
      {
        id: "progress",
        header: "Progress",
        enableSorting: false,
        accessorFn: (a) => a.progress_pct ?? a._client_progress ?? 0,
        meta: { label: "Progress" },
        cell: ({ row }) =>
          row.depth > 0 ? (
            <ClientProgress client={row.original} />
          ) : row.original._isGroup ? (
            <GroupProgress alert={row.original} />
          ) : (
            <ProgressToTrigger alert={row.original} />
          ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (a) => a.status,
        meta: { label: "Status" },
        cell: ({ row }) => statusBadge(row.original.status, row.original.snoozed_until),
      },
      {
        id: "targets",
        header: "Targets",
        enableSorting: false,
        accessorFn: (a) => (a._virtual ? undefined : (a.target_group_ids?.length ?? 0)),
        meta: { label: "Targets" },
        cell: ({ row }) => (row.depth > 0 ? null : <TargetsCell alert={row.original} />),
      },
      {
        id: "updated",
        header: "Last Updated",
        accessorFn: (a) => a.updated_at,
        meta: { label: "Last Updated" },
        cell: ({ row }) => <UpdatedCell alert={row.original} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        accessorFn: (a) => a.id,
        meta: { label: "Actions" },
        cell: ({ row }) =>
          row.depth > 0 ? (
            <ClientActions
              client={row.original}
              evaluating={evaluating}
              onEvaluate={onEvaluate}
              onSnooze={onSnooze}
              onDismiss={onDeleteSub}
            />
          ) : (
            (
            <RuleActions
              alert={row.original}
              evaluating={evaluating}
              onEdit={onEdit}
              onEvaluate={onEvaluate}
              onTogglePause={onTogglePause}
              onSnooze={onSnooze}
              onDelete={onDelete}
            />
          )
          ),
      },
    ],
    [evaluating, currencySymbol, onEdit, onEvaluate, onTogglePause, onSnooze, onDelete, onDeleteSub]
  )

  const hasGroups = data.some((a) => a._isGroup)

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      stickyFirstColumn
      getSubRows={(a) => a.subRows}
      getRowId={(a, i, parent) => (parent ? `${parent.id}:${a._client_id ?? i}` : a._rowKey)}
      state={{ expanded }}
      onStateChange={(next) => setExpanded(next.expanded)}
      onRowClick={
        hasGroups
          ? (a) => {
              if (a._isGroup) setExpanded((prev) => ({ ...prev, [a._rowKey]: !prev[a._rowKey] }))
            }
          : undefined
      }
      empty={<EmptyState icon={Bell} title={`No ${tab} alerts`} description={EMPTY_HINTS[tab]} />}
    />
  )
}
