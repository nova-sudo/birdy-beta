/**
 * One formatter for every stat cell, so the same figure reads the same on every card.
 * Strings and nodes (already formatted, a placeholder) pass through untouched.
 *
 * @param {number|React.ReactNode} value
 * @param {{format?: "number"|"percent"|"duration"|"currency"|"string", currency?: string}} [spec]
 */
export function formatMetricValue(value, spec = {}) {
  if (typeof value !== "number") return value

  switch (spec.format) {
    case "currency":
      return new Intl.NumberFormat("en-GB", { style: "currency", currency: spec.currency ?? "GBP" }).format(value)
    case "percent":
      return `${value.toFixed(1)}%`
    case "duration": {
      const minutes = Math.floor(value / 60)
      const seconds = Math.floor(value % 60)
      return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }
    case "number":
    default:
      return new Intl.NumberFormat("en-GB").format(value)
  }
}
