// lib/metric-sources.js
// Maps a catalog metric's backend category onto the six sources the Metrics
// Hub design paints, and onto the tab that filters for it.
//
// The design mocks its own metric list ("Revenue", "Suggestions Sent"…) — those
// names don't exist. What is real comes from routers/metrics.py, whose
// categories are finer-grained than the design's six badges: Meta account-level
// and campaign-level metrics are two categories but one source, and the call
// centre splits group- from agent-level the same way. The badge answers "where
// does this number come from", so both halves of each pair collapse into one.

/** Badge palette, straight from the handoff. */
export const SOURCE_STYLES = {
  meta: { label: "Meta Ads", color: "#3B7DD6", bg: "#EAF1FD", border: "#D6E6FA" },
  ghl: { label: "GoHighLevel", color: "#25A55F", bg: "#EDF8F1", border: "#D5EEDF" },
  // Named for the system the numbers come out of, not the department they
  // describe — "Sales" left the row unable to answer the one question the
  // column asks. Every call-centre metric in the catalog is an `hp_*` field
  // pulled from HotProspector, the only dialler wired to Birdy; the day a
  // second one lands, this splits by metric rather than by category.
  sales: { label: "HotProspector", color: "#B4530A", bg: "#FDF1E7", border: "#F5DDC0" },
  birdy: { label: "Birdy", color: "#6B4EE6", bg: "#F1EEFC", border: "#E3DAFB" },
  tag: { label: "Tags", color: "#C93B8C", bg: "#FCEDF6", border: "#F5D6EA" },
  custom: { label: "Custom Formula", color: "#6B4EE6", bg: "#F1EEFC", border: "#E3DAFB" },
}

const CATEGORY_TO_SOURCE = {
  "Meta Ads": "meta",
  Campaigns: "meta",
  GoHighLevel: "ghl",
  // opportunityValue — a GHL opportunity field, catalogued separately only
  // because it resolves per lead rather than per group.
  "Lead Fields": "ghl",
  "Call Center": "sales",
  "Call Center Agents": "sales",
  // Ratios Birdy derives rather than reads: conversion rate, CPL, engagement.
  Calculated: "birdy",
  Tags: "tag",
  "Custom Formula": "custom",
}

/**
 * @param {string} category Backend `category`, or "Custom Formula".
 * @returns {"meta"|"ghl"|"sales"|"birdy"|"tag"|"custom"} Falls back to `birdy`
 *   — a category we haven't mapped is something Birdy computed, and a neutral
 *   purple badge beats an empty cell or a wrong logo.
 */
export function sourceForCategory(category) {
  return CATEGORY_TO_SOURCE[category] || "birdy"
}

/** Tab strip, in the design's order. `all` first, custom formulas last. */
export const SOURCE_TABS = [
  { key: "all", label: "All Metrics" },
  { key: "ghl", label: "GHL Metrics" },
  { key: "meta", label: "Meta Metrics" },
  { key: "sales", label: "Sales Metrics" },
  { key: "birdy", label: "Birdy Metrics" },
  { key: "tag", label: "Tag Metrics" },
  { key: "custom", label: "Custom Formulas" },
]

export function matchesSourceTab(tab, source) {
  return tab === "all" || tab === source
}
