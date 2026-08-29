// The six tints every card on this screen draws from. Metrics name a tone
// rather than a colour, so a stage in the funnel and its headline number in the
// KPI strip stay the same colour by saying the same word.
export const TONES = {
  primary: "bg-pd-primary-tint text-pd-primary",
  info: "bg-pd-info-bg text-pd-info",
  amber: "bg-pd-amber-bg text-pd-amber",
  warning: "bg-pd-warning-bg text-pd-warning",
  success: "bg-pd-success-bg text-pd-success",
  danger: "bg-pd-danger-bg text-pd-danger",
};

export function toneClass(tone) {
  return TONES[tone] ?? TONES.primary;
}
