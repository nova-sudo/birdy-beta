// The tints every card on this screen draws from. Metrics name a tone rather
// than a colour, so a stage in the funnel and its headline number in the KPI
// strip stay the same colour by saying the same word.
export const TONES = {
  primary: "bg-pd-primary-tint text-pd-primary",
  info: "bg-pd-info-bg text-pd-info",
  amber: "bg-pd-amber-bg text-pd-amber",
  warning: "bg-pd-warning-bg text-pd-warning",
  success: "bg-pd-success-bg text-pd-success",
  danger: "bg-pd-danger-bg text-pd-danger",
  // The one tone that is not a metric's own colour: it says the figure has no
  // source, so there is nothing here to colour-code. It exists because a
  // metric that has been dimmed to a grey dash while keeping its bright
  // purple icon chip reads as a live figure that happens to be missing, which
  // is the opposite of what the dash means. Both tokens are the existing
  // neutral pair from globals.css — the badge grey the side rail already uses
  // and the muted body text.
  neutral: "bg-pd-neutral-badge text-pd-subtle",
};

export function toneClass(tone) {
  return TONES[tone] ?? TONES.primary;
}
