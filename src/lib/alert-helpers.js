import { Badge } from "@/components/ui/badge"
import { Clock, Zap } from "lucide-react"
import { ghlIcon, metaIcon } from "@/lib/icons"

export const METRIC_OPTIONS = [
  // ── Meta Ads metrics ──
  { value: "spend",            label: "Total Spend",           source: "meta", icon: metaIcon },
  { value: "impressions",      label: "Impressions",           source: "meta", icon: metaIcon },
  { value: "clicks",           label: "Clicks",                source: "meta", icon: metaIcon },
  { value: "reach",            label: "Reach",                 source: "meta", icon: metaIcon },
  { value: "ctr",              label: "CTR (%)",               source: "meta", icon: metaIcon },
  { value: "cpc",              label: "CPC ($)",               source: "meta", icon: metaIcon },
  { value: "cpm",              label: "CPM ($)",               source: "meta", icon: metaIcon },
  { value: "meta_leads",       label: "Leads",                 source: "meta", icon: metaIcon },
  { value: "meta_conversion",  label: "Conversion Rate (%)",   source: "meta", icon: metaIcon },
  { value: "cpl",              label: "Cost Per Lead ($)",      source: "meta", icon: metaIcon },
  { value: "cost_per_result",  label: "Cost Per Result ($)",    source: "meta", icon: metaIcon },
  { value: "frequency",        label: "Ad Frequency",          source: "meta", icon: metaIcon },
  // ── GHL metrics ──
  { value: "ghl_leads",        label: "Leads",                 source: "ghl",  icon: ghlIcon },
  { value: "ghl_conversion",   label: "Conversion Rate (%)",   source: "ghl",  icon: ghlIcon },
  { value: "ghl_revenue",      label: "Revenue",               source: "ghl",  icon: ghlIcon },
]

export const TYPE_OPTIONS = [
  { value: "win", label: "Win" },
  { value: "warning", label: "Warning" },
]

export const OPERATOR_OPTIONS = [
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "eq", label: "Equal to" },
  { value: "neq", label: "Not equal to" },
  { value: "pct_rise", label: "Rises by (↑ %)" },
  { value: "pct_drop", label: "Drops by (↓ %)" },
]

export const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "day", label: "Yesterday" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "custom", label: "Custom period" },
]

export const FREQUENCY_OPTIONS = [
  { value: "realtime", label: "Real-time" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
]

export const SNOOZE_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 4, label: "4 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "2 days" },
  { value: 168, label: "1 week" },
]

export function formatRelative(date) {
  if (!date) return "—"
  const diff = date - new Date()
  const absDiff = Math.abs(diff)
  const mins = Math.round(absDiff / 60000)
  const hours = Math.round(absDiff / 3600000)
  const days = Math.round(absDiff / 86400000)

  if (diff > 0) {
    if (days > 1) return `in ${days} days`
    if (hours > 1) return `in ${hours} hours`
    return `in ${mins} minutes`
  } else {
    if (days > 1) return `${days} days ago`
    if (hours > 1) return `${hours} hours ago`
    if (mins > 0) return `${mins} minutes ago`
    return "just now"
  }
}

export function conditionSummary(alert) {
  const { condition } = alert
  if (!condition) return "—"
  const op = condition.operator
  const val = condition.value

  if (op === "pct_drop") return `↓ ${val}%  vs ${condition.period || "week"}`
  if (op === "pct_rise") return `↑ ${val}%  vs ${condition.period || "week"}`
  if (op === "gt") return `> ${val}`
  if (op === "lt") return `< ${val}`
  if (op === "eq") return `= ${val}`
  if (op === "neq") return `≠ ${val}`
  return `${op} ${val}`
}

export function statusBadge(status, snoozedUntil) {
  if (status === "active")
    return <Badge className="bg-[#713cdd] text-white border-0 rounded-full text-xs font-semibold hover:bg-primary/80 px-2.5 py-0.5">Active</Badge>
  if (status === "triggered")
    return <Badge className="bg-[#EF4343] text-white border-0 rounded-full text-xs font-semibold px-2.5 py-0.5">Triggered</Badge>
  if (status === "paused") {
    const snoozeLabel = snoozedUntil
      ? `Until ${formatRelative(new Date(snoozedUntil))}`
      : "Paused"
    return (
      <div>
        <Badge className="bg-[#FFEDD5] text-[#9A3412] border-0 rounded-full text-xs font-semibold px-2.5 py-0.5">Snoozed</Badge>
        {snoozedUntil && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />{snoozeLabel}
          </span>
        )}
      </div>
    )
  }
  return <Badge variant="outline">{status}</Badge>
}

export function ProgressToTrigger({ alert }) {
  const pct = alert.progress_pct ?? 0
  const current = alert.current_value ?? null
  const threshold = alert.condition?.value
  const operator = alert.condition?.operator
  const triggered = alert.status === "triggered"

  if (current === null || current === undefined) {
    return <span className="text-xs text-muted-foreground italic">Not evaluated yet</span>
  }

  const isPctOperator = ["pct_drop", "pct_rise"].includes(operator)
  const isCurrency = !isPctOperator && ["spend", "cpc", "cpm", "cpl", "cost_per_result", "ghl_revenue"].includes(alert.condition?.metric)
  const isPct = isPctOperator || ["ctr", "meta_conversion", "ghl_conversion"].includes(alert.condition?.metric)
  const fmt = (v, forceType) => {
    // For pct operators: current_value is always a % change, threshold is always a %
    if (forceType === "pct" || isPct) return `${Number(v).toFixed(1)}%`
    if (forceType === "currency" || isCurrency) return `$${Number(v).toFixed(2)}`
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
  }
  // For pct operators the threshold is a percentage, but display it as %
  const fmtThreshold = (v) => {
    if (isPctOperator) return `${Number(v).toFixed(1)}%`
    return fmt(v)
  }

  const barColor = triggered
    ? "bg-red-500"
    : pct >= 80
      ? "bg-orange-400"
      : pct >= 50
        ? "bg-yellow-400"
        : "bg-[#713cdd]/40"

  const opLabel = operator === "gt" ? ">" : operator === "lt" ? "<" : operator === "eq" ? "=" : operator === "neq" ? "≠" : operator === "pct_drop" ? "↓" : "↑"

  return (
    <div className="space-y-1 min-w-[140px] max-w-[180px]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{fmt(current)}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {triggered
          ? <span className="text-red-500 font-medium">⚡ Triggered</span>
          : `${Math.max(0, pct).toFixed(0)}% to trigger`
        }
        <span className="text-muted-foreground"> {opLabel} {fmtThreshold(threshold)}</span>
      </div>
    </div>
  )
}

export function metricIcon(metricValue) {
  const found = METRIC_OPTIONS.find(m => m.value === metricValue)
  if (!found) return <Zap className="h-4 w-4" />
  return <Zap className="h-4 w-4" />
}

export const EMPTY_FORM = {
  name: "",
  description: "",
  type: "warning",
  metric: "spend",
  operator: "gt",
  value: "0",
  period: "day",
  target_group_ids: [],
  notification_channels: ["in_app"],
  frequency: "daily",
}
