// Reads the per-day rows a creative test stores for each ad (spend, impressions,
// link_clicks, actions as Meta returns them). The backend sums leads as the max over
// its lead action types (Meta double-reports) and hook as the video_view action.

const LEAD_TYPES = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]
const VIDEO_VIEW = "video_view"

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

function actionValues(actions, types) {
  return (Array.isArray(actions) ? actions : []).filter((a) => types.includes(a?.action_type)).map((a) => n(a.value))
}

/** One stored day row as plain numbers. */
export function dayFigures(row) {
  return {
    spend: n(row?.spend),
    impressions: n(row?.impressions),
    linkClicks: n(row?.link_clicks ?? row?.inline_link_clicks),
    leads: Math.max(0, ...actionValues(row?.actions, LEAD_TYPES)),
    views: actionValues(row?.actions, [VIDEO_VIEW]).reduce((a, b) => a + b, 0),
  }
}

/** The four chart metrics from running totals. CTR and hook are percentages; null where undefined. */
export function metricsOf(t) {
  return {
    cpl: t.leads > 0 ? t.spend / t.leads : null,
    ctr: t.impressions > 0 ? (t.linkClicks / t.impressions) * 100 : null,
    hook: t.impressions > 0 ? (t.views / t.impressions) * 100 : null,
    leads: t.leads,
  }
}

const ZERO = { spend: 0, impressions: 0, linkClicks: 0, leads: 0, views: 0 }
const add = (a, b) => ({
  spend: a.spend + b.spend,
  impressions: a.impressions + b.impressions,
  linkClicks: a.linkClicks + b.linkClicks,
  leads: a.leads + b.leads,
  views: a.views + b.views,
})

/**
 * Cumulative-to-date points per ad, on a shared sorted date axis.
 * @param {Record<string, object[]>} days {meta_ad_id: day rows}
 * @param {string} metric cpl | ctr | hook | leads
 * @returns {{rows: object[], adIds: string[]}} rows are `{date, [adId]: number|null}`
 */
export function cumulativeRows(days, metric) {
  const adIds = Object.keys(days ?? {})
  const dates = [...new Set(adIds.flatMap((id) => (days[id] ?? []).map((d) => d.date)).filter(Boolean))].sort()
  const byAd = Object.fromEntries(
    adIds.map((id) => [id, new Map((days[id] ?? []).map((d) => [d.date, dayFigures(d)]))])
  )
  const running = Object.fromEntries(adIds.map((id) => [id, ZERO]))
  const seen = Object.fromEntries(adIds.map((id) => [id, false]))
  const rows = dates.map((date) => {
    const row = { date }
    for (const id of adIds) {
      const day = byAd[id].get(date)
      if (day) {
        running[id] = add(running[id], day)
        seen[id] = true
      }
      row[id] = seen[id] ? (metricsOf(running[id])[metric] ?? null) : null
    }
    return row
  })
  return { rows, adIds }
}

/** Per-date totals across the given ads' rows (not cumulative): {date, spend, leads, cpl}. */
export function dailyTotals(dayLists) {
  const byDate = new Map()
  for (const list of dayLists)
    for (const d of list ?? []) {
      if (!d?.date) continue
      byDate.set(d.date, add(byDate.get(d.date) ?? ZERO, dayFigures(d)))
    }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, t]) => ({ date, spend: t.spend, leads: t.leads, cpl: t.leads > 0 ? t.spend / t.leads : null }))
}
