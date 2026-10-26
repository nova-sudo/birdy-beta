"use client"

import { ChevronDown, ChevronRight, RefreshCw, User } from "lucide-react"
import { Badge, Button, ProgressBar } from "@/components/ds"
import { ProgressToTrigger } from "@/lib/alert-helpers"

// The triggered tab's per-client detail: a rule that fired for several clients
// is one expandable row, and expands into one row per client.

/**
 * Turns the triggered list into the table's tree. Real alerts are plain rows; the
 * per-client entries of one rule (virtual rows sharing an id) become one parent
 * row carrying its clients as `subRows`.
 */
export function groupTriggeredRows(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!row._virtual) {
      map.set(`real_${row.id}`, { ...row, _rowKey: `real_${row.id}` })
      continue
    }
    const key = `group_${row.id}`
    if (!map.has(key)) {
      map.set(key, {
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
        _rowKey: key,
        subRows: [],
      })
    }
    map.get(key).subRows.push(row)
  }
  return [...map.values()]
}

/** Chevron that opens or closes a group; the row itself also toggles on click. */
export function ExpandToggle({ row, name }) {
  const open = row.getIsExpanded()
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
      onClick={(e) => {
        e.stopPropagation()
        row.toggleExpanded()
      }}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-control-focus"
    >
      <Icon className="size-4" />
    </button>
  )
}

/** Name cell of a group's parent row: the rule, with how many clients fired. */
export function GroupNameCell({ alert, row }) {
  const count = alert.subRows.length
  return (
    <div className="flex items-center gap-2">
      <ExpandToggle row={row} name={alert.name} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {alert.name}
          <Badge tone="danger">
            {count} client{count !== 1 ? "s" : ""}
          </Badge>
        </div>
        {alert.description && (
          <div className="max-w-[220px] truncate text-xs text-muted-foreground">{alert.description}</div>
        )}
      </div>
    </div>
  )
}

/** Name cell of a client row inside an expanded group. */
export function ClientNameCell({ client }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
      <User className="size-3.5 shrink-0 text-muted-foreground" />
      {client._client_name}
    </div>
  )
}

/** A group's progress: the client closest to (or past) the threshold. */
export function GroupProgress({ alert }) {
  const worst = Math.max(...alert.subRows.map((c) => c._client_progress ?? 0))
  return (
    <div className="flex min-w-[140px] max-w-[180px] flex-col gap-1">
      <span className="num text-sm font-semibold">{alert.subRows.length} triggered</span>
      <ProgressBar value={worst} triggered label="Closest client to the threshold" />
      <span className="num text-xs text-muted-foreground">Worst client {worst.toFixed(0)}% to trigger</span>
    </div>
  )
}

/** A client row's progress, read as the rule's own progress for that client. */
export function ClientProgress({ client }) {
  return (
    <ProgressToTrigger
      alert={{
        ...client,
        status: "triggered",
        progress_pct: client._client_progress,
        current_value: client._client_value,
      }}
    />
  )
}

/** Evaluate, snooze and dismiss for one client of a triggered rule. */
export function ClientActions({ client, evaluating, onEvaluate, onSnooze, onDismiss }) {
  const isEval = evaluating === client._virtual_id
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" aria-label={`Evaluate ${client._client_name}`} onClick={() => onEvaluate(client)} disabled={!!evaluating}>
        {isEval && <RefreshCw className="animate-spin" />}
        Evaluate
      </Button>
      <Button size="sm" aria-label={`Snooze ${client._client_name}`} onClick={() => onSnooze(client)}>
        Snooze
      </Button>
      <Button size="sm" variant="ghost" aria-label={`Dismiss ${client._client_name}`} onClick={() => onDismiss(client)}>
        Dismiss
      </Button>
    </div>
  )
}
