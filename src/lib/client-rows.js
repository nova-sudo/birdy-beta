// One client group -> the flat row a clients table reads its cells from.
//
// Lifted out of the old table component (ui/table-container.jsx) so the old
// table and the redesign's Clients list compute every value the same way.
// Nothing here formats: values are numbers, strings, or null for "not
// measured" (a client with no call centre has null call figures, not zeros).

import { evaluateFormula } from "@/lib/metrics";
import { applyDefaultMetrics } from "@/lib/default-metrics";
import { groupHasCallCentre } from "@/lib/call-centre-availability";
import { normalizeHealth, CRITICAL, HEALTHY } from "@/lib/client-status";

const getTopTags = (group, count = 5) => {
  const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
  return Object.entries(tagBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
};

const getActiveCampaignCount = (group) => {
  const campaigns = group?.facebook?.campaigns || [];
  return campaigns.filter(c => c.status === "Active").length;
};

const getPausedCampaignCount = (group) => {
  const campaigns = group?.facebook?.campaigns || [];
  return campaigns.filter(c => c.status === "Paused").length;
};

const getDataFreshness = (timestamp) => {
  if (!timestamp) return null;
  const hours = Math.floor((Date.now() - new Date(timestamp)) / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getBestPerformingAd = (group) => {
  const ads = group?.facebook?.ads || [];
  if (ads.length === 0) return null;
  return ads.reduce((best, ad) =>
    (ad.ctr > (best?.ctr || 0)) ? ad : best
    , null);
};

const getTotalTagCount = (group) => {
  const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
  return Object.keys(tagBreakdown).length;
};

const getSpecificTagCount = (group, tagName) => {
  const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
  return tagBreakdown[tagName] || 0;
};

/**
 * @param {object} group a client group from /api/client-groups
 * @param {object} [options]
 * @param {object[]} [options.columns] the table's columns; tag columns among them get their counts
 * @param {object[]} [options.customMetrics] formula metrics to evaluate onto the row
 * @param {boolean} [options.enhanced] also add the wider set: tags, campaign counts, freshness, calculated rates
 */
export function flattenClientGroup(group, { columns = [], customMetrics = null, enhanced = false } = {}) {
  const ghlContacts = group.gohighlevel?.metrics?.total_contacts ?? 0;
  const ghlOppStats = group.gohighlevel?.metrics?.opportunity_stats || {}
  const ghlRevenue = ghlOppStats.won_revenue ?? 0;
  const ghlWonOpps = ghlOppStats.won ?? 0;
  const ghlLostOpps = ghlOppStats.lost ?? 0;
  const ghlOpenOpps = ghlOppStats.open ?? 0;
  const ghlAbandonedOpps = ghlOppStats.abandoned ?? 0;
  const ghlTotalOpps = ghlOppStats.total_opportunities ?? 0;
  const metaCampaigns = group.facebook?.metrics?.total_campaigns ?? 0;
  const metaAdsets = group.facebook?.metrics?.total_adsets ?? 0;
  const metaAds = group.facebook?.metrics?.total_ads ?? 0;
  const metaSpend = group.facebook?.metrics?.insights?.spend ?? 0;
  const metaImpressions = group.facebook?.metrics?.insights?.impressions ?? 0;
  const metaClicks = group.facebook?.metrics?.insights?.clicks ?? 0;
  const metaReach = group.facebook?.metrics?.insights?.reach ?? 0;
  let metaResults = group.facebook?.metrics?.insights?.results ?? 0;
  if (!metaResults && group.facebook?.campaigns?.length) {
    metaResults = group.facebook.campaigns.reduce((sum, c) => sum + (c.results || 0), 0);
  }
  const metaCpm = group.facebook?.metrics?.insights?.cpm ?? 0;
  const metaCpc = group.facebook?.metrics?.insights?.cpc ?? 0;
  const metaCtr = group.facebook?.metrics?.insights?.ctr ?? 0;
  const metaCostPerResult = group.facebook?.metrics?.insights?.cost_per_result ?? 0;
  const metaLeads = metaResults || group.facebook?.metrics?.insights?.total_leads || 0;
  const hpLeads = group.hotprospector?.metrics?.total_leads ?? 0;

  // Call Center (HotProspector) — per-preset windowed stats from call_stats.
  //
  // A client whose sales answer was "I don't currently call my leads" has
  // no dialler feeding these, so every one of them is `null` rather than 0:
  // getCellValue already draws null as "—", and the sort comparator already
  // coerces it, so the row reads "not measured" instead of "measured, and
  // the answer is none". Those are different claims and only one is true.
  const hasCallCentre = groupHasCallCentre(group);
  const hpStats = group.hotprospector?.call_stats || {};
  const hpStat = (value) => (hasCallCentre ? value ?? 0 : null);
  const hpTotalCalls = hpStat(hpStats.total_calls);
  const hpLeadsWithCalls = hpStat(hpStats.leads_with_calls);
  const hpTotalLeads = hpStats.total_leads ?? hpLeads;
  const hpAnswered = hpStat(hpStats.answered_calls);
  const hpConnectRate = !hasCallCentre
    ? null
    : hpTotalLeads > 0 ? (hpLeadsWithCalls / hpTotalLeads) * 100 : 0;
  const hpAnswerRate = !hasCallCentre
    ? null
    : hpTotalCalls > 0 ? (hpAnswered / hpTotalCalls) * 100 : 0;

  const base = {
    id: group.id,
    name: group.name || "Unnamed Group",
    status: group.client_status ?? "Active",
    // Without this every row fell back to the pill's default, so a Critical
    // client read "Healthy" inside the Critical tab. Only Critical is
    // surfaced here; Warning deliberately still reads as Healthy.
    health: normalizeHealth(group.health) === CRITICAL ? CRITICAL : HEALTHY,
    ghl_contacts: ghlContacts,
    ghl_revenue: ghlRevenue,
    ghl_won_opps: ghlWonOpps,
    ghl_lost_opps: ghlLostOpps,
    ghl_open_opps: ghlOpenOpps,
    ghl_abandoned_opps: ghlAbandonedOpps,
    ghl_total_opps: ghlTotalOpps,
    meta_campaigns: metaCampaigns,
    meta_adsets: metaAdsets,
    meta_ads: metaAds,
    meta_spend: metaSpend,
    meta_impressions: metaImpressions,
    meta_clicks: metaClicks,
    meta_reach: metaReach,
    meta_results: metaResults,
    meta_cpm: metaCpm,
    meta_cpc: metaCpc,
    meta_ctr: metaCtr,
    meta_cost_per_result: metaCostPerResult,
    meta_leads: metaLeads,
    hp_leads: hpLeads,
    hp_total_calls: hpTotalCalls,
    hp_inbound: hpStat(hpStats.inbound_count),
    hp_outbound: hpStat(hpStats.outbound_count),
    hp_transfers: hpStat(hpStats.transfers),
    hp_leads_with_calls: hpLeadsWithCalls,
    hp_answered_calls: hpAnswered,
    hp_talk_time: hpStat(hpStats.total_talk_min),
    hp_connect_rate: hpConnectRate,
    hp_answer_rate: hpAnswerRate,
    original: group,
    _isCreating: group._isCreating || false,
    _isPending: group._isPending || false,
    // One flag for "this row's figures are placeholders". It covers the
    // optimistic row the Add-client dialog inserts before the server has
    // answered, as well as a real group whose first refresh has not landed
    // — the two look identical to a reader, so they should look identical
    // on the row.
    _isSyncing: group._isSyncing || group._isCreating || group._isPending || false,
    leads: ghlContacts,
    "ad-spend": metaSpend,
    clicks: metaClicks,
    impressions: metaImpressions,
    conversions: metaLeads,
  };

  if (enhanced) {
    base.ghl_location_id = group.ghl_location_id ?? "";
    base.meta_ad_account_id = group.meta_ad_account_id ?? "";
    base.notes = group.notes ?? "";
    base.created_at = group.created_at ?? "";
    base.updated_at = group.updated_at ?? "";
    base.last_ghl_refresh = group.last_ghl_refresh ?? "";
    base.last_meta_refresh = group.last_meta_refresh ?? "";
    base.last_hp_refresh = group.last_hp_refresh ?? "";
    base.ghl_address = group.gohighlevel?.address ?? "";
    base.ghl_name = group.gohighlevel?.name ?? "";
    base.total_tags = getTotalTagCount(group);
    const topTags = getTopTags(group, 3);
    base.top_tag_string = topTags.map(([tag, count]) => `${tag} (${count})`).join(", ");

    columns.forEach((col) => {
      if (col.type === 'tag' && col.tagName) {
        base[col.id] = getSpecificTagCount(group, col.tagName);
      }
    });

    base.active_campaigns = getActiveCampaignCount(group);
    base.paused_campaigns = getPausedCampaignCount(group);
    base.meta_account_name = group.facebook?.name ?? "Unknown";
    base.meta_currency = group.facebook?.currency ?? "";

    const bestAd = getBestPerformingAd(group);
    base.best_ad_name = bestAd?.name ?? "";
    base.best_ad_ctr = bestAd?.ctr ?? 0;

    base.conversion_rate = metaClicks > 0 ? ((metaLeads / metaClicks) * 100) : 0;
    base.cost_per_lead = metaLeads > 0 ? (metaSpend / metaLeads) : 0;
    base.engagement_rate = metaImpressions > 0 ? (((metaClicks + metaResults) / metaImpressions) * 100) : 0;
    // ROAS and any other Birdy metric — one definition, applied after the
    // base fields it divides are on the row.
    applyDefaultMetrics(base);

    base.meta_freshness = getDataFreshness(group.last_meta_refresh);
    base.ghl_freshness = getDataFreshness(group.last_ghl_refresh);
    base.hp_freshness = getDataFreshness(group.last_hp_refresh);

    const accountAgeMs = group.created_at ? Date.now() - new Date(group.created_at) : 0;
    base.account_age_days = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
  }

  if (customMetrics) {
    customMetrics.forEach((metric) => {
      if (metric.formulaParts) {
        const result = evaluateFormula(metric.formulaParts, base);
        base[metric.id] = typeof result === 'object' ? 0 : (result ?? 0);
      }
    });
  }

  return base;
}
