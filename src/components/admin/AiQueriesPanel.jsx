"use client"

import { motion, useReducedMotion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { Lightbulb, Sparkles, Slack, TrendingUp } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

const EASE = [0.165, 0.84, 0.44, 1]

const CATEGORY_COLORS = {
  performance_roas: "bg-purple-500",
  pause_scale: "bg-rose-500",
  cost_per_lead: "bg-amber-500",
  lead_volume: "bg-emerald-500",
  crm_sync: "bg-sky-500",
  other: "bg-gray-400",
}

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
            <span className="font-medium text-gray-800">{c.label}</span>
            <span className="tabular-nums text-muted-foreground">{c.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
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

export default function AiQueriesPanel({ data, loading, onOpenConversation }) {
  const reduce = useReducedMotion()

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 lg:col-span-1" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    )
  }

  const d = data || {}
  const clusters = d.clusters || []
  const volume = d.volume || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: theme clustering + roadmap signal */}
      <div className="lg:col-span-1 space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold">Top request themes</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Clustered from {(d.total ?? 0).toLocaleString()} queries in the last {d.window_days ?? 7} days — use to guide the roadmap.
          </p>
          {clusters.length ? <ThemeBars clusters={clusters} reduce={reduce} /> : (
            <p className="text-sm text-muted-foreground py-6 text-center">No queries yet.</p>
          )}
        </div>

        {d.roadmap_signal && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-purple-600">Roadmap signal</span>
            </div>
            <p className="text-sm text-purple-900 leading-relaxed">{d.roadmap_signal}</p>
          </div>
        )}
      </div>

      {/* Right: volume chart + recent queries */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold">Query volume · last 14 days</h3>
          </div>
          <div className="h-40">
            {volume.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qvol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice(5)} interval="preserveStartEnd" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #eee", fontSize: 12 }}
                    labelFormatter={(v) => v}
                    formatter={(v) => [v, "queries"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} fill="url(#qvol)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No volume data yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold mb-3">Recent queries</h3>
          <div className="divide-y">
            {(d.recent_queries || []).length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No queries yet.</p>
            )}
            {(d.recent_queries || []).map((q, i) => (
              <button
                key={`${q.session_id}-${i}`}
                onClick={() => onOpenConversation?.(q.session_id)}
                className="w-full text-left py-2.5 flex items-start gap-3 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="h-7 w-7 shrink-0 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">
                  {(q.owner || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">{q.owner}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">{q.category_label}</span>
                    {q.source === "slack" && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><Slack className="h-3 w-3" /> Slack</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{relative(q.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate mt-0.5">&ldquo;{q.content}&rdquo;</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
