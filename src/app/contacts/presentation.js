import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics";

// Which colour family and polarity each Lead Hub figure wears — the
// Lead Hub sibling of Sales-Hub/presentation.js. Kept apart from the data so
// the totals hook stays about numbers and this stays about how they read.
//
// Unlike Sales-Hub's figures (all volumes, all "more is better"), two of these
// invert: *lost leads* rising is bad news, and *conversion rate* falling is
// bad news even though it isn't a volume at all. Polarity travels with the
// figure's definition so leadhub-totals.js's delta builder and the hero's delta
// pills agree on which direction is good without either having to know why.
//
// `chartKey` names the figure's series in leadhub-series.js — the hero draws
// each figure as a tab over the chart, and clicking one plots that series.
// Opportunities has no series of its own (it is the sum of open, won, lost
// and abandoned), so it stays a figure in the row without being selectable.

/** The five figures, in order; every one has a curve to show. */
export const KPI_PRESENTATION = [
  { key: "lead_count", label: "Total leads", tone: "primary", polarity: HIGHER_IS_BETTER, chartKey: "leads" },
  { key: "contact_count", label: "Total contacts", tone: "info", polarity: HIGHER_IS_BETTER, chartKey: "contacts" },
  { key: "open", label: "Open leads", tone: "primary", polarity: HIGHER_IS_BETTER, chartKey: "open" },
  { key: "lost", label: "Lost leads", tone: "danger", polarity: LOWER_IS_BETTER, chartKey: "lost" },
  { key: "conversion_rate", label: "Conversion rate", tone: "amber", polarity: HIGHER_IS_BETTER, chartKey: "conversion" },
];
