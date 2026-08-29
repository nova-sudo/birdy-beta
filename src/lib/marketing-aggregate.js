// Turning Marketing Hub campaign rows into what the screen renders.
//
// Everything here is derived from the campaign rows the page already builds in
// MarketingContent — the same rows the table below draws. That is deliberate:
// the KPI tiles and the table are then guaranteed to agree, and the
// client-group picker filters both at once because it filters the rows they
// share.
//
// The one thing rows cannot supply is a previous period. That comes from a
// second /api/client-groups call at the preceding preset, run back through the
// same row builder — see useMarketingHubData.

import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "./portfolio-metrics";
import { percentDelta } from "./portfolio-aggregate";

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

/**
 * A campaign is over its CPL ceiling when it costs this many times the blended
 * CPL of everything else running.
 *
 * The handoff asks for "the CPL threshold per client/campaign that decides when
 * a CPL cell turns red" and no such field exists — not in Meta's payload, not
 * on the client group. Rather than leave it uncoloured or invent a fixed pound
 * figure that would be wrong for every client at a different budget, the
 * ceiling is relative to the account's own blended CPL. A campaign paying
 * double what the rest of the account pays for the same lead is the anomaly the
 * red is there to point at.
 *
 * 2× is what the handoff's own sample data implies: blended £3.00, and the four
 * rows it draws in red start at £6.58.
 *
 * When a real per-client threshold lands, this is the only line that changes.
 */
export const CPL_CEILING_MULTIPLE = 2;

/**
 * A campaign needs at least this much spend before its CPL is worth judging.
 *
 * One lead on £8 of spend is an £8 CPL, which would light up red on a campaign
 * that has barely started. Below the floor there isn't enough evidence to call
 * anything an offender.
 */
export const CPL_JUDGEMENT_FLOOR = 20;

/**
 * Is this row's CPL over the ceiling the rest of the account sets?
 *
 * @param {object} row a campaign/adset/ad row
 * @param {number} blendedCpl the aggregate CPL these rows roll up to
 */
export function isOverCplCeiling(row, blendedCpl) {
  if (!Number.isFinite(blendedCpl) || blendedCpl <= 0) return false;
  const spend = num(row?.spend);
  const cpl = num(row?.cpl);
  if (spend < CPL_JUDGEMENT_FLOOR || cpl <= 0) return false;
  return cpl > blendedCpl * CPL_CEILING_MULTIPLE;
}

/**
 * Sum a set of campaign/adset/ad rows into the figures the KPI tiles show.
 *
 * Rates are blended — total clicks over total impressions — not the mean of
 * each row's own rate. Those differ, and the mean is the wrong one: it weights
 * a campaign that served 200 impressions the same as one that served 200,000.
 */
export function aggregateCampaignRows(rows) {
  const list = rows ?? [];

  const totals = list.reduce(
    (acc, row) => {
      acc.spend += num(row.spend);
      acc.leads += num(row.results ?? row.leads);
      acc.impressions += num(row.impressions);
      acc.clicks += num(row.clicks);
      acc.reach += num(row.reach);
      if (String(row.status).toLowerCase() === "active") acc.activeCampaigns += 1;
      return acc;
    },
    { spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0, activeCampaigns: 0 }
  );

  return {
    ...totals,
    count: list.length,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
  };
}

/**
 * The groups a Marketing Hub figure should be built from.
 *
 * Two rules, and they are the whole reason this is one function rather than a
 * filter repeated at each call site:
 *
 * 1. On "all", inactive clients are excluded — matching the Clients page,
 *    which has always filtered them. The two pages disagreeing by ~11% on
 *    every spend figure was the single most visible discrepancy between them.
 * 2. When a specific group is picked, it is shown whatever its status. Picking
 *    a client by name and getting an empty screen because it is archived would
 *    be a worse bug than the one this fixes.
 *
 * Every Marketing aggregate runs through here, so the tiles, the chart and the
 * table cannot drift apart again.
 */
