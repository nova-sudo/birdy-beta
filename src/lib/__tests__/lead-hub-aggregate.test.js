import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { differenceInCalendarDays } from "date-fns";
import {
  buildLeadInsight,
  buildLeadKpis,
  buildPipelineTabs,
  granularityFor,
  isLeadRow,
  largestUnreachablePool,
  normaliseLeadStats,
  pointsDelta,
  previousWindow,
  rowStatus,
} from "@/lib/lead-hub-aggregate";
import { presetToDateRange } from "@/lib/date-utils";

// Every window is relative to "now", so the clock is pinned. 20 Aug 2026 is a
// Thursday, which keeps the week-to-date case a partial week rather than a
// whole one.
const TODAY = new Date(2026, 7, 20, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Inclusive length of a window, in days. */
const span = ({ start_date, end_date }) =>
  differenceInCalendarDays(new Date(end_date), new Date(start_date));

const stats = (over = {}) =>
  normaliseLeadStats({
    lead_count: 1525,
    contact_count: 448,
    total_opportunities: 1528,
    open: 1425,
    lost: 63,
    conversion_rate: 2.6,
    ...over,
  });

describe("previousWindow", () => {
  it("puts a rolling window against the equal-length one immediately before", () => {
    // last_7d is 13–20 Aug, so its predecessor ends on the 12th and is the
    // same length — not the same dates a month earlier.
    expect(previousWindow("last_7d")).toEqual({
      start_date: "2026-08-05",
      end_date: "2026-08-12",
    });
  });

  it("gives a single-day window the single day before it", () => {
    expect(previousWindow("today")).toEqual({
      start_date: "2026-08-19",
      end_date: "2026-08-19",
    });
  });

  it("puts a part-finished month against the same opening stretch of the last one", () => {
    // The 1st–20th of August compares against the 1st–20th of July. The tail
    // of July would put a quiet start of month beside a busy end of one and
    // read the difference as a change in performance.
    expect(previousWindow("this_month")).toEqual({
      start_date: "2026-07-01",
      end_date: "2026-07-20",
    });
  });

  it("puts a whole calendar unit against the whole one before it", () => {
    expect(previousWindow("last_month")).toEqual({
      start_date: "2026-06-01",
      end_date: "2026-06-30",
    });
  });

  it("keeps the comparison the same length as the window for a part-finished year", () => {
    const current = presetToDateRange("this_year");
    const before = previousWindow("this_year");

    expect(before.start_date).toBe("2025-01-01");
    expect(span(before)).toBe(span(current));
  });

  it("gives an all-time window no predecessor at all", () => {
    // Nothing precedes everything, and an invented comparison would be worse
    // than no pill.
    expect(previousWindow("maximum")).toBeNull();
  });
});

describe("normaliseLeadStats", () => {
  it("returns null for a missing payload rather than a row of zeroes", () => {
    // "No data" and "a period that produced nothing" are different claims and
    // only one of them should draw a delta pill.
    expect(normaliseLeadStats(null)).toBeNull();
    expect(normaliseLeadStats(undefined)).toBeNull();
  });

  it("reads won and abandoned as nullable, and the rest as counts", () => {
    const absent = stats();
    expect(absent.won).toBeNull();
    expect(absent.abandoned).toBeNull();
    expect(absent.leads).toBe(1525);
    expect(absent.conversionRate).toBe(2.6);

    const present = stats({ won: 40, abandoned: 0 });
    expect(present.won).toBe(40);
    // A zero that was actually reported is a count, not an absence.
    expect(present.abandoned).toBe(0);
  });
});

describe("pointsDelta", () => {
  it("moves a rate in points rather than percent", () => {
    // 3.0% to 2.6% is a fall of 0.4 points. Reporting -13.3% is true of the
    // ratio and reads as though the rate itself were 13%.
    expect(pointsDelta(2.6, 3.0)).toMatchObject({ direction: "down", delta: "0.4pts" });
  });

  it("accepts a previous of zero, unlike a percentage change", () => {
    expect(pointsDelta(2.6, 0)).toMatchObject({ direction: "up", delta: "2.6pts" });
  });

  it("says nothing about a movement that rounds to flat", () => {
    expect(pointsDelta(2.6, 2.61)).toBeNull();
  });
});

describe("buildLeadKpis", () => {
  it("builds the handoff's six tiles in order", () => {
    expect(buildLeadKpis(stats(), null).map((k) => k.key)).toEqual([
      "leads",
      "contacts",
      "opportunities",
      "open",
      "lost",
      "conversionRate",
    ]);
  });

  it("colours the inverted metrics by meaning, not by arrow direction", () => {
    const kpis = buildLeadKpis(stats(), stats({ lost: 57, conversion_rate: 3.0 }));
    const lost = kpis.find((k) => k.key === "lost");
    const rate = kpis.find((k) => k.key === "conversionRate");

    // Lost leads rose. That is bad news, so the polarity has to say a fall
    // would have been the improvement.
    expect(lost).toMatchObject({ direction: "up", polarity: "lower-is-better" });
    // The conversion rate fell. That is bad news with a *down* arrow, which is
    // only red if the polarity says higher is better.
    expect(rate).toMatchObject({ direction: "down", delta: "0.4pts", polarity: "higher-is-better" });
  });

  it("renders no pill at all where there is no comparable period", () => {
    // An unknown delta is not a flat one.
    for (const kpi of buildLeadKpis(stats(), null)) {
      expect(kpi.direction).toBeUndefined();
      expect(kpi.delta).toBeUndefined();
    }
  });

  it("survives a window with no figures at all", () => {
    const kpis = buildLeadKpis(null, null);
    expect(kpis).toHaveLength(6);
    expect(kpis[0].value).toBe("0");
    expect(kpis[5].value).toBe("0.0%");
  });
});

describe("buildPipelineTabs", () => {
  it("counts every record in the window behind All Leads", () => {
    // The tab lists leads and contacts alike, and a contact has no stage to
    // fall under, so the badge is both counts together.
    const [all] = buildPipelineTabs(stats());
    expect(all).toMatchObject({ key: "all", badge: "1,973" });
  });

  it("leaves a stage the payload does not carry with no badge", () => {
    // A zero would state "nothing in this stage" while meaning "this stage
    // wasn't counted".
    const tabs = buildPipelineTabs(stats());
    expect(tabs.find((t) => t.key === "won").badge).toBeNull();
    expect(tabs.find((t) => t.key === "abandoned").badge).toBeNull();
    expect(tabs.find((t) => t.key === "lost").badge).toBe("63");
  });

  it("badges a stage the payload reports as empty", () => {
    const tabs = buildPipelineTabs(stats({ won: 40, abandoned: 0 }));
    expect(tabs.find((t) => t.key === "won").badge).toBe("40");
    expect(tabs.find((t) => t.key === "abandoned").badge).toBe("0");
  });

  it("renders all five tabs unbadged before any figures arrive", () => {
    const tabs = buildPipelineTabs(null);
    expect(tabs).toHaveLength(5);
    expect(tabs.every((t) => t.badge === null)).toBe(true);
  });
});

describe("row classification", () => {
  it("reads the lead flag off either field name", () => {
    expect(isLeadRow({ contactType: "Lead" })).toBe(true);
    expect(isLeadRow({ type: "lead" })).toBe(true);
    expect(isLeadRow({ type: "contact" })).toBe(false);
    expect(isLeadRow({})).toBe(false);
  });

  it("gives a record with no opportunity no stage", () => {
    expect(rowStatus({ opportunities: [{ status: "Won" }] })).toBe("won");
    expect(rowStatus({ opportunityStatus: "OPEN" })).toBe("open");
    expect(rowStatus({ opportunities: [] })).toBeNull();
  });
});

describe("granularityFor", () => {
  it("slices a window finely enough to read and coarsely enough to see", () => {
    expect(granularityFor("last_7d")).toBe("Daily");
    expect(granularityFor("this_month")).toBe("Daily");
    expect(granularityFor("this_quarter")).toBe("Weekly");
    expect(granularityFor("this_year")).toBe("Monthly");
    expect(granularityFor("maximum")).toBe("Monthly");
  });
});

describe("largestUnreachablePool", () => {
  const row = (groupName, email) => ({ groupName, email });

  it("names the group leaking the most records nobody can email", () => {
    const pool = largestUnreachablePool([
      ...Array.from({ length: 12 }, () => row("Fallon Physique", null)),
      ...Array.from({ length: 3 }, () => row("Aura", null)),
      row("Fallon Physique", "someone@example.com"),
    ]);

    expect(pool).toEqual({ group: "Fallon Physique", count: 12 });
  });

  it("counts GHL's synthetic address as no address", () => {
    // no_email_… is what GHL writes where none was captured, so it is a record
    // nobody can reach rather than one with an address.
    const pool = largestUnreachablePool(
      Array.from({ length: 11 }, (_, i) => row("LA Body", `no_email_${i}@x.com`))
    );

    expect(pool).toEqual({ group: "LA Body", count: 11 });
  });

  it("names nothing when no group is above the floor", () => {
    // An insight that cries wolf on a healthy account stops being read.
    expect(largestUnreachablePool([row("Aura", null), row("Aura", null)])).toBeNull();
    expect(largestUnreachablePool([])).toBeNull();
  });
});

describe("buildLeadInsight", () => {
  const text = (insight) => insight.segments.map((s) => s.text).join("");
  const unreachable = Array.from({ length: 14 }, () => ({
    groupName: "Fallon Physique",
    email: null,
  }));

  it("contrasts the two figures when volume and conversion disagree", () => {
    // Volume up while the rate falls is the period worth reading, and the
    // whole reason both figures are on the card.
    const insight = buildLeadInsight(
      stats(),
      stats({ lead_count: 1422, conversion_rate: 3.0 }),
      unreachable
    );

    expect(text(insight)).toContain("Lead volume is up");
    expect(text(insight)).toContain("but conversion has fallen to 2.6%");
  });

  it("joins them plainly when they move the same way", () => {
    const insight = buildLeadInsight(
      stats({ conversion_rate: 3.4 }),
      stats({ lead_count: 1422, conversion_rate: 3.0 }),
      unreachable
    );

    expect(text(insight)).toContain("and conversion has risen to 3.4%");
  });

  it("states the position rather than a move with no period to compare", () => {
    const insight = buildLeadInsight(stats(), null, unreachable);
    expect(text(insight)).toContain("You're at 1,525 leads and 448 contacts");
  });

  it("says 'at least' where the count came from a sample", () => {
    // Quoting a sample as though it were the whole window would understate the
    // pool and overstate what was measured.
    expect(text(buildLeadInsight(stats(), null, unreachable, true))).toContain(
      "has at least 14 records with no email"
    );
    expect(text(buildLeadInsight(stats(), null, unreachable, false))).toContain(
      "has 14 records with no email"
    );
  });

  it("says so when nothing is going unreachable", () => {
    const insight = buildLeadInsight(stats(), null, [
      { groupName: "Aura", email: "a@example.com" },
    ]);
    expect(text(insight)).toContain("nothing is going unreachable");
  });

  it("returns nothing to say for a window with no records in it", () => {
    // The card renders a waiting state rather than a sentence with holes.
    expect(buildLeadInsight(stats({ lead_count: 0, contact_count: 0 }), null, [])).toBeNull();
    expect(buildLeadInsight(null, null, [])).toBeNull();
  });
});
