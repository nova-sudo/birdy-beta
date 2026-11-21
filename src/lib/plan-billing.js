// Pure pieces of Settings › Plan & credits: which plan an account is on, its
// client slots, and where its AI credits went. Shapes are the backend's
// GET /api/billing/status, /api/credits/status and /api/credits/usage.

/** The most slots drawn one dot each; past this the grid would be noise. */
export const MAX_SLOT_DOTS = 100;

/** Price of one extra client slot on the plans that allow them, in dollars a month. */
export const EXTRA_CLIENT_PRICE = 10;

export const STATUS_WORDS = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceling: "Canceling",
  canceled: "Canceled",
  inactive: "No plan",
};

/** Pill tone per subscription status. */
export const STATUS_TONE = {
  active: "success",
  trialing: "accent",
  past_due: "warning",
  canceling: "warning",
  canceled: "danger",
  inactive: "neutral",
};

/** The plan from `plans` the account is subscribed to, or null. */
export function currentPlan(status, plans) {
  if (!status?.subscribed) return null;
  return plans.find((p) => p.id === status.plan?.id) ?? null;
}

/** The tier above `plan` in `order`, or null at the top. */
export function nextPlan(plan, plans, order) {
  if (!plan) return null;
  const id = order[order.indexOf(plan.id) + 1];
  return plans.find((p) => p.id === id) ?? null;
}

/**
 * What a tier's button does for this account.
 * @returns {"current"|"checkout"|"upgrade"|"downgrade"}
 */
export function planAction(plan, status, order) {
  if (!status?.subscribed) return "checkout";
  const current = status.plan?.id;
  if (current === plan.id) return "current";
  return order.indexOf(plan.id) < order.indexOf(current) ? "downgrade" : "upgrade";
}

/**
 * The client slots as the grid draws them: one entry per slot, "included"
 * and "extra" for slots in use (inside the plan's allowance, or paid on top),
 * "free" for the rest. Null when there is nothing to draw: no plan, no limit,
 * or more slots than a grid can show.
 */
export function slotGrid(status) {
  const limit = Number(status?.client_limit) || 0;
  if (!status?.subscribed || limit <= 0 || limit > MAX_SLOT_DOTS) return null;
  const used = Math.max(0, Number(status.client_count) || 0);
  const included = Math.max(0, limit - (Number(status.extra_clients_paid) || 0));
  return Array.from({ length: Math.max(limit, Math.min(used, MAX_SLOT_DOTS)) }, (_, i) => (i >= used ? "free" : i < included ? "included" : "extra"));
}

/** "6 Nov 2026". */
export function dateLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** The plan card's line under its title: renewal or cancellation date; null without a plan. */
export function periodLine(status) {
  if (!status?.subscribed) return null;
  const when = status.current_period_end ? dateLabel(status.current_period_end) : null;
  if (!when) return "Billed monthly";
  return `Billed monthly · ${status.cancel_at_period_end ? "ends" : "next bill"} ${when}`;
}

/**
 * Share of this period's allowance still left, 0 to 100, or null when the
 * account has no allowance to measure against.
 */
export function allowanceLeft(allowance, remaining) {
  if (!(allowance > 0)) return null;
  return Math.min(100, Math.max(0, (remaining / allowance) * 100));
}

const FEATURE_WORDS = { ask_birdy: "Ask Birdy", suggestions: "Suggestions" };

/** Where credits went, largest first, with each one's share of the largest. */
export function creditBreakdown(usage) {
  const rows = Object.entries(usage?.by_feature ?? {})
    .map(([key, credits]) => ({ key, label: FEATURE_WORDS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), credits: Math.round(Number(credits) || 0) }))
    .filter((r) => r.credits > 0)
    .sort((a, b) => b.credits - a.credits);
  const max = rows[0]?.credits ?? 0;
  return rows.map((r) => ({ ...r, share: max ? Math.max(1, (r.credits / max) * 100) : 0 }));
}

/** The packs offered: the 10k bulk tier is sold separately. */
export const offeredPacks = (packs = []) => packs.filter((p) => p.credits < 10_000);

/**
 * The address without one of its query flags (a Whop return flag once read),
 * keeping the rest, Settings' ?section= included.
 */
export function withoutParam(href, key) {
  const url = new URL(href, "http://x");
  url.searchParams.delete(key);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}
