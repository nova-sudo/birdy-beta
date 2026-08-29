// The Client Detail overview chart's four series, for one client.
//
// Same shape as the Lead Hub's and Sales Hub's builders and reusing the same
// bucketing, but scoped to a single group and drawing from two independent
// caches: GHL's daily lead rows and Meta's daily spend rows.
//
// That split is the thing to be careful about. The two caches cover different
// day ranges — `meta_daily_spend` retains 400 days, the lead series is written
// separately — so a day present in one may be absent from the other. CPL is
// derived per bucket from whatever both actually reported, and a bucket with
// spend but no leads is left as a gap rather than plotted as zero, which would
// draw a cliff the client never had.

import { bucketSeries } from "./portfolio-series";

export { granularityForRange } from "./saleshub-series";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {object} group        a client group as /api/client-groups returns it
 * @param {string} granularity  Daily | Weekly | Monthly
 * @returns {{leads, spend, cpl, closes}} each a bucketed series
 */
export function buildClientSeries(group, granularity) {
  const leadRows = group?.gohighlevel?.daily_leads ?? [];
  const spendRows = group?.facebook?.daily_spend ?? [];

  const leads = bucketSeries(leadRows, (d) => d.date, granularity, (d) => num(d.new_leads));
  const closes = bucketSeries(leadRows, (d) => d.date, granularity, (d) => num(d.won));
  const spend = bucketSeries(spendRows, (d) => d.date, granularity, (d) => num(d.spend));

  // Cost per lead per bucket. Aligned by label rather than by index: the two
  // caches can start on different days, so position i in one is not
  // necessarily the same period as position i in the other.
  const leadsByLabel = new Map(leads.labels.map((l, i) => [l, leads.values[i]]));
  const cpl = {
    ...spend,
    values: spend.values.map((spendValue, i) => {
      const leadCount = leadsByLabel.get(spend.labels[i]);
      // No leads in the bucket means CPL is undefined, not zero — plotting
      // zero would show a spend-heavy week as free.
      if (!leadCount) return null;
      return spendValue / leadCount;
    }),
  };

  return { leads, spend, cpl, closes };
}

/** Title, subtitle and tab label per metric, in the design's order. */
export const CLIENT_CHART_METRICS = [
  { key: "leads", tab: "Leads", title: "Leads", subtitle: "Lead volume" },
  { key: "spend", tab: "Spend", title: "Ad spend", subtitle: "Meta spend" },
  { key: "cpl", tab: "CPL", title: "Cost per lead", subtitle: "Blended cost per lead" },
  { key: "closes", tab: "Closes", title: "Closes", subtitle: "Opportunities won" },
];

/** Whether a series has anything worth drawing. */
export function hasData(series) {
  return Boolean(series?.values?.some((v) => v != null && v !== 0));
}
