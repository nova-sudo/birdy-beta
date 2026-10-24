// How readily Birdy flags an ad as worth pausing in its weekly and monthly
// suggestions. The thresholds are the backend's STRICTNESS_PROFILES
// (ai/suggestions/agents/useless_ad_purger.py), in the account's currency,
// weekly figures — keep the two in step.
export const STRICTNESS_OPTIONS = [
  {
    value: "lenient",
    label: "Lenient",
    detail: "Only the clearest waste: 100+ spent in a week with no leads, or a cost per lead over 2.25× the client's median, from 60 of spend. At most 2 ads per client.",
  },
  {
    value: "balanced",
    label: "Balanced (default)",
    detail: "50+ spent in a week with no leads, or a cost per lead over 1.75× the client's median, from 30 of spend. At most 3 ads per client.",
  },
  {
    value: "strict",
    label: "Strict",
    detail: "Flags sooner: 25+ spent with no leads, or a cost per lead over 1.35× the client's median, from 15 of spend. At most 6 ads per client.",
  },
]
