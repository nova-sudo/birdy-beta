// Copy and checks for a client group's Meta campaign scope.
//
// meta_scope comes from the client-groups payloads: null when the group has
// no Meta account, else { mode: "all" | "selected", selected, total, shared,
// unassigned: [{ id, name }] }.

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`

/** "{n} unassigned campaign(s)", or null when there is nothing to assign. */
export function unassignedText(scope) {
  const n = scope?.unassigned?.length || 0
  return n > 0 ? plural(n, "unassigned campaign") : null
}

/** The value beside "Campaigns": "{n} of {total}" or "All campaigns". */
export function campaignsSummary(scope) {
  return scope?.mode === "selected" ? `${scope.selected} of ${scope.total}` : "All campaigns"
}

/** "Meta: {n} campaigns" for a group that owns only some campaigns. */
export function scopeChipLabel(scope) {
  return scope?.mode === "selected" ? `Meta: ${plural(scope.selected, "campaign")}` : null
}

const bareAccountId = (id) => String(id || "").replace(/^act_/, "")

/** Does any other loaded group already use this Meta ad account? */
export function sharesMetaAccount(groups, adAccountId, exceptGroupId = null) {
  const target = bareAccountId(adAccountId)
  if (!target) return false
  return (groups || []).some(
    (g) => g.id !== exceptGroupId && bareAccountId(g.meta_ad_account_id) === target
  )
}

/**
 * The group that keeps the rest of the account's campaigns when a new group
 * takes some: the oldest group on the account still set to all campaigns
 * (it is auto-split on save). Null when none is.
 */
export function remainderOwner(groups, adAccountId, exceptGroupId = null) {
  const target = bareAccountId(adAccountId)
  if (!target) return null
  const candidates = (groups || [])
    .filter(
      (g) =>
        g.id !== exceptGroupId &&
        bareAccountId(g.meta_ad_account_id) === target &&
        g.meta_campaign_ids == null
    )
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))
  return candidates[0]?.name ?? null
}
