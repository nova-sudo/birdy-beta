/**
 * Client status — one definition, used everywhere.
 *
 * `client_status` is written by the API as "Active" or "Inactive"
 * (routers/client_groups.py validates it), but the collection also holds rows
 * that predate that guard: 49 "Active", 18 "Inactive", and 9 lowercase
 * "active". Every surface here compared with `=== "Active"`, so those 9 groups
 * silently dropped out of the Clients stat cards and were counted as inactive
 * in the filter badges.
 *
 * The backend never had the bug — its queries use `{$ne: "Inactive"}`, which
 * treats an unrecognised value as active. These helpers bring the frontend
 * into line with that: compare case-insensitively, and treat a missing status
 * as active, which is what the API assumes when it creates a group.
 */

export const ACTIVE = "Active";
export const INACTIVE = "Inactive";

/** Canonical form of a stored status. Unknown values fall back to Active,
 *  matching the backend's `$ne: "Inactive"` semantics. */
export function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase() === "inactive" ? INACTIVE : ACTIVE;
}

/** Is this client group active? */
export function isActive(group) {
  return normalizeStatus(group?.client_status) === ACTIVE;
}

/** The active subset. Null-safe — callers often hold an unloaded list. */
export function activeGroups(groups) {
  return (groups ?? []).filter(isActive);
}

/** Does a group match a status filter of "all" | "Active" | "Inactive"?
 *  Both sides are normalized so a lowercase stored value still matches the
 *  filter chip the user clicked. */
export function matchesStatusFilter(group, filter) {
  if (!filter || filter === "all") return true;
  return normalizeStatus(group?.client_status) === normalizeStatus(filter);
}

/** {all, active, inactive} counts for the filter badges. */
export function statusCounts(groups) {
  const list = groups ?? [];
  const active = list.filter(isActive).length;
  return { all: list.length, active, inactive: list.length - active };
}
