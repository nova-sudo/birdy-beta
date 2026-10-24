"use client"

import { useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts"
import { BarList, Badge, DataTable, EmptyState, ErrorState, Notice, Skeleton, Surface } from "@/components/ds"

function relative(ts) {
  if (!ts) return ""
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return "" }
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Surface>
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-control-sm w-full rounded-full" />
            ))}
          </div>
        </Surface>
        <Surface>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-40 w-full" />
        </Surface>
      </div>
      <Skeleton className="h-64 w-full rounded-surface" />
    </div>
  )
}

const QUERY_COLUMNS = [
  {
    id: "question",
    accessorFn: (q) => q.content,
    header: "Question",
    meta: { label: "questions", variant: "text", minWidth: 280 },
    cell: ({ row }) => (
      <span className="block max-w-md truncate text-sm text-foreground">&ldquo;{row.original.content}&rdquo;</span>
    ),
  },
  {
    id: "owner",
    accessorFn: (q) => q.owner,
    header: "Owner",
    meta: { label: "Owner" },
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.owner}</span>,
  },
  {
    id: "theme",
    accessorFn: (q) => q.category_label,
    header: "Theme",
    meta: { label: "Theme" },
    cell: ({ row }) => (row.original.category_label ? <Badge tone="primary">{row.original.category_label}</Badge> : null),
  },
  {
    id: "source",
    accessorFn: (q) => (q.source === "slack" ? "Slack" : "App"),
    header: "Source",
    meta: { label: "Source" },
    cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue()}</span>,
  },
  {
    id: "asked",
    accessorFn: (q) => (q.created_at ? new Date(q.created_at).getTime() : 0),
    header: "Asked",
    meta: { label: "Asked" },
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{relative(row.original.created_at)}</span>,
  },
]

export default function AiQueriesPanel({ data, loading, error, onRetry, onOpenConversation }) {
  const d = data || {}
  const clusters = d.clusters || []
  const volume = d.volume || []
  const recent = useMemo(() => d.recent_queries || [], [d.recent_queries])

  if (loading) return <PanelSkeleton />
  if (error && !data) {
    return (
      <Surface>
        <ErrorState title="Couldn't load AI queries" onRetry={onRetry} />
      </Surface>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: theme clustering + roadmap signal */}
        <div className="flex flex-col gap-3">
          {clusters.length ? (
            <BarList
              title="Top request themes"
              meta={`${(d.total ?? 0).toLocaleString()} queries`}
              rows={clusters.map((c) => ({ key: c.category, label: c.label, value: c.pct, display: `${c.pct}%` }))}
            />
          ) : (
            <Surface>
              <h3 className="text-sm font-medium text-body">Top request themes</h3>
              <p className="py-6 text-center text-sm text-muted-foreground">No queries yet.</p>
            </Surface>
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Clustered from {(d.total ?? 0).toLocaleString()} queries in the last {d.window_days ?? 7} days — use to guide the roadmap.
          </p>
          {d.roadmap_signal && (
            <Notice title="Roadmap signal" className="bg-primary-soft text-primary">
              {d.roadmap_signal}
            </Notice>
          )}
        </div>

        {/* Right: volume chart */}
        <Surface className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-body">Query volume · last 14 days</h3>
          <div className="h-40">
            {volume.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qvol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                    tickFormatter={(v) => v?.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      fontSize: 13,
                      color: "var(--color-foreground)",
                    }}
                    labelFormatter={(v) => v}
                    formatter={(v) => [v, "queries"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} fill="url(#qvol)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No volume data yet.</div>
            )}
          </div>
        </Surface>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-base font-semibold text-foreground">Recent queries</h3>
        <DataTable
          columns={QUERY_COLUMNS}
          data={recent}
          pageSize={10}
          getRowId={(q, i) => `${q.session_id}-${i}`}
          onRowClick={(q) => onOpenConversation?.(q.session_id)}
          empty={<EmptyState title="No queries yet." />}
        />
      </section>
    </div>
  )
}
