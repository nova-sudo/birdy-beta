/**
 * Custom metrics management for campaign analytics
 * Handles loading, evaluating, and formatting custom metric formulas
 */
export const METRIC_ID_TO_DATA_KEY = {
  // Clients dashboard (GoHighLevel & Meta Ads)
  leads: "ghl_contacts",
  bookings: "bookings",
  "total-revenue": "total_revenue",
  "upsell-revenue": "upsell_revenue",
  "ad-spend": "meta_spend",
  cpl: "meta_cpl",
  // Campaigns dashboard (Facebook/Meta - Campaigns, Ad Sets, Ads)
  // Note: For campaigns data, most fields use their direct names
  spend: "spend",
  impressions: "impressions",
  clicks: "clicks",
  cpc: "cpc",
  reach: "reach",
  ctr: "ctr",
  frequency: "frequency",
  cpm: "cpm",
  "campaign-results": "results",
  "campaign-leads": "leads", // Maps campaign-leads to the "leads" field in the data
  // Contacts page
  "lead-value": "leadValue",
}

// Load custom metrics from localStorage
export function loadCustomMetrics() {
  try {
    const stored = localStorage.getItem("customMetrics")
    console.log("Loading custom metrics from localStorage:", stored)
    if (!stored) return []
    const metrics = JSON.parse(stored)
    console.log("Parsed custom metrics:", metrics)
    return Array.isArray(metrics) ? metrics : []
  } catch (err) {
    console.error("Failed to load custom metrics:", err)
    return []
  }
}

// Get custom metric by ID
export function getCustomMetricById(metricId) {
  const customMetrics = loadCustomMetrics()
  return customMetrics.find(m => m.id === metricId)
}

// Get display name for a metric (handles both standard and custom metrics)
export function getMetricDisplayName(metricId) {
  const customMetric = getCustomMetricById(metricId)
  if (customMetric) {
    return customMetric.name
  }
  
  // Fallback to formatting the ID
  return metricId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function evaluateFormula(formulaParts, rowData) {
  if (!formulaParts?.length) {
    return 0
  }
  
  let expression = ""
  
  for (const part of formulaParts) {
    if (part.type === "metric") {
      // First try the metric ID directly (this works for campaigns data)
      let value = rowData[part.value]
      
      // If not found, try the mapped data key
      if (value === undefined || value === null) {
        const dataKey = METRIC_ID_TO_DATA_KEY[part.value]
        if (dataKey) {
          value = rowData[dataKey]
        }
      }
      
      // Default to 0 if still not found
      value = value ?? 0
      
      expression += value
    } else if (part.type === "operator") {
      expression += ` ${part.value} `
    }
  }
  
  try {
    // Use Function constructor instead of eval for safer evaluation
    const result = new Function(`return ${expression}`)()
    return isNaN(result) ? 0 : Number(result)
  } catch (e) {
    console.error("Formula evaluation error:", e, "Expression:", expression, "RowData:", rowData)
    return 0
  }
}

// Format a metric value for display
export function formatMetricValue(value, metricId) {
  if (value === null || value === undefined) return "-"
  if (typeof value !== "number") {
    const parsed = parseFloat(value)
    if (isNaN(parsed)) return "-"
    value = parsed
  }
  
  // Check if it's a currency metric
  if (
    metricId.includes("revenue") ||
    metricId.includes("spend") ||
    metricId.includes("cpl") ||
    metricId.includes("cpc") ||
    metricId.includes("cpm") ||
    metricId.includes("value")
  ) {
    return `$${value.toFixed(2)}`
  }
  
  // Check if it's a percentage metric
  if (metricId.includes("ratio") || metricId.includes("ctr")) {
    return `${value.toFixed(2)}%`
  }
  
  // Check if it's a custom metric and get its formatting preference
  const customMetric = getCustomMetricById(metricId)
  if (customMetric) {
    // You could add a format field to custom metrics in the future
    // For now, format based on the value's magnitude
    if (value % 1 === 0) {
      return value.toLocaleString()
    }
    return value.toFixed(2)
  }
  
  return value.toLocaleString()
}