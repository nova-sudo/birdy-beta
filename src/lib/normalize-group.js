/**
 * Normalize the raw group_info from GET /api/client-groups/{id}
 * into the same shape that GET /api/client-groups (list) returns.
 *
 * The list endpoint transforms facebook_cache[preset] → facebook with
 * campaigns[], adsets[], ads[]. The single endpoint returns raw group_info.
 *
 * @param {Object} groupInfo - The raw group_info from the single-group API
 * @param {string} clientId - The client group ID
 * @param {string} datePreset - The date preset to resolve (e.g., "last_7d")
 */
export function normalizeGroupInfo(groupInfo, clientId, datePreset = "last_7d") {
  const fbCache = groupInfo.facebook_cache || {}
  const presetDoc = fbCache[datePreset] || {}

  return {
    id: clientId,
    name: groupInfo.name,
    ghl_location_id: groupInfo.ghl_location_id,
    meta_ad_account_id: groupInfo.meta_ad_account_id,
    ad_account_currency: groupInfo.ad_account_currency,
    status: groupInfo.status,
    notes: groupInfo.notes || "",
    facebook: {
      ad_account_id: fbCache.ad_account_id || groupInfo.meta_ad_account_id || "",
      currency: fbCache.currency || groupInfo.ad_account_currency || "USD",
      name: fbCache.name || "",
      total_leads: fbCache.total_leads || 0,
      campaigns: presetDoc.campaigns || [],
      adsets: presetDoc.adsets || [],
      ads: presetDoc.ads || [],
      metrics: presetDoc.metrics || {},
      date_preset: datePreset,
    },
    gohighlevel: groupInfo.gohighlevel_cache || {},
    hotprospector: groupInfo.hotprospector_cache || {},
  }
}
