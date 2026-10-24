// The Client Hub's column catalogue: every metric a client row can show beyond
// the five columns the table opens on, so the old column picker keeps its
// reach. Pure functions only; the page wires them to the ds DataTable.
//
// The values and formats here are the ones the previous clients table
// computed (that table component has since been removed), so a column reads
// the same number it always did.

import { buildDynamicColumns, getTagCount, columnMenuSource } from "@/lib/enhanced-columns-config";
import { evaluateFormula } from "@/lib/metrics";
import { applyDefaultMetrics, defaultMetricFormat } from "@/lib/default-metrics";
import { formatMetric } from "@/lib/format-metric";
import { groupHasCallCentre } from "@/lib/call-centre-availability";

/** The columns the table opens on. Everything else is one click away in View. */
export const DEFAULT_VISIBLE = ["name", "status", "health", "leads", "cpl", "spend"];

/**
 * Catalogue ids the five curated columns replace. A view saved against the old
 * table names them, so they are read as their replacements.
 */
export const LEGACY_ALIASES = { meta_spend: "spend", cost_per_lead: "cpl", meta_leads: "leads" };

// Held by the curated columns, so they are not offered twice.
const CURATED = new Set(["name", ...Object.keys(LEGACY_ALIASES)]);

// Text, not figures: left aligned, never formatted as numbers.
const TEXT_COLUMNS = new Set([
  "ghl_location_id",
  "ghl_address",
  "top_tag_string",
  "best_ad_name",
  "meta_ad_account_id",
  "meta_account_name",
  "meta_freshness",
  "ghl_freshness",
  "hp_freshness",
]);

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The extra columns on offer for these clients and this agency's custom
 * formulas: the base catalogue, one column per GHL tag in use, and the
 * formulas shown on the Clients dashboard.
 *
 * @returns {{id: string, label: string, sortable: boolean, text: boolean, source: string, custom?: object}[]}
 */
export function catalogueColumns(groups, customMetrics = []) {
  const base = buildDynamicColumns(groups ?? [])
    .filter((c) => !CURATED.has(c.id))
    .map((c) => ({ id: c.id, label: c.label, sortable: c.sortable !== false, text: TEXT_COLUMNS.has(c.id), source: columnMenuSource(c), tag: c.tagName }));

  const custom = (customMetrics ?? [])
    .filter((m) => m.enabled && (m.dashboards?.includes("clients") || m.dashboard === "Clients"))
    .map((m) => ({ id: m.id, label: m.name, sortable: true, text: false, source: "custom", custom: m }));

  const seen = new Set();
  return [...base, ...custom].filter((c) => !seen.has(c.id) && seen.add(c.id));
}

