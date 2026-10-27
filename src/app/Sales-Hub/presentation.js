// Which colour family each Sales Hub figure wears, and which curve
// it opens when clicked.
//
// Kept apart from the data so the hook stays about numbers and this stays about
// how they read. Tones name a colour family rather than a hex — see
// components/portfolio/tones.js — so a metric keeps its colour wherever it is
// drawn, and the palette can move in one place.
//
// `chartKey` is the series in SALES_CHART_METRICS the figure plots. It is a
// separate key rather than the figure's own because the two do not always
// measure the same thing: "Leads called" sums distinct leads reached in the
// window, while the only series the backend keeps for it is the first-contact
// cohort (see saleshub-series.js). Transfers has no series at all — it is Hot
// Prospector's own upstream count with no per-day version — so it has no
// chartKey, and the hero draws it as a figure that cannot be selected.
//
// Every metric here is a volume: more calls, more leads reached and more talk
// time are all good news, so none of them inverts. The Marketing Hub's CPL is
// the sibling screen's counter-example, and DeltaPill already takes a polarity
// for exactly that reason — nothing on this screen needs to pass one.

/** The five figures, in order; every one has a curve to show. */
export const KPI_PRESENTATION = [
  { key: "called", label: "Leads called", tone: "primary", chartKey: "called" },
  { key: "calls", label: "Total calls", tone: "info", chartKey: "calls" },
  { key: "inbound", label: "Inbound", tone: "success", chartKey: "inbound" },
  { key: "outbound", label: "Outbound", tone: "amber", chartKey: "outbound" },
  { key: "talk", label: "Talk time (min)", tone: "primary", chartKey: "talk" },
];
