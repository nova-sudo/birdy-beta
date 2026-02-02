/**
 * Custom metrics management for campaign analytics with DYNAMIC TAG SUPPORT
 * Handles loading, evaluating, and formatting custom metric formulas
 * Now includes auto-discovered tags from client groups
 */

import { extractUniqueTags } from './enhanced-columns-config';

// Base metric ID to data key mapping
const BASE_METRIC_MAPPING = {
  // Clients dashboard (GoHighLevel & Meta Ads)
  leads: "ghl_contacts",
  bookings: "bookings",
  "total-revenue": "total_revenue",
  "upsell-revenue": "upsell_revenue",
  "ad-spend": "meta_spend",
  cpl: "meta_cpl",
  "ghl_contacts": "ghl_contacts",
  "total_tags": "total_tags",
  "meta_spend": "meta_spend",
  "meta_ctr": "meta_ctr",
  "meta_cpc": "meta_cpc",
  "meta_leads": "meta_leads",
  "meta_impressions": "meta_impressions",
  "meta_clicks": "meta_clicks",
  "meta_reach": "meta_reach",
  "meta_cpm": "meta_cpm",
  "meta_campaigns": "meta_campaigns",
  "hp_leads": "hp_leads",
  "conversion_rate": "conversion_rate",
  "cost_per_lead": "cost_per_lead",
  "engagement_rate": "engagement_rate",
  
  // Campaigns dashboard (Facebook/Meta - Campaigns, Ad Sets, Ads)
  spend: "spend",
  impressions: "impressions",
  clicks: "clicks",
  cpc: "cpc",
  reach: "reach",
  ctr: "ctr",
  frequency: "frequency",
  cpm: "cpm",
  "campaign-results": "results",
  "campaign-leads": "leads",
  
  // Contacts page
  "lead-value": "leadValue",
};

/**
 * Build dynamic metric mapping including discovered tags
 * @param {Array} clientGroups - Optional client groups data for tag discovery
 * @returns {Object} Complete metric ID to data key mapping
 */
export function buildMetricMapping(clientGroups = []) {
  const mapping = { ...BASE_METRIC_MAPPING };
  
  // Add dynamic tag mappings if client groups data is available
  if (clientGroups && clientGroups.length > 0) {
    const uniqueTags = extractUniqueTags(clientGroups);
    uniqueTags.forEach(tag => {
      const columnId = `tag_${tag.replace(/[^a-z0-9]/g, '_')}`;
      mapping[columnId] = columnId;
    });
  }
  
  return mapping;
}

// Singleton instance of metric mapping
let CACHED_METRIC_MAPPING = BASE_METRIC_MAPPING;

/**
 * Update the cached metric mapping with client groups data
 * Call this when client groups data changes
 */
export function updateMetricMapping(clientGroups) {
  CACHED_METRIC_MAPPING = buildMetricMapping(clientGroups);
  console.log("📊 Updated metric mapping with", Object.keys(CACHED_METRIC_MAPPING).length, "metrics");
}

/**
 * Get the current metric mapping
 */
export function getMetricMapping() {
  return CACHED_METRIC_MAPPING;
}

