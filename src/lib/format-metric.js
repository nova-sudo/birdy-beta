/**
 * Shared metric formatting helpers used across the chat UI.
 * Keeps number display consistent with the rest of the app.
 */

export function formatMetric(value, format = "integer", currencySymbol = "$") {
  if (value === null || value === undefined || value === "") return "–"
  const num = typeof value === "number" ? value : parseFloat(value)
  if (!Number.isFinite(num)) return "–"

  switch (format) {
    case "currency":
      return `${currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case "currency_compact":
      return `${currencySymbol}${formatCompact(num)}`
    case "percentage":
      return `${num.toFixed(2)}%`
    case "decimal":
      return num.toFixed(2)
    case "compact":
      return formatCompact(num)
    case "integer":
    default:
      return Math.round(num).toLocaleString()
  }
}

/** Format 12345 -> "12.3K", 1234567 -> "1.2M" */
export function formatCompact(n) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return Math.round(n).toLocaleString()
}

/** Return {label, variant, sign} for a delta relative to a baseline. */
export function formatDelta(delta, format = "integer", currencySymbol = "$") {
  if (delta === null || delta === undefined) return null
  const num = typeof delta === "number" ? delta : parseFloat(delta)
  if (!Number.isFinite(num) || num === 0) return { label: "0", variant: "neutral", sign: "" }

  const sign = num > 0 ? "+" : "−"
  const abs = Math.abs(num)
  const formatted = format === "percentage"
    ? `${abs.toFixed(2)}%`
    : format === "currency"
      ? `${currencySymbol}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : formatCompact(abs)

  return {
    label: `${sign}${formatted}`,
    variant: num > 0 ? "positive" : "negative",
    sign,
  }
}
