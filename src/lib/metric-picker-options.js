import { ghlIcon, metaIcon } from "@/lib/icons"
import { flaskIcon } from "@/lib/icons"

/**
 * Build the full metrics list for MetricPicker, including:
 * - Meta Ads metrics (with metaIcon)
 * - GHL metrics (with ghlIcon)
 * - GHL Tags (with ghlIcon, from availableTags array)
 * - Custom metrics (with flaskIcon, from customMetrics array)
 */
export function buildMetricPickerOptions({ availableTags = [], customMetrics = [] } = {}) {
  const metrics = [
    // Meta Ads
    { id: "spend",            label: "Total Spend",           category: "Meta Ads",   icon: metaIcon },
    { id: "impressions",      label: "Impressions",           category: "Meta Ads",   icon: metaIcon },
    { id: "clicks",           label: "Clicks",                category: "Meta Ads",   icon: metaIcon },
    { id: "reach",            label: "Reach",                 category: "Meta Ads",   icon: metaIcon },
    { id: "ctr",              label: "CTR (%)",               category: "Meta Ads",   icon: metaIcon },
    { id: "cpc",              label: "CPC ($)",               category: "Meta Ads",   icon: metaIcon },
    { id: "cpm",              label: "CPM ($)",               category: "Meta Ads",   icon: metaIcon },
    { id: "meta_leads",       label: "Meta Leads",            category: "Meta Ads",   icon: metaIcon },
    { id: "meta_conversion",  label: "Meta Conversion (%)",   category: "Meta Ads",   icon: metaIcon },
    { id: "cpl",              label: "Cost Per Lead ($)",      category: "Meta Ads",   icon: metaIcon },
    { id: "cost_per_result",  label: "Cost Per Result ($)",    category: "Meta Ads",   icon: metaIcon },
    { id: "frequency",        label: "Ad Frequency",          category: "Meta Ads",   icon: metaIcon },
    // GHL
    { id: "ghl_leads",        label: "GHL Leads",             category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_conversion",   label: "GHL Conversion (%)",    category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_revenue",      label: "GHL Revenue",           category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_won_opps",     label: "Won Opps",              category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_lost_opps",    label: "Lost Opps",             category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_open_opps",    label: "Open Opps",             category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_abandoned_opps", label: "Abandoned Opps",      category: "GoHighLevel", icon: ghlIcon },
    { id: "ghl_total_opps",   label: "Total Opps",            category: "GoHighLevel", icon: ghlIcon },
  ]

  // Tags
  for (const tag of availableTags) {
    metrics.push({
      id: `tag:${tag}`,
      label: tag,
      category: "GHL Tags",
      icon: ghlIcon,
    })
  }

  // Custom metrics
  for (const cm of customMetrics) {
    metrics.push({
      id: `custom:${cm.id}`,
      label: cm.name,
      category: "Custom",
      icon: flaskIcon,
    })
  }

  return metrics
}
