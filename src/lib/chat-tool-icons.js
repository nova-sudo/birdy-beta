/**
 * Maps AI tool names to a visual category (icon + color + friendly label).
 * Used by ToolPill and TypingIndicator.
 */
import {
  BarChart3, TrendingUp, Users, MessageSquare, AlertTriangle, Target,
  Sparkles, Calculator, Tags, Briefcase, PieChart, Activity,
} from "lucide-react"

// Category palette — matches the rest of the app
export const CATEGORY_COLORS = {
  meta: {
    bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500",
  },
  ghl: {
    bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500",
  },
  custom: {
    bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500",
  },
  compare: {
    bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500",
  },
  alert: {
    bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500",
  },
  group: {
    bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500",
  },
}

const TOOL_MAP = {
  // Meta tools
  get_campaign_insights:  { category: "meta",   icon: BarChart3,     label: "Campaigns"      , running: "Reading campaigns" },
  get_adset_insights:     { category: "meta",   icon: BarChart3,     label: "Ad sets"         , running: "Reading ad sets" },
  get_ad_insights:        { category: "meta",   icon: BarChart3,     label: "Ads"             , running: "Reading ads" },
  get_facebook_leads:     { category: "meta",   icon: Users,         label: "Meta leads"      , running: "Fetching Meta leads" },
  get_meta_insights_live: { category: "meta",   icon: Activity,      label: "Meta live"       , running: "Calling Meta API" },
  get_meta_leads_live:    { category: "meta",   icon: Activity,      label: "Meta leads (live)", running: "Calling Meta API for leads" },

  // GHL tools
  get_ghl_contacts:           { category: "ghl", icon: Users,      label: "GHL contacts"      , running: "Fetching GHL contacts" },
  get_ghl_opportunity_stats:  { category: "ghl", icon: Target,     label: "Opportunities"     , running: "Fetching opportunity stats" },
  get_ghl_tag_breakdown:      { category: "ghl", icon: Tags,       label: "GHL tags"          , running: "Reading tag breakdown" },
  get_tag_rollup_by_campaign: { category: "ghl", icon: Tags,       label: "Tags by campaign"  , running: "Rolling up tags per campaign" },
  get_unified_leads:          { category: "ghl", icon: Users,      label: "Unified leads"     , running: "Matching leads across sources" },
  get_unified_lead_stats:     { category: "ghl", icon: PieChart,   label: "Lead stats"        , running: "Computing lead match stats" },

  // Summary / comparison
  get_account_summary: { category: "compare", icon: Briefcase,   label: "Summary"   , running: "Building your summary" },
  compare_periods:     { category: "compare", icon: TrendingUp,  label: "Compare"   , running: "Comparing periods" },

  // Custom metrics
  list_custom_metrics:   { category: "custom", icon: Sparkles,   label: "Custom metrics", running: "Looking up custom metrics" },
  compute_custom_metric: { category: "custom", icon: Calculator, label: "Compute"       , running: "Computing custom metric" },

  // Alerts
  get_alerts:    { category: "alert", icon: AlertTriangle, label: "Alerts"      , running: "Fetching alerts" },
  create_alert:  { category: "alert", icon: AlertTriangle, label: "New alert"   , running: "Creating alert" },
  update_alert:  { category: "alert", icon: AlertTriangle, label: "Update alert", running: "Updating alert" },

  // Groups
  get_client_groups: { category: "group", icon: Briefcase, label: "Client groups", running: "Loading client groups" },
}

const FALLBACK = {
  category: "group",
  icon: MessageSquare,
  label: null,
  running: "Working on it",
}

export function getToolMeta(toolName) {
  const entry = TOOL_MAP[toolName]
  if (!entry) {
    return {
      ...FALLBACK,
      label: humanize(toolName),
      running: `Calling ${humanize(toolName)}`,
    }
  }
  return entry
}

export function getCategoryColors(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.group
}

function humanize(slug) {
  if (!slug) return ""
  return slug
    .replace(/^get_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
}
