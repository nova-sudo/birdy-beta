/**
 * The landing-page funnel, as the hubs draw it.
 *
 * The backend counts it (services/landing_funnel.py) and decides whether the
 * client has one at all; this file is only presentation — which icon and tone
 * each stage wears, and the two sentences the drop-off splits into.
 *
 * ── Why the exits get their own row ────────────────────────────────────────
 * A single "conversion rate" is the number every other tool already shows, and
 * it is the one that cannot be acted on. Everyone who did not opt in falls into
 * one of two groups, and they need opposite fixes:
 *
 *     left before touching the form   the page did not sell it — offer, copy,
 *                                     speed, the thing the ad promised
 *     started the form, abandoned it  the form did — too long, asking for too
 *                                     much, broken on a phone
 *
 * So the card draws them as two figures rather than one, which is the whole
 * reason the tracker reports a form start at all.
 *
 * Shares are of landing views throughout, matching lib/client-funnel.js — the
 * cohort framing, not stage-over-stage. Ad clicks are a slice of the views
 * rather than a step above them (an organic visitor is in one and not the
 * other), so that stage carries no share.
 */

import { formatSharePct } from "@/lib/client-funnel"

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

// What each stage is called when the bar is only a phone wide.
const SHORT_LABELS = { ad_views: "Ads", form_starts: "Form" }

/**
 * The API's stages as FunnelBar steps.
 *
 * The server sends `share` as a fraction of landing views and the count as a
 * number; both go straight through, with `share: null` kept explicit so the
 * bar does not compute one against the first step (ad clicks are a slice of the
 * views, not a step above them). Deltas arrive already resolved against the
 * previous window, so a stage with no comparable previous period simply has
 * none: an unknown movement is not a flat one.
 */
export function buildLandingSteps(funnel) {
  if (!funnel?.stages?.length) return null

  return funnel.stages.map((stage) => ({
    key: stage.key,
    label: stage.label,
    shortLabel: SHORT_LABELS[stage.key],
    value: num(stage.count),
    share: stage.share == null ? null : num(stage.share),
    hint: stage.hint,
    ...(stage.direction
      ? { delta: stage.direction === "down" ? -num(stage.delta) : num(stage.delta) }
      : {}),
  }))
}

/**
 * The two ways a visit ends in nothing, plus the headline.
 *
 * Returns null where nobody visited: "0 of 0 people left" is arithmetic on an
 * empty window dressed up as a finding.
 */
export function buildExitSplit(funnel) {
  const views = num(funnel?.totals?.views)
  const exits = funnel?.exits
  if (!views || !exits) return null

  return {
    total: num(exits.total),
    totalLabel: num(exits.total).toLocaleString(),
    rate: formatSharePct(exits.rate),
    rows: [
      {
        key: "before_form",
        label: "Left before touching the form",
        count: num(exits.before_form),
        countLabel: num(exits.before_form).toLocaleString(),
        share: formatSharePct(num(exits.before_form) / views),
        // What to do about it, which is the only reason to split the number.
        note: "The page itself — offer, headline, load speed, or an ad promising something the page doesn't deliver.",
      },
      {
        key: "abandoned_form",
        label: "Started the form, abandoned it",
        count: num(exits.abandoned_form),
        countLabel: num(exits.abandoned_form).toLocaleString(),
        share: formatSharePct(num(exits.abandoned_form) / views),
        note: "The form itself — too many fields, asking for too much too early, or broken on a phone.",
      },
    ],
  }
}

/**
 * One sentence naming where this page leaks, or null when it doesn't leak
 * anywhere in particular.
 *
 * Deliberately quiet unless one side clearly dominates. A page that loses 60%
 * before the form and 40% inside it has no single problem, and a verdict that
 * names one anyway teaches the reader to stop reading verdicts.
 */
export function diagnoseLandingFunnel(funnel) {
  const views = num(funnel?.totals?.views)
  const exits = funnel?.exits
  if (!views || !exits) return null

  const starts = num(funnel?.totals?.form_starts)
  const optIns = num(funnel?.totals?.opt_ins)

  // Too little traffic for a rate to mean anything. The threshold is low on
  // purpose — it only has to rule out the window where one visitor arriving
  // makes the opt-in rate 0% or 100%.
  if (views < 25) return null

  const before = num(exits.before_form)
  const abandoned = num(exits.abandoned_form)

  if (abandoned > before && starts > 0) {
    return {
      state: "problem",
      title: "The form is where they go",
      body: `${abandoned.toLocaleString()} visits started the form and didn't finish it — more than left the page without trying it at all. That points at the form, not the page.`,
    }
  }

  if (starts > 0 && before > abandoned * 3) {
    return {
      state: "problem",
      title: "Most never reach the form",
      body: `${formatSharePct(before / views)} of visits left without touching the form. The people who do start it mostly finish, so the page is losing them before the form gets a chance.`,
    }
  }

  if (optIns > 0) {
    return {
      state: "healthy",
      title: "Opting in at a steady rate",
      body: `${formatSharePct(optIns / views)} of landing views became a lead, with no single stage losing the rest.`,
    }
  }

  return null
}
