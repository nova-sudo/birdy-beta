// Which curve each Sales Hub figure opens when clicked.
//
// Kept apart from the data so the hook stays about numbers and this stays about
// how they read.
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
// time are all good news, so none of them inverts and the hero draws no delta
// (no Sales Hub figure carries a comparison window).

/** The five figures, in order; every one has a curve to show. */
export const KPI_PRESENTATION = [
  { key: "called", label: "Leads called", chartKey: "called" },
  { key: "calls", label: "Total calls", chartKey: "calls" },
  { key: "inbound", label: "Inbound", chartKey: "inbound" },
  { key: "outbound", label: "Outbound", chartKey: "outbound" },
  { key: "talk", label: "Talk time (min)", chartKey: "talk" },
];
