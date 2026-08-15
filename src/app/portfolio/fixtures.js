import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics";

// Design-reference figures from the handoff, keyed by timeframe.
//
// These are placeholders that let the screen be built and reviewed against the
// design before the portfolio endpoints exist. PR-10 puts usePortfolioData in
// front of them, so the components keep this shape and only the source changes.

export const KPIS = {
  spend: {
    label: "Total ad spend",
    polarity: HIGHER_IS_BETTER,
    Monthly: { value: "£142,860", direction: "up", delta: "8.4%" },
    Weekly: { value: "£33,410", direction: "down", delta: "1.6%" },
    Daily: { value: "£4,772", direction: "up", delta: "5.7%" },
  },
  leads: {
    label: "Total leads",
    polarity: HIGHER_IS_BETTER,
    Monthly: { value: "24,918", direction: "up", delta: "12.1%" },
    Weekly: { value: "5,842", direction: "up", delta: "4.8%" },
    Daily: { value: "812", direction: "down", delta: "2.1%" },
  },
  cpl: {
    label: "Average CPL",
    // Cheaper leads are better — a fall here is the good news.
    polarity: LOWER_IS_BETTER,
    Monthly: { value: "£5.73", direction: "down", delta: "3.3%" },
    Weekly: { value: "£5.72", direction: "up", delta: "1.4%" },
    Daily: { value: "£5.88", direction: "up", delta: "2.7%" },
  },
  closes: {
    label: "Closed Leads",
    polarity: HIGHER_IS_BETTER,
    Monthly: { value: "3,182", direction: "up", delta: "6.9%" },
    Weekly: { value: "744", direction: "up", delta: "9.2%" },
    Daily: { value: "106", direction: "up", delta: "3.4%" },
  },
};

// ─── Right rail ─────────────────────────────────────────────────────────────

export const SUGGESTIONS = [
  {
    id: "s1",
    severity: "HIGH",
    client: "Palm Peach Body Sculpt",
    title: "Pause 2 underperforming ads",
    why: "£48 CPL vs £22 target · 0 leads in 5 days · £312 spent.",
  },
  {
    id: "s2",
    severity: "OPPORTUNITY",
    client: "BBL Body Confidence",
    title: "Scale winning ad set +20%",
    why: "ROAS holding at 4.9x with CPL down 18% over 7 days.",
  },
  {
    id: "s3",
    severity: "MEDIUM",
    client: "The Body Room",
    title: "Refresh ad creative",
    why: "CTR fell 4.8% → 2.1% while frequency climbed to 3.4.",
  },
  {
    id: "s4",
    severity: "MEDIUM",
    client: "Aura",
    title: "Raise daily budget £20",
    why: "Hitting budget cap by 2pm — losing afternoon lead volume.",
  },
];

// "Auto-run" is Birdy acting under standing approval; "Approved" is a change
// the user signed off. The distinction is the whole point of the feed — an
// owner needs to see at a glance what happened without them.
export const ACTIVITY = [
  { id: "a1", action: "Paused 2 ads over CPL threshold", client: "Contour Aesthetics By Abi", mode: "Auto-run", time: "4 min ago" },
  { id: "a2", action: "Increased daily budget to £48", client: "Tylaesthetics", mode: "Approved", time: "22 min ago" },
  { id: "a3", action: "Rotated in new creative set", client: "The Body Room", mode: "Approved", time: "1 hr ago" },
  { id: "a4", action: "Paused ad set — zero conversions", client: "Thee Vision Studio", mode: "Auto-run", time: "2 hrs ago" },
  { id: "a5", action: "Reallocated £120 to top ad set", client: "The Contour Co", mode: "Approved", time: "3 hrs ago" },
  { id: "a6", action: "Fixed GHL lead sync mapping", client: "Konfidence Clinic", mode: "Auto-run", time: "4 hrs ago" },
  { id: "a7", action: "Lowered bid cap to £18", client: "Casey Beauty", mode: "Approved", time: "5 hrs ago" },
  { id: "a8", action: "Duplicated winning ad set", client: "Beauty Hub Mcr", mode: "Approved", time: "6 hrs ago" },
];

/** The feed shows a page of entries; the badge counts everything behind it. */
export const ACTIVITY_TOTAL = 14;

// ─── Call insights ──────────────────────────────────────────────────────────
// Order is deliberate and worth preserving: volume → speed → contact quality →
// effort → outcome. Three of the six improve as they fall, which is what the
// polarity flag carries.

