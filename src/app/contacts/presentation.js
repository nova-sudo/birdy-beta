import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics";

// Which polarity each Lead Hub figure has — the Lead Hub sibling of
// Sales-Hub/presentation.js. Kept apart from the data so the totals hook stays
// about numbers and this stays about how they read.
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
  { key: "lead_count", label: "Total leads", polarity: HIGHER_IS_BETTER, chartKey: "leads" },
  { key: "contact_count", label: "Total contacts", polarity: HIGHER_IS_BETTER, chartKey: "contacts" },
  { key: "open", label: "Open leads", polarity: HIGHER_IS_BETTER, chartKey: "open" },
  { key: "lost", label: "Lost leads", polarity: LOWER_IS_BETTER, chartKey: "lost" },
  { key: "conversion_rate", label: "Conversion rate", polarity: HIGHER_IS_BETTER, chartKey: "conversion" },
];

// ─── Lead Hub hero: shaping for the ds components ───────────────────────────

/** A trend needs at least two points; one bucket (Today) is a figure, not a line. */
export const MIN_TREND_POINTS = 2;

/**
 * One chart metric (leadhub-series.js, plus the hook's formatted `pointValues`)
 * as ds MetricTabsChart points. `display` carries the formatted value so the
 * tooltip reads "3.4%" for conversion rather than the bare number.
 *
 * @param {{values?: number[], labels?: string[], tooltipLabels?: string[], pointValues?: string[]}} [metric]
 */
export function toTrendSeries(metric) {
  const values = metric?.values ?? [];
  if (values.length < MIN_TREND_POINTS) return [];
  return values.map((current, i) => ({
    x: metric.labels?.[i] ?? "",
    current,
    tooltipLabel: metric.tooltipLabels?.[i],
    display: metric.pointValues?.[i],
  }));
}

const TONE_ORDER = ["danger", "warning", "success", "info", "neutral"];

const joinParts = (parts) => (parts ?? []).map((p) => p.text).join("").trim();

/**
 * Birdy's headline sentence and findings as BirdyRead rows: the headline first,
 * then the findings, worst tone first. A finding's bold lead-in (a client name
 * or a figure) is the row title and the rest of the sentence its detail.
 *
 * @param {{text: string, strong?: boolean}[]} insight buildLeadInsight's sentence
 * @param {{tone?: string, parts: {text: string, strong?: boolean}[]}[]} findings buildLeadFindings
 * @param {{empty?: boolean}} [options] `empty`: the window has nothing to say, so no rows (BirdyRead shows its empty copy)
 */
export function toLeadFindings(insight, findings, { empty = false } = {}) {
  if (empty) return [];

  const rows = (findings ?? []).map((f, i) => {
    const [lead, ...rest] = f.parts ?? [];
    const leadsWithBold = Boolean(lead?.strong);
    return {
      id: `finding-${i}`,
      tone: TONE_ORDER.includes(f.tone) ? f.tone : "neutral",
      title: leadsWithBold ? lead.text.trim() : joinParts(f.parts),
      detail: leadsWithBold ? joinParts(rest) || undefined : undefined,
    };
  });
  rows.sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));

  return [{ id: "headline", tone: "info", title: joinParts(insight) }, ...rows];
}
