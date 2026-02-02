// Enhanced columns configuration for Clients page with DYNAMIC Tag Support
// This version auto-discovers tags from your data and creates columns dynamically

import ghl from "../../public/ghl_icon.png";
import metaa from "../../public/meta-icon-DH8jUhnM.png";
import HP from "../../public/hp_icon.png";

// ========== BASE COLUMNS (Static - Always Available) ==========
export const BASE_CLIENT_COLUMNS = [
  // Core Info
  { id: "name", label: "Business Name", visible: true, sortable: true, category: 'core', type: 'data' },
  
  // GoHighLevel
  { id: "ghl_contacts", label: "GHL Leads", visible: true, sortable: true, icons: ghl, category: 'gohighlevel', type: 'data' },
  { id: "ghl_location_id", label: "GHL Location ID", visible: false, sortable: true, icons: ghl, category: 'gohighlevel', type: 'data' },
  { id: "ghl_address", label: "Location Address", visible: false, sortable: true, icons: ghl, category: 'gohighlevel', type: 'data' },
  { id: "total_tags", label: "Total Tags", visible: false, sortable: true, icons: ghl, category: 'gohighlevel', type: 'data' },
  { id: "top_tag_string", label: "Top Tags", visible: false, sortable: false, icons: ghl, category: 'gohighlevel', type: 'data' },
  
  // Meta Ads - Core
  { id: "meta_campaigns", label: "Campaigns", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_spend", label: "Ad Spend", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_ctr", label: "CTR", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_cpc", label: "CPC", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_leads", label: "Meta Leads", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_impressions", label: "Impressions", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_clicks", label: "Clicks", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_reach", label: "Reach", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_cpm", label: "CPM", visible: true, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  
  // Meta Ads - Extended
  { id: "meta_ad_account_id", label: "Meta Account ID", visible: false, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "active_campaigns", label: "Active Campaigns", visible: false, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "paused_campaigns", label: "Paused Campaigns", visible: false, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "meta_account_name", label: "Meta Account Name", visible: false, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  { id: "best_ad_name", label: "Best Ad", visible: false, sortable: false, icons: metaa, category: 'metaads', type: 'data' },
  { id: "best_ad_ctr", label: "Best Ad CTR", visible: false, sortable: true, icons: metaa, category: 'metaads', type: 'data' },
  
  // HotProspector
  { id: "hp_leads", label: "HP Leads", visible: true, sortable: true, icons: HP, category: 'hotprospector', type: 'data' },
  
  // Calculated Metrics
  { id: "conversion_rate", label: "Conversion Rate", visible: false, sortable: true, icons: metaa, category: 'calculated', type: 'calculated' },
  { id: "cost_per_lead", label: "Cost Per Lead", visible: false, sortable: true, icons: metaa, category: 'calculated', type: 'calculated' },
  { id: "engagement_rate", label: "Engagement Rate", visible: false, sortable: true, icons: metaa, category: 'calculated', type: 'calculated' },
  
  // Data Freshness
  { id: "account_age_days", label: "Account Age (Days)", visible: false, sortable: true, category: 'core', type: 'data' },
  { id: "meta_freshness", label: "Meta Data Age", visible: false, sortable: false, icons: metaa, category: 'metaads', type: 'data' },
  { id: "ghl_freshness", label: "GHL Data Age", visible: false, sortable: false, icons: ghl, category: 'gohighlevel', type: 'data' },
  { id: "hp_freshness", label: "HP Data Age", visible: false, sortable: false, icons: HP, category: 'hotprospector', type: 'data' },
];

// ===== DYNAMIC TAG DISCOVERY =====
/**
 * Extracts all unique tags from client groups data
 * @param {Array} clientGroups - Array of client group objects
 * @returns {Array} Array of unique tag names
 */
export const extractUniqueTags = (clientGroups) => {
  const tagSet = new Set();
  
  clientGroups.forEach(group => {
    const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
    Object.keys(tagBreakdown).forEach(tag => {
      if (tag && tag.trim()) {
        tagSet.add(tag.trim().toLowerCase());
      }
    });
  });
  
  return Array.from(tagSet).sort();
};

/**
 * Generates dynamic tag columns from discovered tags
 * @param {Array} tags - Array of unique tag names
 * @returns {Array} Array of column objects for tags
 */
export const generateTagColumns = (tags) => {
  return tags.map(tag => {
    // Create a safe column ID from the tag name
    const columnId = `tag_${tag.replace(/[^a-z0-9]/g, '_')}`;
    
    // Create a readable label
    const label = tag
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return {
      id: columnId,
      label: `Tag: ${label}`,
      visible: false, // Hidden by default
      sortable: true,
      icons: ghl,
      category: 'tags',
      type: 'tag',
      tagName: tag, // Original tag name for lookups
      isDynamic: true // Flag to identify dynamic columns
    };
  });
};

/**
 * Combines base columns with dynamically generated tag columns
 * @param {Array} clientGroups - Array of client group objects
 * @returns {Array} Complete array of columns
 */
export const buildDynamicColumns = (clientGroups) => {
  const uniqueTags = extractUniqueTags(clientGroups);
  const tagColumns = generateTagColumns(uniqueTags);
  
  return [...BASE_CLIENT_COLUMNS, ...tagColumns];
};

// ===== HELPER: Get tag count from tag breakdown =====
export const getTagCount = (group, tagName) => {
  const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
  // Try exact match first
  if (tagBreakdown[tagName] !== undefined) {
    return tagBreakdown[tagName];
  }
  // Try case-insensitive match
  const lowerTagName = tagName.toLowerCase();
  for (const [key, value] of Object.entries(tagBreakdown)) {
    if (key.toLowerCase() === lowerTagName) {
      return value;
    }
  }
  return 0;
};

// ===== UPDATED CATEGORIES =====
export const ENHANCED_CATEGORIES = [
  { id: 'all', label: 'All Metrics' },
  { id: 'core', label: 'Core Info' },
  { id: 'gohighlevel', label: 'GoHighLevel' },
  { id: 'metaads', label: 'Meta Ads' },
  { id: 'hotprospector', label: 'HotProspector' },
  { id: 'tags', label: 'Lead Tags' },
  { id: 'calculated', label: 'Calculated' },
  { id: 'formulas', label: 'Formulas' },
];

// ===== COLUMN PRESETS (Can include dynamic tags) =====
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
  // Dynamic presets can be built at runtime based on discovered tags
};

// ===== METRIC ID MAPPING FOR FORMULAS =====
/**
 * Builds a complete metric ID to data key mapping including dynamic tags
 * @param {Array} clientGroups - Array of client group objects
 * @returns {Object} Mapping of metric IDs to data keys
 */
export const buildMetricMapping = (clientGroups) => {
  const baseMapping = {
    // Clients dashboard (GoHighLevel & Meta Ads)
    "ghl_contacts": "ghl_contacts",
    "total_tags": "total_tags",
    "bookings": "bookings",
    "total-revenue": "total_revenue",
    "upsell-revenue": "upsell_revenue",
    "meta_spend": "meta_spend",
    "meta_cpl": "meta_cpl",
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
    // Campaigns dashboard (Facebook/Meta)
    "spend": "spend",
    "impressions": "impressions",
    "clicks": "clicks",
    "cpc": "cpc",
    "reach": "reach",
    "ctr": "ctr",
    "frequency": "frequency",
    "cpm": "cpm",
    "campaign-results": "results",
    "campaign-leads": "leads",
    // Contacts page
    "lead-value": "leadValue",
  };
  
  // Add dynamic tag mappings
  const uniqueTags = extractUniqueTags(clientGroups);
  uniqueTags.forEach(tag => {
    const columnId = `tag_${tag.replace(/[^a-z0-9]/g, '_')}`;
    baseMapping[columnId] = columnId;
  });
  
  return baseMapping;
};

// ===== FORMULA METRICS FOR CUSTOM FORMULAS =====
/**
 * Builds available metrics for formula builder including dynamic tags
 * @param {Array} clientGroups - Array of client group objects
 * @returns {Array} Array of metric objects for formula builder
 */
export const buildFormulaMetrics = (clientGroups) => {
  const baseMetrics = [
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
  ];
  
  // Add dynamic tag metrics
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
};

// ===== EXPORT DEFAULT FOR BACKWARDS COMPATIBILITY =====
export const ENHANCED_CLIENT_COLUMNS = BASE_CLIENT_COLUMNS;