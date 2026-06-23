import { ghlIcon, metaIcon, hpIcon } from "@/lib/icons"
import { flaskIcon } from "@/lib/icons"

/**
 * Build the full metrics list for MetricPicker, including:
 * - Meta Ads metrics (with metaIcon)
 * - GHL metrics (with ghlIcon)
 * - Call Center / HotProspector metrics (with hpIcon) — per-client + per-agent
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
    // Call Center (HotProspector) — per-client, date-windowed
    { id: "hp_leads",            label: "Call Center Leads",  category: "Call Center", icon: hpIcon },
    { id: "hp_total_calls",      label: "Total Calls",        category: "Call Center", icon: hpIcon },
    { id: "hp_inbound",          label: "Inbound Calls",      category: "Call Center", icon: hpIcon },
    { id: "hp_outbound",         label: "Outbound Calls",     category: "Call Center", icon: hpIcon },
    { id: "hp_transfers",        label: "Call Transfers",     category: "Call Center", icon: hpIcon },
    { id: "hp_leads_with_calls", label: "Leads Called",       category: "Call Center", icon: hpIcon },
    { id: "hp_answered_calls",   label: "Answered Calls",     category: "Call Center", icon: hpIcon },
    { id: "hp_talk_time",        label: "Talk Time (min)",    category: "Call Center", icon: hpIcon },
    { id: "hp_connect_rate",     label: "Connect Rate (%)",   category: "Call Center", icon: hpIcon },
    { id: "hp_answer_rate",      label: "Answer Rate (%)",    category: "Call Center", icon: hpIcon },
    // Call Center (HotProspector) — per-agent, account-wide
    { id: "hp_agent_outbound",    label: "Agent Outbound Calls",  category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_inbound",     label: "Agent Inbound Calls",   category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_dialed",      label: "Agent Total Dials",     category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_answered",    label: "Agent Answered Calls",  category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_convos",      label: "Conversations",         category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_appts",       label: "Appointments Set",      category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_talk_min",    label: "Agent Talk Time (min)", category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_sms",         label: "SMS Sent",              category: "Call Center Agents", icon: hpIcon },
    { id: "hp_agent_answer_rate", label: "Agent Answer Rate (%)", category: "Call Center Agents", icon: hpIcon },
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