export const CALL_INSIGHTS = [
  { key: "total", label: "Total calls", value: "18,402", direction: "up", delta: "9.2%", polarity: HIGHER_IS_BETTER },
  { key: "speed", label: "Speed to lead", value: "4m 12s", direction: "down", delta: "1m06", polarity: LOWER_IS_BETTER },
  { key: "answer", label: "Unique answer rate", value: "62.4%", direction: "up", delta: "3.1pts", polarity: HIGHER_IS_BETTER },
  { key: "perLead", label: "Calls per lead", value: "2.3", direction: "up", delta: "0.2", polarity: LOWER_IS_BETTER },
  { key: "perClose", label: "Calls per close", value: "5.8", direction: "down", delta: "0.4", polarity: LOWER_IS_BETTER },
  { key: "conversion", label: "Conversion rate", value: "17.3%", direction: "up", delta: "1.8pts", polarity: HIGHER_IS_BETTER },
];

// ─── Performance funnel ─────────────────────────────────────────────────────
// `issue` and `stageNoun` exist so the diagnostic banner can write a sentence
// about whichever stage is failing without a lookup table of special cases —
// "Problem found: close rate", "the drop is at the closing stage".

export const FUNNEL_STAGES = [
  { key: "leads", stage: "Leads", count: "24,918", direction: "up", delta: 12.1, issue: "lead flow", stageNoun: "lead" },
  { key: "engaged", stage: "Engaged", count: "19,340", direction: "up", delta: 9.4, issue: "engagement", stageNoun: "engagement" },
  { key: "convos", stage: "Convos", count: "11,204", direction: "up", delta: 6.2, issue: "conversation rate", stageNoun: "conversation" },
  { key: "closes", stage: "Closes", count: "3,182", direction: "down", delta: 4.8, issue: "close rate", stageNoun: "closing" },
  { key: "shows", stage: "Shows", count: "2,741", direction: "up", delta: 3.1, issue: "show rate", stageNoun: "show" },
];

// ─── Top performing clients ─────────────────────────────────────────────────
// Each metric carries its own ranking, its own supporting meta, and its own bar
// widths — switching the picker re-ranks the whole list rather than re-sorting
// one set of rows, because "best" means something different per metric and the
// meta line changes with it (spend/leads for CPL, closes/AOV for revenue).

export const TOP_CLIENT_METRICS = ["Avg CPL", "Closes", "Leads", "Revenue"];

export const TOP_CLIENTS = {
  "Avg CPL": [
    { name: "The Body Room", meta: "£116 spend · 85 leads", bar: 100, value: "£1.37", direction: "up", delta: "14%" },
    { name: "Beauty Hub Mcr", meta: "£70 spend · 50 leads", bar: 94, value: "£1.41", direction: "up", delta: "9%" },
    { name: "The Contour Co", meta: "£118 spend · 81 leads", bar: 91, value: "£1.45", direction: "up", delta: "11%" },
    { name: "Tylaesthetics", meta: "£124 spend · 83 leads", bar: 88, value: "£1.49", direction: "up", delta: "18%" },
    { name: "BBL Body Confidence", meta: "£72 spend · 46 leads", bar: 80, value: "£1.57", direction: "up", delta: "6%" },
  ],
  Closes: [
    { name: "Tylaesthetics", meta: "83 leads · 17.2% conv", bar: 100, value: "214", direction: "up", delta: "21%" },
    { name: "The Contour Co", meta: "81 leads · 15.8% conv", bar: 88, value: "188", direction: "up", delta: "12%" },
    { name: "The Body Room", meta: "85 leads · 14.1% conv", bar: 80, value: "171", direction: "up", delta: "9%" },
    { name: "Beauty Hub Mcr", meta: "50 leads · 16.4% conv", bar: 62, value: "132", direction: "up", delta: "7%" },
    { name: "Aura", meta: "40 leads · 15.1% conv", bar: 51, value: "109", direction: "up", delta: "4%" },
  ],
  Leads: [
    { name: "The Body Room", meta: "£116 spend · £1.37 CPL", bar: 100, value: "1,842", direction: "up", delta: "16%" },
    { name: "Tylaesthetics", meta: "£124 spend · £1.49 CPL", bar: 93, value: "1,714", direction: "up", delta: "18%" },
    { name: "The Contour Co", meta: "£118 spend · £1.45 CPL", bar: 89, value: "1,640", direction: "up", delta: "11%" },
    { name: "Beauty Hub Mcr", meta: "£70 spend · £1.41 CPL", bar: 64, value: "1,178", direction: "up", delta: "9%" },
    { name: "BBL Body Confidence", meta: "£72 spend · £1.57 CPL", bar: 55, value: "1,012", direction: "up", delta: "6%" },
  ],
  Revenue: [
    { name: "Tylaesthetics", meta: "214 closes · £1.4k AOV", bar: 100, value: "£298k", direction: "up", delta: "23%" },
    { name: "The Contour Co", meta: "188 closes · £1.3k AOV", bar: 85, value: "£254k", direction: "up", delta: "14%" },
    { name: "The Body Room", meta: "171 closes · £1.2k AOV", bar: 71, value: "£211k", direction: "up", delta: "10%" },
    { name: "Beauty Hub Mcr", meta: "132 closes · £1.1k AOV", bar: 50, value: "£149k", direction: "up", delta: "8%" },
    { name: "Aura", meta: "109 closes · £1.1k AOV", bar: 41, value: "£122k", direction: "up", delta: "5%" },
  ],
};