export function scopeGroups(groups, groupId) {
  const list = groups ?? [];
  if (groupId && groupId !== "all") {
    return list.filter((g) => g.id === groupId);
  }
  return list.filter(
    (g) => String(g.client_status ?? "Active").trim().toLowerCase() !== "inactive"
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : String(iso ?? "");
}

/**
 * Say so when a chart's line covers less than the figure printed above it.
 *
 * The headline on each Marketing card is the period total — account-level,
 * full history. The line beneath it is drawn from the cached daily rows, which
 * can cover less: `meta_daily_spend` retains 400 days, and today has no row
 * until the first refresh after midnight. On an all-time window that gap was
 * enormous — £428,479 printed above a line summing £278,161 — and nothing on
 * screen explained it, so the card read as self-contradictory.
 *
 * Deriving the headline from the line instead would be worse: the total is the
 * accurate number and the line is the truncated one. So the total stays and
 * the gap gets stated.
 *
 * Returns null when the line does cover the total, which is the normal case.
 *
 * @param {object[]} days rows with a `date`, already filtered to the window
 * @param {number} plotted sum of the values actually drawn
 * @param {number} total the headline figure
 */
export function coverageNote(days, plotted, total) {
  const list = days ?? [];
  if (!list.length || !Number.isFinite(total) || total <= 0) return null;

  // 2% absorbs rounding and same-day restatement without hiding a real gap.
  if (Math.abs(total - plotted) / total <= 0.02) return null;

  let first = list[0].date;
  let last = list[0].date;
  for (const d of list) {
    if (d.date < first) first = d.date;
    if (d.date > last) last = d.date;
  }

  return plotted < total
    ? `chart covers ${shortDay(first)}–${shortDay(last)}; the figure above is the full period`
    : `chart covers ${shortDay(first)}–${shortDay(last)}`;
}

/**
 * Account-level totals for a set of client groups.
 *
 * The KPI tiles used to sum the campaign rows beneath them, which is not the
 * same number. `/{account}/campaigns` omits deleted and archived campaigns, so
 * spend on them is missing from the rows while the account still reports it —
 * summing the rows under-reports by however much of the account's history sits
 * on campaigns Meta no longer lists. Measured across this portfolio: campaign
 * rows totalled £4,845.99 against £4,973.19 at account level, and one client
 * returning zero campaigns showed £0 against £4,532 of real spend.
 *
 * `metrics.insights` is the account-level figure the backend caches from
 * `/{account}/insights` — the same edge the daily spend series uses, which is
 * what makes the tiles and the chart agree.
 *
 * Returns null when no group carries insights, so callers can fall back to the
 * campaign sum rather than render a zero they never measured.
 */
export function aggregateGroupInsights(groups, groupId) {
  let measured = false;

  const totals = scopeGroups(groups, groupId).reduce(
    (acc, group) => {
      const ins = group.facebook?.metrics?.insights;
      if (!ins) return acc;
      measured = true;
      acc.spend += num(ins.spend);
      acc.leads += num(ins.results ?? ins.total_leads);
      acc.impressions += num(ins.impressions);
      acc.clicks += num(ins.clicks);
      acc.reach += num(ins.reach);
      return acc;
    },
    { spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0 }
  );

  return measured ? totals : null;
}

/**
 * The campaign rows hiding inside a /api/client-groups payload.
 *
 * MarketingContent builds far richer rows than this — GHL attribution, tag
 * rollups, custom formula metrics — but none of that is needed to total a
 * period up. This is the narrow version, used for the *previous* period, where
 * the only question asked of it is "what did these figures come to?".
 *
 * Keeping it here rather than reusing the page's builder is what lets the
 * comparison run without a second round of opportunity and tag fetches.
 *
 * @param {object[]} groups client-group documents
 * @param {string} [groupId] restrict to one group, matching the page's picker
 */
export function campaignRowsFromGroups(groups, groupId) {
  const rows = [];

  for (const group of scopeGroups(groups, groupId)) {
    for (const c of group.facebook?.campaigns ?? []) {
      const spend = num(c.spend);
      const results = num(c.results);
      rows.push({
        id: c.id,
        name: c.name,
        status: String(c.status ?? "inactive").toLowerCase(),
        spend,
        results,
        leads: results,
        impressions: num(c.impressions),
        clicks: num(c.clicks),
        reach: num(c.reach),
        cpl: results > 0 ? spend / results : 0,
      });
    }
  }

  return rows;
}

/**
 * One per-day series across the selected groups, summed by date.
 *
 * Measured, not inferred: the backend asks Meta for `time_increment=1` rows and
 * caches them on the group as `daily_spend`. Days the cache has no row for are
 * absent rather than zero — a gap in the cache is not a day that cost nothing.
 *
 * Each row carries `spend` and, where Meta's daily breakdown includes it,
 * `impressions`. Impressions is tracked separately from spend rather than
 * assumed present: the field was added to these rows after spend, so a client
 * whose cache predates that still has spend-only days. `impressionDays` counts
 * how many rows actually reported the figure, which is what lets the chart tell
 * "this account served nothing" from "nothing cached it" — the difference
 * between a real zero and an absent curve.
 */
export function mergeDailyMetrics(groups, groupId) {
  const byDate = new Map();

  for (const group of scopeGroups(groups, groupId)) {
    for (const day of group.facebook?.daily_spend ?? []) {
      if (!day?.date) continue;
      const row = byDate.get(day.date) ?? { date: day.date, spend: 0, impressions: 0, impressionDays: 0 };
      row.spend += num(day.spend);
      if (day.impressions != null) {
        row.impressions += num(day.impressions);
        row.impressionDays += 1;
      }
      byDate.set(day.date, row);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Compact 1.42M / 298k for figures too long to read in a 17px tile. */
export function abbreviate(value) {
  const n = num(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return Math.round(n).toLocaleString();
}

/**
 * The six KPI tiles, with deltas wherever a previous period exists.
 *
 * CTR moves in points, not percent: a rise from 3.6% to 3.9% is "▲ 0.3pts". A
 * percentage change of a percentage reads as though the rate itself were 8%.
 */
export function buildMarketingKpis(current, previous, formatMoney) {
  const prev = previous ?? null;
  const ctrDelta =
    prev && Number.isFinite(prev.ctr) && prev.ctr > 0
      ? (() => {
          const points = current.ctr - prev.ctr;
          if (Math.abs(points) < 0.05) return null;
          return {
            direction: points > 0 ? "up" : "down",
            delta: `${Math.abs(points).toFixed(1)}pts`,
            polarity: HIGHER_IS_BETTER,
          };
        })()
      : null;

  return [
    {
      key: "activeCampaigns",
      label: "Active campaigns",
      value: Math.round(current.activeCampaigns).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.activeCampaigns, prev?.activeCampaigns) ?? {}),
    },
    {
      key: "spend",
      label: "Total ad spend",
      value: formatMoney(current.spend, 2),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.spend, prev?.spend) ?? {}),
    },
    {
      key: "leads",
      label: "Total leads",
      value: Math.round(current.leads).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.leads, prev?.leads) ?? {}),
    },
    {
      key: "cpl",
      label: "Average CPL",
      value: current.leads > 0 ? formatMoney(current.cpl, 2) : "—",
      // Cheaper leads are better, so a rise here renders red with an up arrow.
      polarity: LOWER_IS_BETTER,
      ...(percentDelta(current.cpl, prev?.cpl, LOWER_IS_BETTER) ?? {}),
    },
    {
      key: "impressions",
      label: "Impressions",
      value: abbreviate(current.impressions),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.impressions, prev?.impressions) ?? {}),
    },
    {
      key: "ctr",
      label: "Average CTR",
      value: current.impressions > 0 ? `${current.ctr.toFixed(2)}%` : "—",
      polarity: HIGHER_IS_BETTER,
      ...(ctrDelta ?? {}),
    },
  ];
}

