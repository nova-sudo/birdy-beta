"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Building2, Users, Layers, ListChecks, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The five platform KPI tiles across the top of the Admin console (design 1a).
 * Values fade+rise in on load — purpose: spatial "here's your snapshot"; kept
 * fast (200ms, ease-out-quart) since this is a frequently-seen surface.
 */
const EASE = [0.165, 0.84, 0.44, 1]

function StatTile({ icon: Icon, label, value, sub, loading, index, reduce }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE, delay: reduce ? 0 : index * 0.04 }}
      className="flex-1 min-w-[150px] rounded-xl border bg-white px-4 py-3"
    >
      <div className="flex items-center gap-2 text-[#71658B]">
        <Icon className="h-3.5 w-3.5 text-purple-600" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-16" />
      ) : (
        <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      )}
      {sub && !loading && <div className="text-[11px] text-[#71658B]">{sub}</div>}
    </motion.div>
  )
}

export default function AdminStatStrip({ kpis, loading }) {
  const reduce = useReducedMotion()
  const k = kpis || {}
  const fmt = (n) => (n ?? 0).toLocaleString()
  const activePct = k.agencies ? Math.round((k.weekly_active / k.agencies) * 100) : 0

  const tiles = [
    { icon: Building2, label: "Agencies", value: fmt(k.agencies) },
    { icon: Users, label: "Active users", value: fmt(k.weekly_active), sub: `${activePct}% weekly active` },
    { icon: Layers, label: "Sub-accounts", value: fmt(k.sub_accounts) },
    { icon: ListChecks, label: "Leads managed", value: fmt(k.leads) },
    { icon: Sparkles, label: "AI queries (7d)", value: fmt(k.ai_queries_7d), sub: `${fmt(k.ai_queries_total)} all-time` },
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {tiles.map((t, i) => (
        <StatTile key={t.label} {...t} loading={loading} index={i} reduce={reduce} />
      ))}
    </div>
  )
}