// ─── Trend chart ────────────────────────────────────────────────────────────
// Series are in normalised units; the chart scales them between their own min
// and max. Each timeframe has a deliberately different shape — monthly trends
// upward, weekly and daily are choppier with genuine peaks and dips — so metric
// and timeframe switching visibly changes the line rather than just its labels.

export const CHART_METRICS = {
  leads: {
    tab: "Leads",
    title: "Total leads",
    subtitle: "Lead volume across the portfolio",
    // Multiplier turning a normalised point back into a readable figure.
    scale: 27,
    Monthly: [52, 61, 58, 70, 66, 74, 69, 80, 86, 79, 92, 100],
    Weekly: [74, 68, 81, 77, 63, 88, 72, 95, 84, 70, 91, 86],
    Daily: [41, 58, 49, 72, 38, 66, 54, 83, 45, 77, 62, 90],
    totals: {
      Monthly: { total: "24,918", direction: "up", delta: "12.1%" },
      Weekly: { total: "5,842", direction: "up", delta: "4.8%" },
      Daily: { total: "812", direction: "down", delta: "2.1%" },
    },
  },
  spend: {
    tab: "Ad spend",
    title: "Total ad spend",
    subtitle: "Combined Meta spend across the portfolio",
    scale: 148,
    prefix: "£",
    Monthly: [60, 64, 58, 72, 68, 76, 71, 82, 78, 88, 84, 95],
    Weekly: [88, 72, 79, 64, 91, 70, 83, 58, 76, 94, 67, 81],
    Daily: [47, 83, 55, 91, 62, 74, 40, 88, 57, 79, 66, 95],
    totals: {
      Monthly: { total: "£142,860", direction: "up", delta: "8.4%" },
      Weekly: { total: "£33,410", direction: "down", delta: "1.6%" },
      Daily: { total: "£4,772", direction: "up", delta: "5.7%" },
    },
  },
  calls: {
    tab: "Calls",
    title: "Total calls",
    subtitle: "Outbound and inbound call volume",
    scale: 21,
    Monthly: [48, 55, 62, 58, 66, 72, 64, 78, 70, 84, 80, 90],
    Weekly: [80, 64, 92, 71, 58, 86, 66, 94, 73, 61, 88, 76],
    Daily: [66, 44, 88, 52, 79, 37, 91, 58, 70, 48, 84, 61],
    totals: {
      Monthly: { total: "18,402", direction: "up", delta: "9.2%" },
      Weekly: { total: "4,318", direction: "up", delta: "2.9%" },
      Daily: { total: "624", direction: "down", delta: "4.3%" },
    },
  },
  conversions: {
    tab: "Closes",
    title: "Total closes",
    subtitle: "Consultations booked across the portfolio",
    scale: 4.3,
    Monthly: [44, 50, 47, 56, 61, 55, 64, 58, 72, 68, 80, 88],
    Weekly: [62, 71, 55, 68, 80, 59, 74, 66, 88, 72, 61, 79],
    Daily: [55, 38, 67, 44, 72, 51, 83, 46, 60, 88, 42, 69],
    totals: {
      Monthly: { total: "3,182", direction: "up", delta: "6.9%" },
      Weekly: { total: "744", direction: "up", delta: "9.2%" },
      Daily: { total: "106", direction: "up", delta: "3.4%" },
    },
  },
};

export const CHART_AXIS = {
  Monthly: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
  Weekly: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
  Daily: ["1", "3", "6", "9", "12", "14", "17", "20", "23", "25", "28", "31"],
};

// Deriving the render shapes from this data lives in lib/portfolio-view, which
// takes the payload as an argument so the same functions serve the live API
// response and these fixtures.
