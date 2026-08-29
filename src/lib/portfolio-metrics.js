// Delta semantics for the Portfolio Dashboard.
//
// Most metrics on this screen are better when they rise, but several are the
// other way round and the design colours them accordingly: a *fall* in average
// CPL, speed to lead or calls per close is good news and renders green with a
// down arrow, while a rise in calls per lead is bad news and renders red with
// an up arrow. Getting this backwards would invert the meaning of the whole
// strip, so direction and polarity are kept separate and combined in one place.

/** Metric improves as the number goes up (leads, closes, answer rate…). */
export const HIGHER_IS_BETTER = "higher-is-better";
/** Metric improves as the number goes down (CPL, speed to lead, calls/close…). */
export const LOWER_IS_BETTER = "lower-is-better";

/**
 * Is this movement good or bad for the reader?
 * @param {"up"|"down"} direction which way the number moved
 * @param {string} polarity HIGHER_IS_BETTER | LOWER_IS_BETTER
 * @returns {boolean} true when the movement should read as positive
 */
export function isImprovement(direction, polarity = HIGHER_IS_BETTER) {
  return polarity === LOWER_IS_BETTER ? direction === "down" : direction === "up";
}

/** Tailwind text/background pair for a delta, given its direction and polarity. */
export function deltaTone(direction, polarity = HIGHER_IS_BETTER) {
  return isImprovement(direction, polarity)
    ? { text: "text-pd-success", bg: "bg-pd-success-bg" }
    : { text: "text-pd-danger", bg: "bg-pd-danger-bg" };
}

// ─── Funnel diagnosis ───────────────────────────────────────────────────────

/**
 * A stage has to fall by more than this to be called a problem. Without a floor
 * the banner would cry wolf over ordinary week-to-week noise, and an agency
 * owner who sees "problem found" on a healthy funnel stops reading it.
 */
export const MATERIAL_DECLINE_PCT = 1;

/**
 * Work out what the funnel is telling us.
 *
 * The interesting case is a stage falling while the one feeding it rises: that
 * localises the problem to a step rather than to lead flow, which is the whole
 * point of showing the funnel. When nothing is materially down, the banner
 * names the strongest stage instead.
 *
 * @param {{stage: string, direction: "up"|"down", delta: number, issue?: string,
 *          stageNoun?: string}[]} stages in funnel order, top to bottom
 * @returns {{state: "problem"|"healthy", title: string, body: string}}
 */
export function diagnoseFunnel(stages) {
  const signed = (s) => (s.direction === "down" ? -s.delta : s.delta);

  // Only stages with a real movement can be diagnosed. Attributed stages are
  // derived from a single window's lead rows and have no prior period to
  // compare against, so they arrive with no delta at all — reading undefined
  // as zero would let a stage with no information win "strongest stage".
  const comparable = (stages ?? []).filter(
    (s) => (s.direction === "up" || s.direction === "down") && Number.isFinite(s.delta)
  );

  const declining = comparable
    .map((stage) => ({ stage, index: stages.indexOf(stage) }))
    .filter(({ stage }) => signed(stage) < -MATERIAL_DECLINE_PCT)
    .sort((a, b) => signed(a.stage) - signed(b.stage));

  if (declining.length === 0) {
    const best = [...comparable].sort((a, b) => signed(b) - signed(a))[0];
    if (!best) return { state: "healthy", title: "All looking good", body: "" };

    return {
      state: "healthy",
      title: "All looking good",
      body: `${best.stage} are up ${best.delta}% — the strongest stage across the funnel right now.`,
    };
  }

  const worst = declining[0];
  const upstream = stages[worst.index - 1];
  const noun = worst.stage.stageNoun ?? worst.stage.stage.toLowerCase();

  // Only contrast with the feeding stage when it actually rose — otherwise the
  // whole funnel is sliding and singling out one step would be misleading.
  const contrast =
    upstream && signed(upstream) > 0
      ? ` while ${upstream.stage.toLowerCase()} are up ${upstream.delta}% — the drop is at the ${noun} stage, not lead flow`
      : "";

  return {
    state: "problem",
    title: `Problem found: ${worst.stage.issue ?? noun}`,
    body: `${worst.stage.stage} are down ${worst.stage.delta}%${contrast}.`,
  };
}
