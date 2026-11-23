/**
 * Dynamic Metrics Discovery System
 * Automatically discovers all available metrics across all dashboards
 * Supports: Clients page, Campaigns page, Contacts page, and custom metrics
 */

import { buildDynamicColumns, extractUniqueTags, BASE_CLIENT_COLUMNS } from './enhanced-columns-config';

/**
 * Discover all metrics from the Clients page (includes dynamic tags)
 * @param {Array} clientGroups - Client groups data for tag discovery
 * @returns {Array} Array of metric objects
 */
export function discoverClientMetrics(clientGroups = []) {
  // Build dynamic columns (includes base columns + discovered tags)
  const columns = buildDynamicColumns(clientGroups);
  
  return columns
    .filter(col => col.id !== 'name') // Exclude name column (not a metric)
    .map(col => ({
      id: col.id,
      name: col.label,
      description: `${col.label} from ${col.category}`,
      source: getSourceFromCategory(col.category),
      dashboard: "Clients",
      formula: null,
      category: "standard",
      enabled: true,
      columnType: col.type || 'data',
      isDynamic: col.isDynamic || false,
      tagName: col.tagName || null,
    }));
}

/**
 * Discover all metrics from the Campaigns page
 * @returns {Array} Array of metric objects
 */
export function discoverCampaignMetrics() {
  const campaignColumns = [
    // Campaign/AdSet/Ad specific
    { id: "name", label: "Name", skip: true },
    { id: "clientGroup", label: "Client Group", skip: true },
    { id: "adAccount", label: "Ad Account", category: "meta" },
    
    // Core Meta metrics
    { id: "spend", label: "Spend", category: "meta" },
    { id: "social_spend", label: "Social Spend", category: "meta" },
    { id: "impressions", label: "Impressions", category: "meta" },
    { id: "clicks", label: "Clicks", category: "meta" },
    { id: "cpc", label: "CPC", category: "meta" },
    { id: "cpp", label: "CPP", category: "meta" },
    { id: "reach", label: "Reach", category: "meta" },
    { id: "ctr", label: "CTR", category: "meta" },
    { id: "cpm", label: "CPM", category: "meta" },
    { id: "frequency", label: "Frequency", category: "meta" },
    { id: "conversion_rate_ranking", label: "Conversion Rate Ranking", category: "meta" },
    { id: "account_currency", label: "Account Currency", category: "meta" },
    { id: "results", label: "Results", category: "meta" },
    { id: "leads", label: "Leads", category: "meta" },
    
    // Campaign hierarchy
    { id: "campaign_name", label: "Campaign Name", skip: true },
    { id: "adset_name", label: "Ad Set Name", skip: true },
  ];
  
  return campaignColumns
    .filter(col => !col.skip)
    .map(col => ({
      id: col.id,
      name: col.label,
      description: `${col.label} metric from campaigns`,
      source: "Meta Ads",
      dashboard: "Campaigns",
      formula: null,
      category: "standard",
      enabled: true,
    }));
}

/**
 * Discover all metrics from the Contacts page
 * @returns {Array} Array of metric objects
 */
export function discoverContactMetrics() {
  const contactColumns = [
    { id: "contactName", label: "Contact Name", skip: true },
    { id: "groupName", label: "Group Name", skip: true },
    { id: "email", label: "Email", skip: true },
    { id: "phone", label: "Phone", skip: true },
    { id: "source", label: "Source", category: "ghl" },
    { id: "dateAdded", label: "Date Added", category: "ghl" },
    { id: "tags", label: "Tags", category: "ghl" },
    { id: "contactType", label: "Contact Type", category: "ghl" },
    { id: "opportunityStatus", label: "Opportunity Status", category: "ghl" },
    { id: "pipelineStage", label: "Pipeline Stage", category: "ghl" },
    { id: "leadValue", label: "Lead Value", category: "ghl" },
    { id: "website", label: "Website", skip: true },
    { id: "address1", label: "Address", skip: true },
    { id: "country", label: "Country", category: "ghl" },
  ];
  
  return contactColumns
    .filter(col => !col.skip)
    .map(col => ({
      id: col.id,
      name: col.label,
      description: `${col.label} from contacts`,
      source: col.category === "ghl" ? "GoHighLevel" : "Unknown",
      dashboard: "Contacts",
      formula: null,
      category: "standard",
      enabled: true,
    }));
}

/**
 * Get all discovered metrics from all pages
 * @param {Array} clientGroups - Client groups data for dynamic discovery
 * @returns {Array} Complete array of all discovered metrics
 */
