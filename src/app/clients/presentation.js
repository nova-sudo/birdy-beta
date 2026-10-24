// What the Client Hub table says about each client. The page is composition and
// wiring; the arithmetic and the labels live here so they can be tested without
// rendering.

import { groupMetrics } from "@/lib/portfolio-aggregate";
import { subtractPeriods } from "@/lib/portfolio-series";
import { isActive, normalizeHealth } from "@/lib/client-status";
import { HEALTH_TONE } from "@/components/clients/HealthPill";

export { HEALTH_TONE };

/** "acme DENTAL" -> "Acme Dental" */
export function titleCase(name) {
  return String(name ?? "—")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Signed percent change in cost per lead, or null when either side is unknown. */
export function cplDelta(cpl, previousCpl) {
  if (!(cpl > 0) || !(previousCpl > 0)) return null;
  return ((cpl - previousCpl) / previousCpl) * 100;
}

/**
 * The previous period's cost per lead for one client.
 *
 * Some presets compare against an enclosing window ("last 7 days" against "last
 * 14 days"), so the current window is taken back out of it first.
 */
function previousCpl(current, previous, comparison) {
  if (!previous) return null;
  const before = groupMetrics(previous);
  if (comparison?.subtractCurrent) {
    return subtractPeriods(
      { spend: before.spend, leads: before.leads },
      { spend: current.spend, leads: current.leads }
    ).cpl;
  }
  return before.leads > 0 ? before.spend / before.leads : null;
}

/** The status cell for a row: a syncing client has no measurements yet. */
export function statusOf(row) {
  if (row.syncing) return { label: "Syncing", tone: "info" };
  return row.active ? { label: "Active", tone: "success" } : { label: "Inactive", tone: "neutral" };
}

/**
 * One table row per client group.
 *
 * @param {object[]} groups client groups as /api/client-groups returns them,
 *        with the page's `_isSyncing` flag where figures are placeholders
 * @param {object[]|null} previousGroups the comparison window's groups, or null
 * @param {{preset: string, subtractCurrent?: boolean}|undefined} comparison
 */
export function clientRows(groups, previousGroups, comparison) {
  const previousById = new Map((previousGroups ?? []).map((g) => [g.id, g]));

  return (groups ?? []).map((group) => {
    const m = groupMetrics(group);
    const syncing = Boolean(group._isSyncing);
    const cpl = !syncing && m.leads > 0 && m.spend > 0 ? m.spend / m.leads : null;
    const health = normalizeHealth(group.health);

    return {
      id: group.id,
      name: titleCase(group.name || "Unnamed Group"),
      group,
      active: isActive(group),
      syncing,
      health,
      leads: syncing ? null : m.leads,
      spend: syncing ? null : m.spend,
      currency: m.currency,
      cpl,
      cplDelta: cpl == null ? null : cplDelta(cpl, previousCpl(m, previousById.get(group.id), comparison)),
    };
  });
}
