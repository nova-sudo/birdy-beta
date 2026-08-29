/**
 * Colouring a metric against the target the agency actually set.
 *
 * Deliberately narrow. The Client Hub handoff asks whether CPL should redden
 * "past a threshold" and whether ROAS should green "above a target multiple
 * (e.g. 4x)" — but it names no numbers, and a threshold nobody chose is a
 * judgement invented on their behalf. A client at £9 CPL is doing well or
 * badly depending entirely on what they set out to pay, which is exactly what
 * `targets` records.
 *
 * So: colour only where a target exists, and leave everything else neutral.
 * ROAS has no target field anywhere, so it is never coloured.
 */

// Matches the goals strip and the health pace band, so a client cannot read
// green on one screen and behind on another.
const GOOD_RATIO = 0.9
const BAD_RATIO = 0.7

export const TONE = {
  good: "text-[#25A55F]",
  warn: "text-[#E0920A]",
  bad: "text-[#E5484D]",
  neutral: "",
}

/**
 * @param value    the measured figure
 * @param target   what the client aims for; null/0 means "no opinion"
 * @param polarity "lower" for costs (under target is winning), else "higher"
 * @returns a Tailwind text-colour class, or "" when there is nothing to say
 */
export function metricTone(value, target, polarity = "lower") {
  const v = Number(value)
  const t = Number(target)
  if (!Number.isFinite(v) || !Number.isFinite(t) || t <= 0) return TONE.neutral
  // A zero cost is not a triumph, it means nothing was spent or nothing landed.
  if (v === 0) return TONE.neutral

  const ratio = polarity === "lower" ? t / v : v / t
  if (ratio >= GOOD_RATIO) return TONE.good
  if (ratio >= BAD_RATIO) return TONE.warn
  return TONE.bad
}