export function discoverAllMetrics(clientGroups = []) {
  console.log("🔍 Starting metrics discovery...");
  
  const clientMetrics = discoverClientMetrics(clientGroups);
  const campaignMetrics = discoverCampaignMetrics();
  const contactMetrics = discoverContactMetrics();
  
  // Combine all metrics
  const allMetrics = [
    ...clientMetrics,
    ...campaignMetrics,
    ...contactMetrics,
  ];
  
  console.log("📊 Metrics discovered:", {
    clients: clientMetrics.length,
    campaigns: campaignMetrics.length,
    contacts: contactMetrics.length,
    total: allMetrics.length,
  });
  
  // Log tag metrics specifically
  const tagMetrics = clientMetrics.filter(m => m.isDynamic);
  if (tagMetrics.length > 0) {
    console.log("🏷️ Tag metrics discovered:", tagMetrics.length);
  }
  
  return allMetrics;
}

/**
 * Get source name from category
 * @param {string} category - Column category
 * @returns {string} Source name
 */
function getSourceFromCategory(category) {
  const categoryMap = {
    'core': 'System',
    'gohighlevel': 'GoHighLevel',
    'metaads': 'Meta Ads',
    'hotprospector': 'HotProspector',
    'tags': 'GoHighLevel',
    'calculated': 'Calculated',
    'formulas': 'Custom Formula',
  };
  
  return categoryMap[category] || 'Unknown';
}

/**
 * Get metrics by dashboard
 * @param {string} dashboard - Dashboard name ("Clients", "Campaigns", "Contacts")
 * @param {Array} clientGroups - Client groups data
 * @returns {Array} Metrics for the specified dashboard
 */
export function getMetricsByDashboard(dashboard, clientGroups = []) {
  const allMetrics = discoverAllMetrics(clientGroups);
  return allMetrics.filter(m => m.dashboard === dashboard);
}

/**
 * Get metrics by source
 * @param {string} source - Source name
 * @param {Array} clientGroups - Client groups data
 * @returns {Array} Metrics from the specified source
 */
export function getMetricsBySource(source, clientGroups = []) {
  const allMetrics = discoverAllMetrics(clientGroups);
  return allMetrics.filter(m => m.source === source);
}

/**
 * Search metrics by name or description
 * @param {string} query - Search query
 * @param {Array} clientGroups - Client groups data
 * @returns {Array} Matching metrics
 */
export function searchMetrics(query, clientGroups = []) {
  if (!query) return discoverAllMetrics(clientGroups);
  
  const allMetrics = discoverAllMetrics(clientGroups);
  const lowerQuery = query.toLowerCase();
  
  return allMetrics.filter(m => 
    m.name.toLowerCase().includes(lowerQuery) ||
    m.description.toLowerCase().includes(lowerQuery) ||
    m.source.toLowerCase().includes(lowerQuery) ||
    m.dashboard.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get available metrics for formula builder
 * Includes all discovered metrics plus custom metrics
 * @param {Array} clientGroups - Client groups data
 * @returns {Array} Metrics available for use in formulas
 */
export function getAvailableMetricsForFormulas(clientGroups = []) {
  const discovered = discoverAllMetrics(clientGroups);
  
  // Group metrics by category for the formula builder
  const grouped = discovered.reduce((acc, metric) => {
    const category = metric.source;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({
      id: metric.id,
      label: metric.name,
      category: category,
    });
    return acc;
  }, {});
  
  return Object.entries(grouped).flatMap(([category, metrics]) => metrics);
}

/**
 * Get unique sources from all discovered metrics
 * @param {Array} clientGroups - Client groups data
 * @returns {Array} Array of unique source names
 */
export function getAvailableSources(clientGroups = []) {
  const allMetrics = discoverAllMetrics(clientGroups);
  return [...new Set(allMetrics.map(m => m.source))].sort();
}

/**
 * Get unique dashboards from all discovered metrics
 * @param {Array} clientGroups - Client groups data
 * @returns {Array} Array of unique dashboard names
 */
export function getAvailableDashboards(clientGroups = []) {
  const allMetrics = discoverAllMetrics(clientGroups);
  return [...new Set(allMetrics.map(m => m.dashboard))].sort();
}

/**
 * Get metrics statistics
 * @param {Array} clientGroups - Client groups data
 * @returns {Object} Statistics about discovered metrics
 */
export function getMetricsStatistics(clientGroups = []) {
  const allMetrics = discoverAllMetrics(clientGroups);
  
  const byDashboard = allMetrics.reduce((acc, m) => {
    acc[m.dashboard] = (acc[m.dashboard] || 0) + 1;
    return acc;
  }, {});
  
  const bySource = allMetrics.reduce((acc, m) => {
    acc[m.source] = (acc[m.source] || 0) + 1;
    return acc;
  }, {});
  
  const dynamicMetrics = allMetrics.filter(m => m.isDynamic);
  
  return {
    total: allMetrics.length,
    byDashboard,
    bySource,
    dynamicCount: dynamicMetrics.length,
    standardCount: allMetrics.length - dynamicMetrics.length,
  };
}
