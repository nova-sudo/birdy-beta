"use client"

import { motion, useReducedMotion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { Lightbulb, Sparkles, Slack, TrendingUp } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Stagger, StaggerItem } from "@/components/motion"

const EASE = [0.165, 0.84, 0.44, 1]

const CATEGORY_COLORS = {
  performance_roas: "bg-pd-primary",
  pause_scale: "bg-pd-danger",
  cost_per_lead: "bg-pd-warning",
  lead_volume: "bg-pd-success",
  crm_sync: "bg-pd-info",
  other: "bg-pd-faint",
}

const CARD = "rounded-xl border border-pd-border bg-pd-surface p-4 shadow-sm"

function relative(ts) {
  if (!ts) return ""
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return "" }
}

function ThemeBars({ clusters, reduce }) {
  return (
    <div className="space-y-3">
      {clusters.map((c, i) => (
        <div key={c.category}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-pd-ink">{c.label}</span>
            <span className="tabular-nums text-pd-subtle">{c.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-pd-divider overflow-hidden">
            <motion.div
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${c.pct}%` }}
              transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : i * 0.05 }}
              className={`h-full rounded-full ${CATEGORY_COLORS[c.category] || CATEGORY_COLORS.other}`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={`lg:col-span-1 ${CARD}`}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-full" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-8" />
              </div>
              <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <div className={CARD}>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-40 w-full" />
        </div>
        <div className={CARD}>
          <Skeleton className="h-4 w-32" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AiQueriesPanel({ data, loading, onOpenConversation }) {
  const reduce = useReducedMotion()

  if (loading) return <PanelSkeleton />

  const d = data || {}
  const clusters = d.clusters || []
  const volume = d.volume || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: theme clustering + roadmap signal */}
      <div className="lg:col-span-1 space-y-4">
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-pd-primary" />
            <h3 className="font-pd-display text-sm font-semibold text-pd-ink">Top request themes</h3>
          </div>
          <p className="text-xs text-pd-subtle mb-4">
            Clustered from {(d.total ?? 0).toLocaleString()} queries in the last {d.window_days ?? 7} days — use to guide the roadmap.
          </p>
          {clusters.length ? <ThemeBars clusters={clusters} reduce={reduce} /> : (
            <p className="text-sm text-pd-subtle py-6 text-center">No queries yet.</p>
          )}
        </div>

        {d.roadmap_signal && (
          <div className="rounded-xl border border-pd-primary-pale bg-pd-primary-tint p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-pd-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-pd-primary">Roadmap signal</span>
            </div>
            <p className="text-sm text-pd-ink leading-relaxed">{d.roadmap_signal}</p>
          </div>
        )}
      </div>

      {/* Right: volume chart + recent queries */}
      <div className="lg:col-span-2 space-y-4">
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-pd-primary" />
            <h3 className="font-pd-display text-sm font-semibold text-pd-ink">Query volume · last 14 days</h3>
          </div>
          <div className="h-40">
            {volume.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qvol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B3FD6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#5B3FD6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#98989E" }}
                    axisLine={{ stroke: "#E7E6E3" }}
                    tickLine={false}
                    tickFormatter={(v) => v?.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #E7E6E3", fontSize: 12, color: "#18181B" }}
                    labelFormatter={(v) => v}
                    formatter={(v) => [v, "queries"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#5B3FD6" strokeWidth={2} fill="url(#qvol)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-pd-subtle">No volume data yet.</div>
            )}
          </div>
        </div>

        <div className={CARD}>
          <h3 className="font-pd-display text-sm font-semibold text-pd-ink mb-3">Recent queries</h3>
          <Stagger gap={0.04} className="divide-y divide-pd-divider">
            {(d.recent_queries || []).length === 0 && (
              <p className="text-sm text-pd-subtle py-6 text-center">No queries yet.</p>
            )}
            {(d.recent_queries || []).map((q, i) => (
              <StaggerItem key={`${q.session_id}-${i}`}>
                <button
                  onClick={() => onOpenConversation?.(q.session_id)}
                  className="w-full text-left py-2.5 flex items-start gap-3 hover:bg-pd-table-head rounded-xl px-2 -mx-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                >
                  <div className="h-7 w-7 shrink-0 rounded-full bg-pd-primary-tint text-pd-primary text-[10px] font-bold flex items-center justify-center">
                    {(q.owner || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-pd-ink">{q.owner}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-pd-primary">{q.category_label}</span>
                      {q.source === "slack" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-pd-subtle"><Slack className="h-3 w-3" /> Slack</span>
                      )}
                      <span className="text-[10px] text-pd-subtle ml-auto">{relative(q.created_at)}</span>
                    </div>
                    <p className="text-sm text-pd-body truncate mt-0.5">&ldquo;{q.content}&rdquo;</p>
                  </div>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </div>
  )
}
