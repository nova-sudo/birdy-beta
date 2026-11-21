// Settings › Connections › Lead tracking per client: where each client's leads
// come from, and whether the tracking behind it is live. Rows come from
// GET /attribution/overview.

import { leadSourceOption, needsPixel, normalizeLeadSource } from "@/lib/lead-sources";

/** "just now", "5m ago", "3h ago", "2d ago", or null. */
export function hitAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((now - then) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** How many clients have a lead source chosen, out of all of them. */
export function trackingSummary(clients = []) {
  const total = clients.length;
  const unset = clients.filter((c) => normalizeLeadSource(c.method) === "unknown").length;
  return { total, unset, set: total - unset };
}

/**
 * One table row per client.
 * `script` is "none" when the source needs no pixel (Meta forms and form tools
 * that send to GoHighLevel are not failing to install anything), else "live"
 * or "not_seen".
 */
export function trackingRow(row, now = Date.now()) {
  const method = normalizeLeadSource(row.method);
  const needsScript = needsPixel(method);
  return {
    id: row.group_id,
    name: row.group_name,
    method,
    source: leadSourceOption(method).short,
    needsScript,
    script: !needsScript ? "none" : row.installed ? "live" : "not_seen",
    lastHit: hitAgo(row.last_seen_at, now),
    captured: needsScript ? row.tracked_leads ?? 0 : null,
    siteId: row.site_id || null,
  };
}

/** The link to send whoever owns a client's site, so they can install the pixel. */
export const installLink = (origin, siteId) => `${origin.replace(/\/$/, "")}/install/${siteId}`;

/** A client's tracking setup page. */
export const trackingSetupHref = (groupId) => `/clients/${groupId}/tracking`;
