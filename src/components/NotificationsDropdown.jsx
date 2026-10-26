"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import useSWR from "swr"
import { Bell, BellRing, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { optionalFetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { formatRelative } from "@/lib/alert-helpers"
import { flash as flashBirdy } from "@/components/birdy/birdy-store"
import { Badge, Button, Popover, PopoverContent, PopoverTrigger, Skeleton } from "@/components/ds"
import { Stagger, StaggerItem } from "@/components/motion"

function formatTriggerDate(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return {
    relative: formatRelative(date),
    absolute: date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

// Stable per-row key, matching how rows are keyed when rendered
function rowKey(row) {
  if (row._virtual) return String(row._virtual_id ?? `${row.id}_${row._client_id}`)
  return `real_${row.id}`
}

// Same grouping logic as the alerts page
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
          last_triggered_at: row.last_triggered_at,
          _isGroup: true,
        },
        children: [],
      })
    }
    map.get(key).children.push(row)
  }
  return [...map.values()]
}

function TriggerMeta({ dateStr }) {
  const trigger = formatTriggerDate(dateStr)
  if (!trigger) return <p className="text-xs text-muted-foreground mt-0.5">Trigger date unknown</p>
  return (
    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
      <span className="text-xs text-danger-ink font-medium">{trigger.relative}</span>
      <span className="text-xs text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground">{trigger.absolute}</span>
    </div>
  )
}

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  // One request for the bell, shared with whatever else on the page wants
  // alerts. This used to be two useEffects — one for the badge, one for when
  // the dropdown opened — and the dashboard fetched /api/alerts a third time
  // for its own tab. Same key, so SWR now serves all three from one response.
  const { data, isLoading: loading } = useSWR(queryKeys.alerts(), optionalFetcher)
  const alerts = useMemo(
    () => (Array.isArray(data?.triggered) ? data.triggered : []),
    [data]
  )
  // Alerts dismissed by closing the dropdown — hides them from the bell
  // badge/list only. The Alerts page fetches independently, so they still
  // show up there; this is purely a "seen in the dropdown" marker that
  // resets on page reload.
  const [dismissedIds, setDismissedIds] = useState(() => new Set())
  const wasOpenRef = useRef(false)
  const router = useRouter()
  // Raw triggered count from the last successful fetch (pre-dismissal), so a
  // later fetch that turns up more alerts than before can nudge the mascot —
  // there's no live push here, so "arrived" is approximated as "more than
  // last time we checked". null until the first fetch lands, so mount never
  // counts as an arrival.
  const lastSeenCountRef = useRef(null)

  const visibleAlerts = alerts.filter((row) => !dismissedIds.has(rowKey(row)))
  const groups = groupTriggeredRows(visibleAlerts)

  // Total count = sub-alerts for parent groups + 1 per simple alert
  const totalCount = groups.reduce((sum, { children }) => sum + (children.length > 0 ? children.length : 1), 0)

  // Nudge the mascot when a refresh turns up more than last time. Counted off
  // the raw list rather than the visible one, so dismissing in the dropdown
  // doesn't read as alerts disappearing and then arriving again.
  useEffect(() => {
    if (!data) return
    const count = groupTriggeredRows(alerts).reduce(
      (sum, { children }) => sum + (children.length > 0 ? children.length : 1),
      0
    )
    if (lastSeenCountRef.current !== null && count > lastSeenCountRef.current) {
      flashBirdy("alert")
    }
    lastSeenCountRef.current = count
  }, [data, alerts])

  // Outside clicks and Escape are the popover's own business now — Radix
  // closes it through onOpenChange, so the open → closed effect below still
  // sees every way of shutting it.

  // On every open -> closed transition (X button, outside click, bell
  // toggle, or clicking a notification), dismiss whatever was shown so the
  // badge/list clear until new alerts come in.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      setDismissedIds((prev) => {
        const next = new Set(prev)
        for (const row of alerts) next.add(rowKey(row))
        return next
      })
    }
    wasOpenRef.current = open
  }, [open, alerts])

  const goToAlerts = () => {
    setOpen(false)
    router.push("/alerts?tab=triggered")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Outer bell button with total count badge */}
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {totalCount > 0 && (
            <Badge
              tone="danger"
              className="num absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center rounded-full px-1 py-0 leading-4 shadow-surface"
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] overflow-hidden p-0"
      >
        {/* Header — no bell icon, just text */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {totalCount > 0 && (
              <Badge tone="danger" size="sm" className="num rounded-full px-2">
                {totalCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="text-muted-foreground" />
          </Button>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Bell className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No triggered alerts</p>
            </div>
          ) : (
            <Stagger as="ul" gap={0.05} className="divide-y divide-border">
              {groups.map(({ parentAlert, children }) => {
                const hasChildren = children.length > 0

                // ── Parent with sub-alerts: show sub-alerts directly, no parent label ──
                if (hasChildren) {
                  return children.map((child) => (
                    <StaggerItem as="li" key={child._virtual_id ?? `${child.id}_${child._client_id}`}>
                      <button
                        onClick={goToAlerts}
                        className="w-full text-left px-4 py-3 hover:bg-danger-soft transition-colors flex items-start gap-2.5"
                      >
                        <BellRing className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {child._client_name}
                          </p>
                          <TriggerMeta dateStr={child.last_triggered_at} />
                        </div>
                      </button>
                    </StaggerItem>
                  ))
                }

                // ── Simple alert (no sub-alerts) ──
                return (
                  <StaggerItem as="li" key={`real_${parentAlert.id}`}>
                    <button
                      onClick={goToAlerts}
                      className="w-full text-left px-4 py-3 hover:bg-danger-soft transition-colors flex items-start gap-2.5"
                    >
                      <BellRing className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{parentAlert.name}</p>
                        <TriggerMeta dateStr={parentAlert.last_triggered_at} />
                      </div>
                    </button>
                  </StaggerItem>
                )
              })}
            </Stagger>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