/**
 * The Birdy Insights copy for this period.
 *
 * The handoff asks for two sentences generated from the data: the headline
 * movement, then the single most actionable anomaly with the trade it implies.
 * Both come from figures already on the screen — no extra endpoint, and nothing
 * asserted that the rows don't say.
 *
 * Returns null when there is nothing worth claiming, so the card can render a
 * plain waiting state rather than a sentence with holes in it.
 *
 * Segments are pre-split rather than a string because the figures and campaign
 * names inside the sentence are emphasised; building that from markup here
 * would mean the copy carried its own styling.
 *
 * @returns {{segments: {text: string, strong?: boolean}[]} | null}
 */
export function buildMarketingInsight(current, previous, rows, formatMoney) {
  const list = rows ?? [];
  if (!list.length || current.spend <= 0) return null;

  const segments = [];
  const say = (text) => segments.push({ text });
  const emphasise = (text) => segments.push({ text, strong: true });

  // ── Sentence one: the headline movement ────────────────────────────────
  const spendMove = percentDelta(current.spend, previous?.spend);
  const cplMove = percentDelta(current.cpl, previous?.cpl, LOWER_IS_BETTER);

  if (spendMove) {
    say("Spend is ");
    say(spendMove.direction === "up" ? "up " : "down ");
    emphasise(spendMove.delta);
    if (cplMove) {
      say(cplMove.direction === "up" ? " and CPL has climbed to " : " while CPL has fallen to ");
      emphasise(formatMoney(current.cpl, 2));
      say(". ");
    } else {
      say(" at ");
      emphasise(formatMoney(current.cpl, 2));
      say(" CPL. ");
    }
  } else {
    // No comparable previous period — state the position rather than a move.
    say("You're at ");
    emphasise(formatMoney(current.spend, 2));
    say(" spend and ");
    emphasise(formatMoney(current.cpl, 2));
    say(" blended CPL across ");
    emphasise(
      `${current.activeCampaigns} active campaign${current.activeCampaigns === 1 ? "" : "s"}`
    );
    say(". ");
  }

  // ── Sentence two: the worst offender, and what pausing it would buy ────
  const judgeable = list.filter((r) => num(r.spend) >= CPL_JUDGEMENT_FLOOR && num(r.cpl) > 0);
  const worst = [...judgeable].sort((a, b) => num(b.cpl) - num(a.cpl))[0];
  const best = [...judgeable].sort((a, b) => num(a.cpl) - num(b.cpl))[0];

  if (!worst || !isOverCplCeiling(worst, current.cpl)) {
    say(
      judgeable.length
        ? "No campaign is running above twice the blended CPL — nothing is dragging the account right now."
        : "No campaign has enough spend yet to judge its CPL."
    );
    return { segments };
  }

  emphasise(worst.name);
  say(" is the worst offender at ");
  emphasise(formatMoney(num(worst.cpl), 2));
  say(` CPL with only ${Math.round(num(worst.results ?? worst.leads))} results`);

  if (best && best.id !== worst.id) {
    say(" — pausing it would free ");
    emphasise(formatMoney(num(worst.spend), 0));
    say(" for your ");
    emphasise(formatMoney(num(best.cpl), 2));
    say(" CPL winner.");
  } else {
    say(".");
  }

  return { segments };
}
