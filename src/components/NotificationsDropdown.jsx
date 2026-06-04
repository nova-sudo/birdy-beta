"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, BellRing, X, ExternalLink } from "lucide-react"
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

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // alerts state holds only the triggered list
  const triggered = alerts

  useEffect(() => {
    if (!open) return
    setLoading(true)
    apiRequest("/api/alerts")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        // API returns { active: [], triggered: [], paused: [], counts: {} }
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

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-1.5 rounded-full hover:bg-gray-100 transition"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-black" />
        {triggered.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-sm">Notifications</span>
              {triggered.length > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {triggered.length}
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
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : triggered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-muted-foreground">No triggered alerts</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {triggered.map((alert) => {
                  const trigger = formatTriggerDate(alert.last_triggered_at)
                  return (
                    <li key={alert.id} className="px-4 py-3 hover:bg-red-50/50 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <BellRing className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{alert.name}</p>
                          {trigger ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-red-500 font-medium">{trigger.relative}</span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-400" title={trigger.absolute}>
                                {trigger.absolute}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">Trigger date unknown</p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              href="/alerts"
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
