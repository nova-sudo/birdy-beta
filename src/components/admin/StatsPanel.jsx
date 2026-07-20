"use client"

import { motion, useReducedMotion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Legend } from "recharts"
import { UserPlus, Layers, Sparkles, Activity } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const EASE = [0.165, 0.84, 0.44, 1]

const ACTIVITY_ICON = {
  signup: UserPlus,
  sub_account: Layers,
  ai_query: Sparkles,
}

function relative(ts) {
  if (!ts) return ""
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return "" }
}

function LiveActivityFeed({ activity, reduce }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-purple-600" />
        <h3 className="text-sm font-semibold">Live activity</h3>
      </div>
      <div className="space-y-1">
        {(activity || []).length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
        )}
        {(activity || []).map((a, i) => {
          const Icon = ACTIVITY_ICON[a.type] || Activity
          return (
            <motion.div
              key={`${a.type}-${i}`}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: EASE, delay: reduce ? 0 : i * 0.03 }}
              className="flex items-center gap-2.5 py-1.5"
            >
              <div className="h-6 w-6 shrink-0 rounded-full bg-purple-50 flex items-center justify-center">
                <Icon className="h-3 w-3 text-purple-600" />
              </div>
              <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{a.label}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{relative(a.ts)}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function TopAgencies({ top }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-sm font-semibold mb-3">Top agencies by leads</h3>
      <div className="space-y-2.5">
        {(top || []).length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
        )}
        {(top || []).map((a, i) => (
          <div key={a.email} className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
            <div className="h-7 w-7 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">
              {(a.owner || "?").slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{a.owner}</span>
            <span className="text-sm font-semibold tabular-nums">{a.leads.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPanel({ data, loading }) {
  const reduce = useReducedMotion()

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const d = data || {}
  const growth = d.growth || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl border bg-white p-4">
        <h3 className="text-sm font-semibold mb-3">Growth · agencies &amp; sub-accounts</h3>
        <div className="h-56">
          {growth.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #eee", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="agencies" name="Agencies" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sub_accounts" name="Sub-accounts" fill="#C4B5FD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No growth data yet.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <TopAgencies top={d.top_agencies} />
      </div>

      <div className="lg:col-span-3">
        <LiveActivityFeed activity={d.activity} reduce={reduce} />
      </div>
    </div>
  )
}
