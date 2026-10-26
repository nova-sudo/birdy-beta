"use client"

import { motion, useReducedMotion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Legend } from "recharts"
import { UserPlus, Layers, Sparkles, Activity } from "lucide-react"
import { BarList, ErrorState, Skeleton, Surface } from "@/components/ds"

const EASE = [0.165, 0.84, 0.44, 1]

const ACTIVITY_ICON = {
  signup: UserPlus,
  sub_account: Layers,
  ai_query: Sparkles,
}

// Agencies in the brand colour, sub-accounts a lighter mix of it so the pair
// reads as one series family.
const AGENCIES_FILL = "var(--color-primary)"
const SUB_ACCOUNTS_FILL = "color-mix(in oklab, var(--color-primary) 40%, white)"

function relative(ts) {
  if (!ts) return ""
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return "" }
}

function LiveActivityFeed({ activity, reduce }) {
  return (
    <Surface>
      <h3 className="mb-3 text-sm font-medium text-body">Live activity</h3>
      <div className="space-y-1">
        {(activity || []).length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No recent activity.</p>
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
              <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{relative(a.ts)}</span>
            </motion.div>
          )
        })}
      </div>
    </Surface>
  )
}

function TopAgencies({ top }) {
  return (
    <BarList
      title="Top agencies by leads"
      empty="No data yet."
      rows={(top || []).map((a) => ({ key: a.email, label: a.owner, value: a.leads, display: a.leads.toLocaleString() }))}
    />
  )
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Surface className="lg:col-span-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-3 h-56 w-full" />
      </Surface>
      <Surface>
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-control-sm w-full rounded-full" />
          ))}
        </div>
      </Surface>
      <Surface className="lg:col-span-3">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1">
              <Skeleton className="size-7" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </Surface>
    </div>
  )
}

export default function StatsPanel({ data, loading, error, onRetry }) {
  const reduce = useReducedMotion()

  if (loading) return <PanelSkeleton />
  if (error && !data) {
    return (
      <Surface>
        <ErrorState title="Couldn't load platform stats" onRetry={onRetry} />
      </Surface>
    )
  }

  const d = data || {}
  const growth = d.growth || []

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-3">
        <LiveActivityFeed activity={d.activity} reduce={reduce} />
      </div>

      <Surface className="lg:col-span-2">
        <h3 className="mb-3 text-sm font-medium text-body">Growth · agencies &amp; sub-accounts</h3>
        <div className="h-56">
          {growth.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 13,
                    color: "var(--color-foreground)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} />
                <Bar dataKey="agencies" name="Agencies" fill={AGENCIES_FILL} radius={[4, 4, 0, 0]} />
                <Bar dataKey="sub_accounts" name="Sub-accounts" fill={SUB_ACCOUNTS_FILL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No growth data yet.
            </div>
          )}
        </div>
      </Surface>

      <TopAgencies top={d.top_agencies} />
    </div>
  )
}
