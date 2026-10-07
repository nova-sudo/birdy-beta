"use client"

import { motion, useReducedMotion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Legend } from "recharts"
import { UserPlus, Layers, Sparkles, Activity } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const EASE = [0.165, 0.84, 0.44, 1]

const CARD = "rounded-xl border border-pd-border bg-pd-surface p-4 shadow-sm"

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
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-pd-primary" />
        <h3 className="font-pd-display text-sm font-semibold text-pd-ink">Live activity</h3>
      </div>
      <div className="space-y-1">
        {(activity || []).length === 0 && (
          <p className="text-sm text-pd-subtle py-4 text-center">No recent activity.</p>
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
              <div className="h-6 w-6 shrink-0 rounded-full bg-pd-primary-tint flex items-center justify-center">
                <Icon className="h-3 w-3 text-pd-primary" />
              </div>
              <span className="text-sm text-pd-body flex-1 min-w-0 truncate">{a.label}</span>
              <span className="text-[11px] text-pd-subtle shrink-0">{relative(a.ts)}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function TopAgencies({ top }) {
  return (
    <div className={CARD}>
      <h3 className="font-pd-display text-sm font-semibold text-pd-ink mb-3">Top agencies by leads</h3>
      <div className="space-y-2.5">
        {(top || []).length === 0 && (
          <p className="text-sm text-pd-subtle py-4 text-center">No data yet.</p>
        )}
        {(top || []).map((a, i) => (
          <div key={a.email} className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-pd-faint w-4">{i + 1}</span>
            <div className="h-7 w-7 rounded-full bg-pd-primary-tint text-pd-primary text-[10px] font-bold flex items-center justify-center">
              {(a.owner || "?").slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-pd-ink flex-1 min-w-0 truncate">{a.owner}</span>
            <span className="font-pd-display text-sm font-semibold tabular-nums text-pd-ink">{a.leads.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={`lg:col-span-2 ${CARD}`}>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-3 h-56 w-full" />
      </div>
      <div className={CARD}>
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
      <div className={`lg:col-span-3 ${CARD}`}>
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StatsPanel({ data, loading }) {
  const reduce = useReducedMotion()

  if (loading) return <PanelSkeleton />

  const d = data || {}
  const growth = d.growth || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={`lg:col-span-2 ${CARD}`}>
        <h3 className="font-pd-display text-sm font-semibold text-pd-ink mb-3">Growth · agencies &amp; sub-accounts</h3>
        <div className="h-56">
          {growth.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#98989E" }} axisLine={{ stroke: "#E7E6E3" }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#EFEEEB" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E7E6E3", fontSize: 12, color: "#18181B" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#98989E" }} />
                <Bar dataKey="agencies" name="Agencies" fill="#5B3FD6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sub_accounts" name="Sub-accounts" fill="#C3B7F2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-pd-subtle">
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