// Export for backwards compatibility
export const METRIC_ID_TO_DATA_KEY = BASE_METRIC_MAPPING;

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
  
  // Check if it's a tag metric
  if (metricId.startsWith('tag_')) {
    const tagName = metricId
      .replace('tag_', '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return `Tag: ${tagName}`;
  }
  
  // Fallback to formatting the ID
  return metricId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Evaluate a formula with dynamic tag support
 * @param {Array} formulaParts - Array of formula parts (metrics and operators)
 * @param {Object} rowData - Data row to evaluate against
 * @param {Function} getTagCount - Optional function to get tag counts
 * @returns {number} Evaluated result
 */
export function evaluateFormula(formulaParts, rowData, getTagCount = null) {
  if (!formulaParts?.length) {
    return 0
  }
  
  let expression = ""
  
  for (const part of formulaParts) {
    if (part.type === "metric") {
      let value;
      
      // Check if it's a tag metric
      if (part.value.startsWith('tag_') && getTagCount) {
        const tagName = part.value
          .replace('tag_', '')
          .replace(/_/g, ' ');
        value = getTagCount(rowData, tagName);
      } else {
        // First try the metric ID directly (this works for campaigns data)
        value = rowData[part.value];
        
        // If not found, try the mapped data key
        if (value === undefined || value === null) {
          const dataKey = CACHED_METRIC_MAPPING[part.value];
          if (dataKey) {
            value = rowData[dataKey];
          }
        }
      }
      
      // Default to 0 if still not found
      value = value ?? 0;
      
      expression += value;
    } else if (part.type === "operator") {
      expression += ` ${part.value} `;
    }
  }
  
  try {
    // Use Function constructor instead of eval for safer evaluation
    const result = new Function(`return ${expression}`)();
    return isNaN(result) ? 0 : Number(result);
  } catch (e) {
    console.error("Formula evaluation error:", e, "Expression:", expression, "RowData:", rowData);
    return 0;
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
  
  // Tag metrics and counts - show as whole numbers
  if (metricId.startsWith('tag_') || metricId.includes('contacts') || metricId.includes('leads')) {
    return value.toLocaleString();
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

/**
 * Get available metrics for formula builder including dynamic tags
 * @param {Array} clientGroups - Optional client groups data for tag discovery
 * @returns {Array} Array of metric objects grouped by category
 */
export function getAvailableMetrics(clientGroups = []) {
  const baseMetrics = [
    // Core
    { id: "name", label: "Business Name", category: "Core" },
    
    // GoHighLevel
    { id: "ghl_contacts", label: "GHL Leads", category: "GoHighLevel" },
    { id: "total_tags", label: "Total Tags", category: "GoHighLevel" },
    
    // Meta Ads
    { id: "meta_spend", label: "Ad Spend", category: "Meta Ads" },
    { id: "meta_impressions", label: "Impressions", category: "Meta Ads" },
    { id: "meta_clicks", label: "Clicks", category: "Meta Ads" },
    { id: "meta_reach", label: "Reach", category: "Meta Ads" },
    { id: "meta_ctr", label: "CTR", category: "Meta Ads" },
    { id: "meta_cpc", label: "CPC", category: "Meta Ads" },
    { id: "meta_cpm", label: "CPM", category: "Meta Ads" },
    { id: "meta_leads", label: "Meta Leads", category: "Meta Ads" },
    { id: "meta_campaigns", label: "Campaigns", category: "Meta Ads" },
    
    // HotProspector
    { id: "hp_leads", label: "HP Leads", category: "HotProspector" },
    
    // Calculated
    { id: "conversion_rate", label: "Conversion Rate", category: "Calculated" },
    { id: "cost_per_lead", label: "Cost Per Lead", category: "Calculated" },
    { id: "engagement_rate", label: "Engagement Rate", category: "Calculated" },
    
    // Campaigns (for Campaigns dashboard)
    { id: "spend", label: "Spend", category: "Campaigns" },
    { id: "impressions", label: "Impressions", category: "Campaigns" },
    { id: "clicks", label: "Clicks", category: "Campaigns" },
    { id: "cpc", label: "CPC", category: "Campaigns" },
    { id: "reach", label: "Reach", category: "Campaigns" },
    { id: "ctr", label: "CTR", category: "Campaigns" },
    { id: "frequency", label: "Frequency", category: "Campaigns" },
    { id: "cpm", label: "CPM", category: "Campaigns" },
    { id: "campaign-results", label: "Results", category: "Campaigns" },
    { id: "campaign-leads", label: "Leads", category: "Campaigns" },
  ];
  
  // Add dynamic tag metrics if client groups data is available
  if (clientGroups && clientGroups.length > 0) {
    const uniqueTags = extractUniqueTags(clientGroups);
    const tagMetrics = uniqueTags.map(tag => {
      const columnId = `tag_${tag.replace(/[^a-z0-9]/g, '_')}`;
      const label = tag
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return {
        id: columnId,
        label: `Tag: ${label}`,
        category: "Lead Tags"
      };
    });
    
    return [...baseMetrics, ...tagMetrics];
  }
  
  return baseMetrics;
}