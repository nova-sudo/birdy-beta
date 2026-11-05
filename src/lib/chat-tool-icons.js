/**
 * Maps AI tool names to a visual category (icon + color + friendly label).
 * Used by ToolPill and TypingIndicator.
 */
import {
  BarChart3, TrendingUp, Users, MessageSquare, AlertTriangle, Target,
  Sparkles, Calculator, Tags, Briefcase, PieChart, Activity, Search, FilePen, Send, Pause,
} from "lucide-react"

// Category palette — matches the rest of the app
export const CATEGORY_COLORS = {
  meta: { bg: "bg-pd-info-bg", text: "text-pd-info", border: "border-transparent", dot: "bg-pd-info" },
  ghl: { bg: "bg-pd-success-bg", text: "text-pd-success", border: "border-transparent", dot: "bg-pd-success" },
  custom: { bg: "bg-pd-amber-bg", text: "text-pd-amber", border: "border-transparent", dot: "bg-pd-amber" },
  compare: { bg: "bg-pd-primary-tint", text: "text-pd-primary", border: "border-transparent", dot: "bg-pd-primary" },
  creative: { bg: "bg-pd-primary-tint", text: "text-pd-primary", border: "border-transparent", dot: "bg-pd-primary" },
  alert: { bg: "bg-pd-danger-bg", text: "text-pd-danger", border: "border-transparent", dot: "bg-pd-danger" },
  group: { bg: "bg-pd-divider", text: "text-pd-body", border: "border-transparent", dot: "bg-gray-400" },
}

const TOOL_MAP = {
  // Meta tools
  get_campaign_insights:  { category: "meta",   icon: BarChart3,     label: "Campaigns"      , running: "Reading campaigns" },
  get_adset_insights:     { category: "meta",   icon: BarChart3,     label: "Ad sets"         , running: "Reading ad sets" },
  get_ad_insights:        { category: "meta",   icon: BarChart3,     label: "Ads"             , running: "Reading ads" },
  get_facebook_leads:     { category: "meta",   icon: Users,         label: "Meta leads"      , running: "Fetching Meta leads" },
  get_meta_insights_live: { category: "meta",   icon: Activity,      label: "Meta live"       , running: "Calling Meta API" },
  get_meta_leads_live:    { category: "meta",   icon: Activity,      label: "Meta leads (live)", running: "Calling Meta API for leads" },
  get_daily_metrics:      { category: "meta",   icon: TrendingUp,    label: "Daily metrics"   , running: "Reading day-by-day results" },

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
  render_ui:           { category: "compare", icon: BarChart3,   label: "Chart"     , running: "Drawing the chart" },

  // Custom metrics
  list_custom_metrics:   { category: "custom", icon: Sparkles,   label: "Custom metrics", running: "Looking up custom metrics" },
  compute_custom_metric: { category: "custom", icon: Calculator, label: "Compute"       , running: "Computing custom metric" },

  // Alerts
  get_alerts:    { category: "alert", icon: AlertTriangle, label: "Alerts"      , running: "Fetching alerts" },
  create_alert:  { category: "alert", icon: AlertTriangle, label: "New alert"   , running: "Creating alert" },
  update_alert:  { category: "alert", icon: AlertTriangle, label: "Update alert", running: "Updating alert" },

  // Groups
  get_client_groups: { category: "group", icon: Briefcase, label: "Client groups", running: "Loading client groups" },
  // Creatives tracking
  find_ads:               { category: "creative", icon: Search,    label: "Find ads"       , running: "Finding ads" },
  list_ad_accounts:       { category: "creative", icon: Briefcase, label: "Ad accounts"    , running: "Checking ad accounts" },
  list_adsets:            { category: "creative", icon: Search,    label: "Ad sets"        , running: "Finding ad sets" },
  list_creative_tests:    { category: "creative", icon: Search,    label: "Creative tests" , running: "Looking up creative tests" },
  get_creative_test:      { category: "creative", icon: Search,    label: "Creative test"  , running: "Reading the test" },
  draft_creative_test:    { category: "creative", icon: FilePen,   label: "Draft test"     , running: "Drafting test" },
  post_creative_test:     { category: "creative", icon: Send,      label: "Post test"      , running: "Posting test" },
  scale_creative_test:    { category: "creative", icon: TrendingUp, label: "Scale test"    , running: "Scaling test" },
  pause_creative_ads:     { category: "creative", icon: Pause,     label: "Pause ads"      , running: "Pausing ads" },
  update_creative_targets:{ category: "creative", icon: Target,    label: "Update targets" , running: "Updating targets" },

  // Slack report copilot (page "report_designer")
  list_report_clients: { category: "group",   icon: Briefcase,     label: "Clients"        , running: "Checking your clients" },
  list_report_metrics: { category: "group",   icon: BarChart3,     label: "Report metrics" , running: "Checking which metrics you have" },
  get_report_draft:    { category: "group",   icon: MessageSquare, label: "Report draft"   , running: "Reading your report" },
  propose_report:      { category: "group",   icon: Sparkles,      label: "Updated preview", running: "Updating your report" },
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
