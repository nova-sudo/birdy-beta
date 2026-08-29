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

/* ── Health ───────────────────────────────────────────────────────────────
 * A separate, manually-set axis: a client can be Inactive and Healthy, or
 * Active and Critical. Nothing derives it — see components/clients/HealthPill.
 * Normalised the same way status is, so a value stored in another casing still
 * matches the tab you clicked.
 */

export const HEALTHY = "Healthy";
export const WARNING = "Warning";
export const CRITICAL = "Critical";
export const HEALTH_VALUES = [HEALTHY, WARNING, CRITICAL];

/** Canonical form of a stored health. Anything unrecognised — including the
 *  clients who have never had one chosen — reads as Healthy, matching the
 *  API's own default. */
export function normalizeHealth(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return HEALTH_VALUES.find((h) => h.toLowerCase() === v) ?? HEALTHY;
}

/** Does a group match a health filter of "all" | "Healthy" | "Warning" | "Critical"? */
export function matchesHealthFilter(group, filter) {
  if (!filter || filter === "all") return true;
  return normalizeHealth(group?.health) === normalizeHealth(filter);
}

/** Per-health counts for the Client Hub tab badges. */
export function healthCounts(groups) {
  const list = groups ?? [];
  return HEALTH_VALUES.reduce((acc, h) => {
    acc[h.toLowerCase()] = list.filter((g) => normalizeHealth(g?.health) === h).length;
    return acc;
  }, {});
}
