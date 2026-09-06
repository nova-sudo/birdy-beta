// lib/client-loading.js
// Whether a client group is still waiting for the first data it will ever have.
//
// `status` does NOT answer this, which is the bug this exists to fix. The bulk
// import sets `status: "creating"` and its background task flips it to
// "complete" the moment the GHL *location token* is minted — its own
// status_message says so: "Imported — historical data syncing in the
// background". That happens in seconds. The contacts, leads and spend arrive
// minutes or hours later, when the cron ticks pick the group up because
// `last_*_refresh` is None.
//
// So for the whole window in between, twenty-five freshly imported clients sat
// in the table looking finished and reporting 0 leads, 0 spend, 0 everything —
// indistinguishable from a client who genuinely has none. Only the very first
// client looked busy, because it alone was still `creating` while its Meta
// refresh job ran.
//
// The honest signal is per integration: has each thing this client is actually
// connected to ever completed a refresh? Asking it that way matters — keying
// off `last_ghl_refresh` alone would leave a Meta-only client shimmering
// forever, because nothing will ever write a GHL timestamp for a client with
// no GHL location.

/** The group document is still being wired up — not clickable yet. */
export function isBeingCreated(group) {
  const status = group?.status
  return status === "creating" || status === "pending"
}

/**
 * The group exists and is usable, but no integration it has has finished its
 * first refresh, so every number on the row is a placeholder rather than a
 * measurement.
 */
export function isAwaitingFirstData(group) {
  if (!group) return false
  if (isBeingCreated(group)) return true

  if (group.ghl_location_id && !group.last_ghl_refresh) return true
  if (group.meta_ad_account_id && !group.last_meta_refresh) return true
  // Only when HotProspector is the client's chosen dialler. A "ghl" or "none"
  // client has no HP refresh coming and must not wait for one.
  if (group.call_log_provider === "hotprospector" && !group.last_hp_refresh) return true

  return false
}
