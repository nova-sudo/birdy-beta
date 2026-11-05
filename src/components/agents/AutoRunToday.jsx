"use client"

import { useState } from "react"
import { Zap } from "lucide-react"

import { Badge, Button, Frame, toast } from "@/components/ds"
import { undoWorkItem } from "@/lib/agents-api"
import { RelativeTime } from "@/lib/alert-helpers"

// The API sends naive UTC datetimes ("2026-10-26T07:01:00"); read them as UTC, not local time.
const asUtc = (v) => (typeof v === "string" && !/(z|[+-]\d\d:?\d\d)$/i.test(v) ? `${v}Z` : v)

function AutoRunRow({ item, onUndone }) {
  const [undone, setUndone] = useState(Boolean(item.undone_at))
  const [busy, setBusy] = useState(false)

  const undo = async () => {
    setBusy(true)
    setUndone(true)
    try {
      await undoWorkItem(item.id)
      toast.success("Undone", { description: item.title })
      onUndone?.(item)
    } catch (err) {
      setUndone(false)
      toast.error("Couldn't undo that", { description: err?.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink"
      >
        <Zap className="size-3.5" strokeWidth={2.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground" title={item.title}>
          {item.title}
        </span>
        {(item.client || item.applied_at) && (
          <span className="truncate text-xs text-muted-foreground">
            {item.client}
            {item.client && item.applied_at && " · "}
            {item.applied_at && <RelativeTime value={asUtc(item.applied_at)} />}
          </span>
        )}
      </div>
      {undone ? (
        <Badge tone="neutral" size="sm">
          Undone
        </Badge>
      ) : (
        <Button size="sm" variant="ghost" loading={busy} onClick={undo} aria-label={`Undo ${item.title}`}>
          Undo
        </Button>
      )}
    </li>
  )
}

/**
 * What the agent did on auto-run in the last 24 hours, each with Undo.
 *
 * @param {object} props
 * @param {object[]} props.items `work.auto_applied`
 * @param {(item: object) => void} [props.onUndone] After the server reversed one
 */
export function AutoRunToday({ items, onUndone, className }) {
  return (
    <Frame
      title="Done on auto today"
      leading={<Zap aria-hidden className="size-4 text-primary" />}
      action={<span className="text-xs text-muted-foreground">Undo for 24 hrs</span>}
      className={className}
    >
      <ul className="divide-y divide-divider">
        {items.map((item) => (
          <AutoRunRow key={item.id} item={item} onUndone={onUndone} />
        ))}
      </ul>
    </Frame>
  )
}
