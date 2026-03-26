import { Badge } from "@/components/ui/badge"
import { Clock, Zap } from "lucide-react"

export const METRIC_OPTIONS = [
  { value: "lead_count", label: "Lead Count" },
  { value: "spend", label: "Total Spend" },
  { value: "ctr", label: "CTR (%)" },
  { value: "cpc", label: "CPC ($)" },
  { value: "cpm", label: "CPM ($)" },
  { value: "impressions", label: "Impressions" },
  { value: "clicks", label: "Clicks" },
  { value: "roas", label: "ROAS" },
  { value: "roi", label: "ROI" },
]

export const OPERATOR_OPTIONS = [
  { value: "gt", label: "Greater than  (>)" },
  { value: "lt", label: "Less than  (<)" },
  { value: "eq", label: "Equals  (=)" },
  { value: "pct_drop", label: "Drops by  (↓ %)" },
  { value: "pct_rise", label: "Rises by  (↑ %)" },
]

export const PERIOD_OPTIONS = [
  { value: "day", label: "Previous day" },
  { value: "week", label: "Previous week" },
  { value: "month", label: "Previous month" },
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

  const isCurrency = ["spend", "cpc", "cpm"].includes(alert.condition?.metric)
  const isPct = ["ctr", "pct_drop", "pct_rise"].includes(alert.condition?.metric) || ["pct_drop", "pct_rise"].includes(operator)
  const fmt = (v) => {
    if (isCurrency) return `$${Number(v).toFixed(2)}`
    if (isPct) return `${Number(v).toFixed(1)}%`
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
  }

  const barColor = triggered
    ? "bg-red-500"
    : pct >= 80
      ? "bg-orange-400"
      : pct >= 50
        ? "bg-yellow-400"
        : "bg-[#713cdd]/40"

  const opLabel = operator === "gt" ? ">" : operator === "lt" ? "<" : operator === "eq" ? "=" : operator === "pct_drop" ? "↓" : "↑"

  return (
    <div className="space-y-1 min-w-[140px] max-w-[180px]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{fmt(current)}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {triggered
          ? <span className="text-red-500 font-medium">⚡ Triggered</span>
          : `${pct.toFixed(0)}% to trigger`
        }
        <span className="text-muted-foreground">{opLabel} {fmt(threshold)}</span>
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
  metric: "lead_count",
  operator: "pct_drop",
  value: "30",
  period: "week",
  target_group_ids: [],
  notification_channels: ["in_app"],
}
