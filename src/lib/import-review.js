// The rules of importing GoHighLevel sub-accounts as clients: which ones are
// listed, which are ticked to start with, how rows are ordered and searched,
// and what is sent. One definition, used by the first-run onboarding's review
// table and by the Clients page's Import dialog, so the two cannot drift.

// The largest plan (Scale) supports 25 clients. Pre-selecting or allowing more
// would only be truncated later by the server's client-limit check during the
// import, so it is capped here instead.
export const MAX_IMPORT_SELECTION = 25

// One collator for every row comparison. Undefined locale so it follows the
// reader's own alphabet; `numeric` so "Clinic 9" precedes "Clinic 10"; `base`
// so case and accents do not split the alphabet.
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

/**
 * The sub-accounts a review is about.
 *
 * `unimported` is everything not yet in Birdy. `accounts` is the part shown:
 * only sub-accounts with a lead in the last 90 days, where unknown recency
 * stays visible rather than silently hiding someone's client.
 */
export function listedAccounts(review) {
  const unimported = (review?.accounts || []).filter((a) => !a.already_imported)
  const accounts = unimported.filter((a) => a.leads_recent_90 !== false)
  const hasRecency = unimported.some((a) => a.leads_recent_90 !== null && a.leads_recent_90 !== undefined)
  return { unimported, accounts, hasRecency }
}

/**
 * The location ids ticked before the user touches anything: sub-accounts with
 * a lead in the last 7 days, most recent first, up to the selection cap.
 */
export function autoCheckedIds(accounts) {
  const eligible = accounts
    .filter((a) => a.leads_recent_7)
    .slice()
    .sort((a, b) => new Date(b.last_lead_at || 0) - new Date(a.last_lead_at || 0))
    .slice(0, MAX_IMPORT_SELECTION)
  return new Set(eligible.map((a) => a.location_id))
}

/**
 * Each account with the user's edits applied over the server's defaults.
 * `edits` is sparse: `{ [location_id]: { import?, birdyName?, fb?, status?, leadSource? } }`.
 */
export function resolveRows(accounts, edits, autoChecked) {
  return accounts.map((account) => {
    const edit = edits[account.location_id] || {}
    // Only a confident pairing arrives as fb_match, so this is the box's
    // value. fb_suggestion is the server's near-miss and deliberately does
    // not feed it: it is offered, never pre-selected.
    const fb = edit.fb !== undefined ? edit.fb : account.fb_match
    return {
      ...account,
      importChecked: edit.import !== undefined ? edit.import : autoChecked.has(account.location_id),
      birdyName: edit.birdyName !== undefined ? edit.birdyName : account.name,
      fb,
      suggestion: account.fb_suggestion || null,
      // The prep job writes 0 for a sub-account it read and found nothing in,
      // and leaves the field off entirely for one it has not reached. Those
      // are different answers and are shown differently.
      leads30dKnown: typeof account.leads_30d === "number",
      status: edit.status || account.status_default || "active",
      leadSource: edit.leadSource || "unknown",
    }
  })
}

/**
 * Ticked rows first, then everyone else, each block A to Z.
 *
 * Sorted on the GoHighLevel name, not the editable Birdy one: they are the
 * same until someone edits it, and sorting on the edited one would re-sort the
 * table on every keystroke, pulling the field out from under the cursor.
 */
export function orderRows(resolved) {
  return resolved
    .slice()
    .sort((a, b) =>
      a.importChecked !== b.importChecked
        ? a.importChecked ? -1 : 1
        : collator.compare(a.name || "", b.name || "")
    )
}

/** Whether a row matches a lower-cased, trimmed search. An empty search matches everything. */
export function rowMatches(row, query) {
  return (
    !query ||
    [row.birdyName, row.name, row.fb?.name, row.suggestion?.name].some(
      (field) => (field || "").toLowerCase().includes(query)
    )
  )
}

/** What the import request carries for the ticked rows. */
export function importPayload(resolved) {
  return resolved
    .filter((r) => r.importChecked)
    .map((r) => ({
      location_id: r.location_id,
      name: r.birdyName.trim() || r.name,
      meta_ad_account_id: r.fb?.id || null,
      ad_account_currency: r.fb?.currency || null,
      client_status: r.status === "active" ? "Active" : "Inactive",
      lead_collection_method: r.leadSource,
    }))
}