const freshness = (timestamp) => {
  if (!timestamp) return null;
  const hours = Math.floor((Date.now() - new Date(timestamp)) / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/** Every catalogue value for one client group, keyed by column id. */
export function catalogueValues(group, columns = []) {
  const ghl = group.gohighlevel?.metrics ?? {};
  const opps = ghl.opportunity_stats ?? {};
  const meta = group.facebook?.metrics ?? {};
  const insights = meta.insights ?? {};
  const campaigns = group.facebook?.campaigns ?? [];

  let results = num(insights.results);
  if (!results && campaigns.length) results = campaigns.reduce((sum, c) => sum + num(c.results), 0);
  const metaLeads = results || num(insights.total_leads);
  const spend = num(insights.spend);
  const clicks = num(insights.clicks);
  const impressions = num(insights.impressions);

  // A client who told us they don't call their leads has no call figures at
  // all, which is not the same claim as zero calls.
  const hasCallCentre = groupHasCallCentre(group);
  const calls = group.hotprospector?.call_stats ?? {};
  const hp = (v) => (hasCallCentre ? v ?? 0 : null);
  const hpLeads = num(group.hotprospector?.metrics?.total_leads);
  const hpTotalLeads = calls.total_leads ?? hpLeads;
  const leadsWithCalls = hp(calls.leads_with_calls);
  const totalCalls = hp(calls.total_calls);
  const answered = hp(calls.answered_calls);

  const tags = Object.entries(ghl.tag_breakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const bestAd = (group.facebook?.ads ?? []).reduce((best, ad) => (ad.ctr > (best?.ctr || 0) ? ad : best), null);

  const row = {
    ghl_contacts: num(ghl.total_contacts),
    ghl_revenue: num(opps.won_revenue),
    ghl_won_opps: num(opps.won),
    ghl_lost_opps: num(opps.lost),
    ghl_open_opps: num(opps.open),
    ghl_abandoned_opps: num(opps.abandoned),
    ghl_total_opps: num(opps.total_opportunities),
    ghl_location_id: group.ghl_location_id ?? "",
    ghl_address: group.gohighlevel?.address ?? "",
    total_tags: tags.length,
    top_tag_string: tags.slice(0, 3).map(([tag, count]) => `${tag} (${count})`).join(", "),
    meta_campaigns: num(meta.total_campaigns),
    meta_spend: spend,
    meta_ctr: num(insights.ctr),
    meta_cpc: num(insights.cpc),
    meta_impressions: impressions,
    meta_clicks: clicks,
    meta_reach: num(insights.reach),
    meta_cpm: num(insights.cpm),
    meta_leads: metaLeads,
    meta_ad_account_id: group.meta_ad_account_id ?? "",
    active_campaigns: campaigns.filter((c) => c.status === "Active").length,
    paused_campaigns: campaigns.filter((c) => c.status === "Paused").length,
    meta_account_name: group.facebook?.name ?? "Unknown",
    best_ad_name: bestAd?.name ?? "",
    best_ad_ctr: num(bestAd?.ctr),
    hp_leads: hpLeads,
    hp_total_calls: totalCalls,
    hp_inbound: hp(calls.inbound_count),
    hp_outbound: hp(calls.outbound_count),
    hp_transfers: hp(calls.transfers),
    hp_leads_with_calls: leadsWithCalls,
    hp_answered_calls: answered,
    hp_talk_time: hp(calls.total_talk_min),
    hp_connect_rate: !hasCallCentre ? null : hpTotalLeads > 0 ? (leadsWithCalls / hpTotalLeads) * 100 : 0,
    hp_answer_rate: !hasCallCentre ? null : totalCalls > 0 ? (answered / totalCalls) * 100 : 0,
    conversion_rate: clicks > 0 ? (metaLeads / clicks) * 100 : 0,
    cost_per_lead: metaLeads > 0 ? spend / metaLeads : 0,
    engagement_rate: impressions > 0 ? ((clicks + results) / impressions) * 100 : 0,
    account_age_days: group.created_at ? Math.floor((Date.now() - new Date(group.created_at)) / 86_400_000) : 0,
    meta_freshness: freshness(group.last_meta_refresh),
    ghl_freshness: freshness(group.last_ghl_refresh),
    hp_freshness: freshness(group.last_hp_refresh),
  };
  applyDefaultMetrics(row);

  for (const col of columns) {
    if (col.tag) row[col.id] = getTagCount(group, col.tag);
    if (col.custom?.formulaParts) {
      const result = evaluateFormula(col.custom.formulaParts, row);
      row[col.id] = typeof result === "object" ? 0 : (result ?? 0);
    }
  }
  return row;
}

/**
 * The text for one catalogue cell, with the formats the previous table used:
 * currency for money, percent for rates, grouped integers otherwise. Missing
 * and non-finite values read as a dash.
 */
export function formatCell(columnId, value, { symbol = "$", custom } = {}) {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number" && !Number.isFinite(value)) return "—";
  if (typeof value === "object") return "—";

  const defaultFormat = defaultMetricFormat(columnId);
  if (defaultFormat) return formatMetric(value, defaultFormat, symbol);

  const money = (v) => `${symbol}${num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (custom) {
    const fmt = custom.formatType || custom.format_type || "integer";
    if (fmt === "currency") return money(value);
    if (fmt === "percentage") return `${(Number(value) * 100).toFixed(2)}%`;
    if (fmt === "decimal") return Number(value).toFixed(2);
    return Number(value).toLocaleString();
  }

  if (/spend|cpc|cpm|cost_per|revenue/.test(columnId)) return money(value);
  if (/ctr|rate/.test(columnId)) return `${num(value).toFixed(2)}%`;
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/**
 * Which ids a saved view makes visible. The view is a flat ordered array of
 * column ids; legacy ids are read as the curated columns that replaced them,
 * and the name column is always on.
 *
 * @returns {{visible: Set<string>, order: string[]}|null} null when nothing is saved
 */
export function readSavedView(saved) {
  if (!Array.isArray(saved) || saved.length === 0) return null;
  const order = [...new Set(saved.map((id) => LEGACY_ALIASES[id] ?? id))];
  return { visible: new Set(["name", ...order]), order };
}
