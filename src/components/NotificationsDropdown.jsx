"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, BellRing, X, ExternalLink, User, ChevronDown, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiRequest } from "@/lib/api"
import { formatRelative } from "@/lib/alert-helpers"
import Link from "next/link"

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
  const [expanded, setExpanded] = useState({})
  const ref = useRef(null)
  const router = useRouter()

  const groups = groupTriggeredRows(alerts)
  // Badge count: number of top-level groups (parent alerts)
  const badgeCount = groups.length

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

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const goToAlerts = () => {
    setOpen(false)
    router.push("/alerts?tab=triggered")
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-1.5 rounded-full hover:bg-gray-100 transition"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-black" />
        {badgeCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-84 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden" style={{ width: 340 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-sm">Notifications</span>
              {badgeCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {badgeCount}
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
                  const isOpen = expanded[parentAlert.id]

                  return (
                    <li key={`${parentAlert._isGroup ? "group" : "real"}_${parentAlert.id}`}>
                      {/* Parent row — clickable, redirects to alerts page */}
                      <button
                        onClick={hasChildren ? () => toggleExpand(parentAlert.id) : goToAlerts}
                        className="w-full text-left px-4 py-3 hover:bg-red-50/50 transition-colors flex items-start gap-2.5"
                      >
                        <BellRing className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{parentAlert.name}</p>
                            {hasChildren && (
                              <span className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0">
                                <span className="bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                                  {children.length}
                                </span>
                                {isOpen
                                  ? <ChevronDown className="w-3.5 h-3.5" />
                                  : <ChevronRight className="w-3.5 h-3.5" />}
                              </span>
                            )}
                          </div>
                          <TriggerMeta dateStr={parentAlert.last_triggered_at} />
                        </div>
                      </button>

                      {/* Sub-alert rows (per-client children) */}
                      {hasChildren && isOpen && (
                        <ul className="bg-red-50/30 border-t border-red-100">
                          {children.map((child) => (
                            <li key={child._virtual_id ?? `${child.id}_${child._client_id}`}>
                              <button
                                onClick={goToAlerts}
                                className="w-full text-left px-4 py-2.5 hover:bg-red-50/70 transition-colors flex items-start gap-2.5"
                              >
                                {/* indent line */}
                                <div className="flex items-start gap-2 pl-5 w-full min-w-0">
                                  <div className="w-0.5 self-stretch rounded-full bg-red-300 shrink-0 mt-0.5" />
                                  <User className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-red-900 truncate">
                                      {child._client_name}
                                    </p>
                                    <TriggerMeta dateStr={child.last_triggered_at} />
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              href="/alerts?tab=triggered"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              View all alerts
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
