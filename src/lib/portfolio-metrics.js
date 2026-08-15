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
