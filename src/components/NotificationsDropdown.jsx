"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, BellRing, X, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiRequest } from "@/lib/api"
import { formatRelative } from "@/lib/alert-helpers"

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
  if (!trigger) return <p className="text-xs text-gray-400 mt-0.5">Trigger date unknown</p>
  return (
    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
      <span className="text-xs text-red-500 font-medium">{trigger.relative}</span>
      <span className="text-xs text-gray-400">·</span>
      <span className="text-xs text-gray-400">{trigger.absolute}</span>
    </div>
  )
}

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  // Alerts dismissed by closing the dropdown — hides them from the bell
  // badge/list only. The Alerts page fetches independently, so they still
  // show up there; this is purely a "seen in the dropdown" marker that
  // resets on page reload.
  const [dismissedIds, setDismissedIds] = useState(() => new Set())
  const wasOpenRef = useRef(false)
  const ref = useRef(null)
  const router = useRouter()

  const visibleAlerts = alerts.filter((row) => !dismissedIds.has(rowKey(row)))
  const groups = groupTriggeredRows(visibleAlerts)

  // Total count = sub-alerts for parent groups + 1 per simple alert
  const totalCount = groups.reduce((sum, { children }) => sum + (children.length > 0 ? children.length : 1), 0)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    apiRequest("/api/alerts")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const triggeredList = Array.isArray(data.triggered) ? data.triggered : []
        setAlerts(triggeredList)
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }, [open])

  // Also fetch count when closed (for the badge)
  useEffect(() => {
    apiRequest("/api/alerts")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const triggeredList = Array.isArray(data.triggered) ? data.triggered : []
        setAlerts(triggeredList)
      })
      .catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

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
    <div className="relative" ref={ref}>
      {/* Outer bell button with total count badge */}
      <button
        className="relative p-1.5 rounded-full hover:bg-gray-100 transition"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-black" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          style={{ width: 340 }}
        >
          {/* Header — no bell icon, just text */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {totalCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {totalCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-muted-foreground">No triggered alerts</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {groups.map(({ parentAlert, children }) => {
                  const hasChildren = children.length > 0

                  // ── Parent with sub-alerts: show sub-alerts directly, no parent label ──
                  if (hasChildren) {
                    return children.map((child) => (
                      <li key={child._virtual_id ?? `${child.id}_${child._client_id}`}>
                        <button
                          onClick={goToAlerts}
                          className="w-full text-left px-4 py-3 hover:bg-red-50/60 transition-colors flex items-start gap-2.5"
                        >
                          <BellRing className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {child._client_name}
                            </p>
                            <TriggerMeta dateStr={child.last_triggered_at} />
                          </div>
                        </button>
                      </li>
                    ))
                  }

                  // ── Simple alert (no sub-alerts) ──
                  return (
                    <li key={`real_${parentAlert.id}`}>
                      <button
                        onClick={goToAlerts}
                        className="w-full text-left px-4 py-3 hover:bg-red-50/50 transition-colors flex items-start gap-2.5"
                      >
                        <BellRing className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{parentAlert.name}</p>
                          <TriggerMeta dateStr={parentAlert.last_triggered_at} />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
