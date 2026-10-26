"use client"

import { MetricGroup } from "@/components/ds"

/**
 * The five platform KPIs across the top of the Admin console, as one ds
 * MetricGroup. While loading the labels stay and each figure is a skeleton, so
 * the group keeps its final shape and nothing shifts when the numbers land.
 */
export default function AdminStatStrip({ kpis, loading }) {
  const k = kpis || {}
  const fmt = (n) => (n ?? 0).toLocaleString()
  const activePct = k.agencies ? Math.round((k.weekly_active / k.agencies) * 100) : 0

  const tiles = [
    { label: "Agencies", value: fmt(k.agencies) },
    { label: "Active users", value: fmt(k.weekly_active), caption: `${activePct}% weekly active` },
    { label: "Sub-accounts", value: fmt(k.sub_accounts) },
    { label: "Leads managed", value: fmt(k.leads) },
    { label: "AI queries (7d)", value: fmt(k.ai_queries_7d), caption: `${fmt(k.ai_queries_total)} all-time` },
  ]

  return <MetricGroup title="Platform" loading={loading} items={tiles.map((t) => ({ key: t.label, ...t }))} />
}
