"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { currencySymbol } from "@/lib/chat-viz"
import { cumulativeRows } from "@/lib/creative-days"
import { scoreTone } from "@/lib/creative-verdict"

// Chart tab → the key its target sits under in `targets.metrics`.
const TARGET_KEY = { cpl: "cpl", ctr: "ctr", hook: "hook_rate", leads: "leads" }

const TONE_COLOR = {
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  muted: "var(--color-subdued)",
}

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatValue(metric, v, currency) {
  if (v == null) return "—"
  if (metric === "cpl") return `${currencySymbol(currency)}${v.toFixed(2)}`
  if (metric === "leads") return String(Math.round(v))
  return `${v.toFixed(1)}%`
}

/** The target to draw: none for the baseline mode, and only CPL in cpl_only. */
export function targetFor(targets, metric) {
  if (!targets || targets.mode === "baseline") return null
  if (targets.mode === "cpl_only" && metric !== "cpl") return null
  const v = targets.metrics?.[TARGET_KEY[metric]]?.value
  return Number.isFinite(Number(v)) && v != null ? Number(v) : null
}

/**
 * One line per ad (cumulative to date), coloured by the ad's score state, with a dashed line at the target.
 * @param {object} props
 * @param {Record<string, object[]>} props.days {meta_ad_id: day rows}
 * @param {object[]} [props.ads] The test's ads, for colour, name and currency
 * @param {object} [props.targets]
 * @param {"cpl"|"ctr"|"hook"|"leads"} props.metric
 * @param {string} props.currency Fallback for an ad with no currency of its own
 */
export function AccountLinesChart({ days, ads = [], targets, metric = "cpl", currency }) {
  const byMeta = React.useMemo(() => Object.fromEntries(ads.map((a) => [a.meta?.ad_id, a])), [ads])
  // Converted the same way as the scores, so a line sits against the target in the user's currency.
  const rates = React.useMemo(
    () => Object.fromEntries(ads.filter((a) => a.meta?.ad_id && a.fx_rate != null).map((a) => [a.meta.ad_id, a.fx_rate])),
    [ads]
  )
  const { rows, adIds } = React.useMemo(() => cumulativeRows(days, metric, rates), [days, metric, rates])
  const target = targetFor(targets, metric)
  const curOf = (id) => byMeta[id]?.currency ?? currency

  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No daily data yet. It appears after the first tracking run.
      </div>
    )
  }

  return (
    <div className="h-40" role="img" aria-label={`${metric} per account over time`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <YAxis hide domain={[0, (max) => Math.max(max, target ?? 0) * 1.1 || 1]} />
          <Tooltip
            formatter={(v, _name, item) => [formatValue(metric, v, curOf(item.dataKey)), byMeta[item.dataKey]?.account_name ?? "Account"]}
            labelFormatter={fmtDate}
          />
          {target != null && <ReferenceLine y={target} stroke="var(--color-muted-foreground)" strokeDasharray="5 5" />}
          {adIds.map((id) => (
            <Line
              key={id}
              dataKey={id}
              type="monotone"
              dot={false}
              connectNulls
              strokeWidth={2}
              stroke={TONE_COLOR[scoreTone(byMeta[id]?.score?.state)] ?? TONE_COLOR.muted}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
