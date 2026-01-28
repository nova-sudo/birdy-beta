// Enhanced columns configuration for Clients page with Tag Breakdown Support
// This version includes the ability to display counts for specific tags

import ghl from "../../public/ghl_icon.png";
import metaa from "../../public/meta-icon-DH8jUhnM.png";
import HP from "../../public/hp_icon.png";

export const ENHANCED_CLIENT_COLUMNS = [
  // ========== EXISTING COLUMNS (keep as-is) ==========
  { id: "name", label: "Business Name", visible: true, sortable: true },
  { id: "ghl_contacts", label: "GHL Leads", visible: true, sortable: true, icons: ghl, category: 'gohighlevel', type: 'data' },
  { id: "meta_campaigns", label: "Campaigns", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_spend", label: "Ad Spend", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_ctr", label: "CTR", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_cpc", label: "CPC", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_leads", label: "Meta Leads", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "hp_leads", label: "HP Leads", visible: true, sortable: true, icons: HP, category: 'hotprospector', type: 'data' },
  { id: "meta_impressions", label: "Impressions", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_clicks", label: "Clicks", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_reach", label: "Reach", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_cpm", label: "CPM", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },

  // ========== NEW COLUMNS - CORE INFO ==========
  { 
    id: "ghl_location_id", 
    label: "GHL Location ID", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'gohighlevel', 
    type: 'data' 
  },
  { 
    id: "meta_ad_account_id", 
    label: "Meta Account ID", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },
  { 
    id: "account_age_days", 
    label: "Account Age (Days)", 
    visible: false, 
    sortable: true, 
    category: 'core', 
    type: 'data' 
  },

  // ========== NEW COLUMNS - GHL DETAILS ==========
  { 
    id: "ghl_address", 
    label: "Location Address", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'gohighlevel', 
    type: 'data' 
  },
  { 
    id: "total_tags", 
    label: "Total Tags", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'gohighlevel', 
    type: 'data' 
  },
  { 
    id: "top_tag_string", 
    label: "Top Tags", 
    visible: false, 
    sortable: false, 
    icons: ghl, 
    category: 'gohighlevel', 
    type: 'data' 
  },

  // ========== NEW COLUMNS - SPECIFIC TAG COUNTS ==========
  // Common/Important Tags - Add your most important tags here
  { 
    id: "tag_zombie_lead", 
    label: "Zombie Leads", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'zombie lead'
  },
  { 
    id: "tag_live_lead", 
    label: "Live Leads", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'live lead'
  },
  { 
    id: "tag_spicy_lead", 
    label: "Spicy Leads", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'spicy lead'
  },
  { 
    id: "tag_hot_lead_hp", 
    label: "Hot Leads (HP)", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'hot lead hp'
  },
  { 
    id: "tag_cold_lead_hp", 
    label: "Cold Leads (HP)", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'cold lead hp'
  },
  { 
    id: "tag_booked_consult", 
    label: "Booked Consultations", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'booked telephone consultation'
  },
  { 
    id: "tag_appointment_booked", 
    label: "Appointments Booked", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'appointment booked'
  },
  { 
    id: "tag_missed_consultation", 
    label: "Missed Consultations", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'missed consultation'
  },
  { 
    id: "tag_lead_won", 
    label: "Won Leads", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'lead won'
  },
  { 
    id: "tag_do_not_contact", 
    label: "Do Not Contact", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'do not contact'
  },
  { 
    id: "tag_fb_lead_form", 
    label: "FB Lead Form Submitted", 
    visible: false, 
    sortable: true, 
    icons: ghl, 
    category: 'tags', 
    type: 'tag',
    tagName: 'fb lead form submitted'
  },

  // ========== NEW COLUMNS - META STATUS ==========
  { 
    id: "active_campaigns", 
    label: "Active Campaigns", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },
  { 
    id: "paused_campaigns", 
    label: "Paused Campaigns", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },
  { 
    id: "meta_account_name", 
    label: "Meta Account Name", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },

  // ========== NEW COLUMNS - AD PERFORMANCE ==========
  { 
    id: "best_ad_name", 
    label: "Best Ad", 
    visible: false, 
    sortable: false, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },
  { 
    id: "best_ad_ctr", 
    label: "Best Ad CTR", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },

  // ========== NEW COLUMNS - CALCULATED METRICS ==========
  { 
    id: "conversion_rate", 
    label: "Conversion Rate", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'calculated' 
  },
  { 
    id: "cost_per_lead", 
    label: "Cost Per Lead", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'calculated' 
  },
  { 
    id: "engagement_rate", 
    label: "Engagement Rate", 
    visible: false, 
    sortable: true, 
    icons: metaa, 
    category: 'metaads', 
    type: 'calculated' 
  },

  // ========== NEW COLUMNS - DATA FRESHNESS ==========
  { 
    id: "meta_freshness", 
    label: "Meta Data Age", 
    visible: false, 
    sortable: false, 
    icons: metaa, 
    category: 'metaads', 
    type: 'data' 
  },
  { 
    id: "ghl_freshness", 
    label: "GHL Data Age", 
    visible: false, 
    sortable: false, 
    icons: ghl, 
    category: 'gohighlevel', 
    type: 'data' 
  },
  { 
    id: "hp_freshness", 
    label: "HP Data Age", 
    visible: false, 
    sortable: false, 
    icons: HP, 
    category: 'hotprospector', 
    type: 'data' 
  },
];

// ===== UPDATED CATEGORIES =====
export const ENHANCED_CATEGORIES = [
  { id: 'all', label: 'All Metrics' },
  { id: 'core', label: 'Core Info' },
  { id: 'gohighlevel', label: 'GoHighLevel' },
  { id: 'metaads', label: 'Meta Ads' },
  { id: 'hotprospector', label: 'HotProspector' },
  { id: 'tags', label: 'Lead Tags' },  // NEW CATEGORY
  { id: 'calculated', label: 'Calculated' },
  { id: 'formulas', label: 'Formulas' },
];

// ===== HELPER: Get tag count from tag breakdown =====
export const getTagCount = (group, tagName) => {
  const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
  return tagBreakdown[tagName] || 0;
};

// ===== COLUMN PRESETS =====
export const COLUMN_PRESETS = {
  default: {
    name: "Default View",
    columns: [
      "name", "ghl_contacts", "meta_campaigns", "meta_spend", 
      "meta_ctr", "meta_cpc", "meta_leads", "hp_leads"
    ]
  },
  performance: {
    name: "Performance Analysis",
    columns: [
      "name", "meta_spend", "meta_impressions", "meta_clicks", 
      "meta_ctr", "conversion_rate", "cost_per_lead", "engagement_rate"
    ]
  },
  campaign_health: {
    name: "Campaign Health",
    columns: [
      "name", "active_campaigns", "paused_campaigns", "meta_campaigns",
      "meta_freshness", "account_age_days"
    ]
  },
  lead_quality: {
    name: "Lead Quality",
    columns: [
      "name", "ghl_contacts", "tag_live_lead", "tag_spicy_lead", 
      "tag_hot_lead_hp", "tag_zombie_lead", "tag_cold_lead_hp"
    ]
  },
  conversion_funnel: {
    name: "Conversion Funnel",
    columns: [
      "name", "ghl_contacts", "tag_booked_consult", "tag_appointment_booked",
      "tag_missed_consultation", "tag_lead_won"
    ]
  },
  tags_overview: {
    name: "Tags Overview",
    columns: [
      "name", "total_tags", "tag_live_lead", "tag_spicy_lead", 
      "tag_booked_consult", "tag_do_not_contact"
    ]
  }
};