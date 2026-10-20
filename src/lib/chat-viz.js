/**
 * The data side of the chat's inline visuals (:::chart, :::metric, :::stats).
 *
 * The backend's render_ui tool writes these payloads (birdy-backend
 * ai/tools/render_ui_tools.py); older replies carry the hand-typed shapes the
 * model used to emit, so every reader here accepts both. Kept apart from the
 * components so the shaping is testable without drawing a chart.
 */

import { formatCompact, formatMetric } from "@/lib/format-metric"
import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics"

// Violet first, then the hues the hubs already use for their own series.
export const SERIES_COLORS = [
  "var(--pd-primary)",
  "var(--pd-info)",
  "var(--pd-amber)",
  "var(--pd-success)",
  "var(--pd-danger)",
  "var(--pd-primary-light)",
]

/** Full reading of one value, for tooltips, labels and table cells. */
export function formatValue(value, format = "integer", currency) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–"
  const num = Number(value)
  if (format === "currency") {
    const cur = currency || "$"
    // Pence matter on a £14.20 CPL; they're noise on £12,480 of spend.
    return Math.abs(num) >= 1000
      ? `${num < 0 ? "-" : ""}${cur}${Math.round(Math.abs(num)).toLocaleString()}`
      : formatMetric(num, "currency", cur)
  }
  if (format === "percentage") return `${num.toFixed(Math.abs(num) >= 100 ? 0 : 1)}%`
  if (format === "decimal") return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return formatMetric(num, format, currency || "$")
}

/** Short reading for an axis tick. */
export function formatTick(value, format = "integer", currency) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ""
  if (format === "percentage") return `${formatCompact(num)}%`
  if (format === "multiplier") return `${num.toFixed(1)}x`
  if (format === "decimal" && Math.abs(num) < 10) return num.toFixed(1)
  if (format === "currency") return `${currency || "$"}${Math.abs(num) < 10 && num % 1 ? num.toFixed(1) : formatCompact(num)}`
  return formatCompact(num)
}

/**
 * A :::chart payload → everything the chart component draws.
 *
 * @returns {{kind: "line"|"area"|"bar"|"composed"|"donut", title?: string, subtitle?: string,
 *   rows: object[], series: object[], horizontal: boolean, multi: boolean, total: number} | null}
 */
export function shapeChart(payload) {
  if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) return null
  const type = ["line", "area", "bar", "composed", "donut"].includes(payload.type) ? payload.type : "bar"
  const fmt = payload.format || (payload.currency ? "currency" : "integer")
  const series = shapeSeries(payload, type, fmt)
  const multi = series.length > 1

  let rows = payload.data.map((d) => {
    const row = { label: String(d?.label ?? d?.name ?? "") }
    for (const s of series) {
      const raw = multi ? d?.[s.key] : (d?.value ?? d?.[s.key])
      row[s.key] = raw === null || raw === undefined || raw === "" ? null : Number(raw)
    }
    return row
  })

  const single = series[0]
  const timeLike = type === "line" || type === "area" || type === "composed"
  if (!multi) {
    if (type === "bar") rows = rows.filter((r) => r[single.key] !== 0 && r[single.key] !== null)
    if (type === "donut") rows = rows.filter((r) => r[single.key] > 0)
    const sort = payload.sort ?? !timeLike
    if (sort && !timeLike) rows = [...rows].sort((a, b) => (b[single.key] ?? 0) - (a[single.key] ?? 0))
  }
  if (rows.length === 0) return null

  const longest = rows.reduce((m, r) => Math.max(m, r.label.length), 0)
  const orientation = payload.orientation || "auto"
  const horizontal = !multi && type === "bar" && (
    orientation === "horizontal" || (orientation === "auto" && (rows.length > 6 || longest > 14))
  )
  const total = !multi ? rows.reduce((sum, r) => sum + (r[single.key] ?? 0), 0) : 0

  return {
    // Several series always draw on one composed chart: it mixes bars, lines
    // and areas and carries the right-hand axis.
    kind: multi ? "composed" : type === "composed" ? "line" : type,
    title: payload.title || null,
    subtitle: payload.subtitle || null,
    rows,
    series,
    multi,
    horizontal,
    total,
  }
}

function shapeSeries(payload, type, fmt) {
  const fallbackCurrency = payload.currency
  const defaultType = type === "bar" ? "bar" : type === "area" ? "area" : "line"
  if (Array.isArray(payload.series) && payload.series.length > 0) {
    return payload.series.map((s, i) => ({
      key: s.key,
      name: s.name || s.key,
      type: ["line", "bar", "area"].includes(s.type) ? s.type : defaultType,
      axis: s.axis === "right" ? "right" : "left",
      format: s.format || (s.currency ? "currency" : fmt),
      currency: s.currency || fallbackCurrency,
      color: s.color || SERIES_COLORS[i % SERIES_COLORS.length],
    }))
  }
  // Rows with several numeric keys and no series list: the older hand-typed shape.
  const first = payload.data[0] || {}
  const keys = Object.keys(first).filter((k) => !["label", "name", "value"].includes(k) && typeof first[k] === "number")
  if (keys.length > 1) {
    return keys.map((k, i) => ({
      key: k,
      name: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
      type: defaultType,
      axis: i === 0 ? "left" : "right",
      format: fmt,
      currency: fallbackCurrency,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }))
  }
  return [{
    key: "value",
    name: payload.seriesName || payload.title || "Value",
    type: defaultType,
    axis: "left",
    format: fmt,
    currency: fallbackCurrency,
    color: payload.color || SERIES_COLORS[0],
  }]
}

/**
 * The delta pill for a KPI, or null when there's nothing to compare.
 * render_ui sends a percent change (`deltaPct`) and a polarity; older replies
 * sent an absolute `delta` in the metric's own unit.
 */
export function shapeDelta(kpi) {
  if (!kpi) return null
  const polarity = kpi.polarity === "lower" ? LOWER_IS_BETTER : HIGHER_IS_BETTER
  const pct = toNumber(kpi.deltaPct)
  if (pct !== null) {
    if (pct === 0) return { direction: null, value: "0%", polarity, label: kpi.deltaLabel || null }
    const abs = Math.abs(pct)
    return {
      direction: pct > 0 ? "up" : "down",
      value: `${abs >= 100 ? Math.round(abs) : abs.toFixed(1).replace(/\.0$/, "")}%`,
      polarity,
      label: kpi.deltaLabel || null,
    }
  }
  const abs = toNumber(kpi.delta)
  if (abs === null) return null
  if (abs === 0) return { direction: null, value: "0", polarity, label: kpi.deltaLabel || null }
  return {
    direction: abs > 0 ? "up" : "down",
    value: formatValue(Math.abs(abs), kpi.format || "integer", kpi.currency),
    polarity,
    label: kpi.deltaLabel || null,
  }
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
