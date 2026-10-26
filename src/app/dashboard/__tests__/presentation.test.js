import { describe, it, expect, vi } from "vitest";
import {
  briefingFromDiagnosis,
  callInsightItems,
  callsTabValue,
  clientBreakdown,
  comparableFunnel,
  costPerLeadSeries,
  FUNNEL_PRESENTATION,
  funnelNotice,
  funnelStageItems,
  greeting,
  portfolioSummary,
  toFindings,
} from "../presentation";

const suggestion = (over = {}) => ({
  id: "s1",
  severity: "HIGH",
  client: "Palm Peach",
  title: "Pause 2 underperforming ads",
  why: "£48 CPL vs £22 target.",
  ...over,
});

describe("toFindings", () => {
  it("maps suggestion severity to a status tone", () => {
    const rows = toFindings({}, [
      suggestion({ id: "a", severity: "HIGH" }),
      suggestion({ id: "b", severity: "MEDIUM" }),
      suggestion({ id: "c", severity: "OPPORTUNITY" }),
      suggestion({ id: "d", severity: undefined }),
    ]);
    const tone = (id) => rows.find((r) => r.id === `suggestion-${id}`).tone;
    expect(tone("a")).toBe("danger");
    expect(tone("b")).toBe("warning");
    expect(tone("c")).toBe("success");
    expect(tone("d")).toBe("warning");
  });

  it("passes briefing tones through, falling back to neutral", () => {
    const rows = toFindings(
      {
        findings: [
          { tone: "info", parts: [{ text: "A", strong: true }] },
          { tone: "nonsense", parts: [{ text: "B", strong: true }] },
          { parts: [{ text: "C", strong: true }] },
        ],
      },
      []
    );
    expect(rows.map((r) => r.tone)).toEqual(["info", "neutral", "neutral"]);
  });

  it("splits a briefing finding into a bold title and a plain detail", () => {
    const [row] = toFindings(
      {
        findings: [
          {
            tone: "warning",
            parts: [{ text: "Problem found: close rate", strong: true }, { text: " Closes are down 8%." }],
          },
        ],
      },
      []
    );
    expect(row.title).toBe("Problem found: close rate");
    expect(row.detail).toBe("Closes are down 8%.");
    expect(row.action).toBeUndefined();
  });

  it("tags a suggestion from the Media Buying Agent", () => {
    const rows = toFindings({}, [suggestion({ id: "a", agent_id: "ag1" }), suggestion({ id: "b" })]);
    expect(rows.find((r) => r.id === "suggestion-a").tag).toBe("Media Buying Agent");
    expect(rows.find((r) => r.id === "suggestion-b").tag).toBeUndefined();
  });

  it("gives a suggestion a Do it action that applies that suggestion", () => {
    const onApply = vi.fn();
    const s = suggestion();
    const [row] = toFindings({}, [s], { onApply });
    expect(row.title).toBe("Pause 2 underperforming ads");
    expect(row.detail).toBe("Palm Peach · £48 CPL vs £22 target.");
    expect(row.action.label).toBe("Do it");
    row.action.onClick();
    expect(onApply).toHaveBeenCalledWith(s);
  });

  it("wires onDismiss to suggestions only", () => {
    const onDismiss = vi.fn();
    const s = suggestion();
    const rows = toFindings(
      { findings: [{ tone: "info", parts: [{ text: "Note", strong: true }] }] },
      [s],
      { onDismiss }
    );
    const sug = rows.find((r) => r.id === "suggestion-s1");
    sug.onDismiss();
    expect(onDismiss).toHaveBeenCalledWith(s);
    expect(rows.find((r) => r.id === "briefing-0").onDismiss).toBeUndefined();
  });

  it("offers no action without an onApply handler", () => {
    expect(toFindings({}, [suggestion()])[0].action).toBeUndefined();
  });

  it("caps at five, dropping the best news first", () => {
    const rows = toFindings(
      { findings: [{ tone: "success", parts: [{ text: "Win", strong: true }] }] },
      [
        suggestion({ id: "1", severity: "OPPORTUNITY" }),
        suggestion({ id: "2", severity: "HIGH" }),
        suggestion({ id: "3", severity: "HIGH" }),
        suggestion({ id: "4", severity: "MEDIUM" }),
        suggestion({ id: "5", severity: "MEDIUM" }),
        suggestion({ id: "6", severity: "MEDIUM" }),
      ]
    );
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.tone)).toEqual(["danger", "danger", "warning", "warning", "warning"]);
  });

  it("copes with nothing at all", () => {
    expect(toFindings(undefined, undefined)).toEqual([]);
  });
});

describe("briefingFromDiagnosis", () => {
  const problem = { state: "problem", title: "Problem found: close rate", body: "Closes are down 8%." };

  it("turns a problem into a warning finding", () => {
    const { findings } = briefingFromDiagnosis(problem, { hasComparison: true });
    expect(findings[0].tone).toBe("warning");
    expect(findings[0].parts[0]).toEqual({ text: problem.title, strong: true });
  });

  it("turns a healthy verdict into a success finding", () => {
    const { findings } = briefingFromDiagnosis(
      { state: "healthy", title: "All looking good", body: "Leads are up 4%." },
      { hasComparison: true }
    );
    expect(findings[0].tone).toBe("success");
  });

  it("says nothing without a comparison or a body", () => {
    expect(briefingFromDiagnosis(problem, { hasComparison: false }).findings).toEqual([]);
    expect(
      briefingFromDiagnosis({ state: "healthy", title: "All looking good", body: "" }, { hasComparison: true })
        .findings
    ).toEqual([]);
  });
});

describe("comparableFunnel", () => {
  const funnel = [
    { key: "leads", direction: "up", delta: 5 },
    { key: "called", direction: "down", delta: 30 },
  ];
  it("strips the movement from Called when nobody dials", () => {
    const out = comparableFunnel(funnel, false);
    expect(out[0]).toEqual(funnel[0]);
    expect(out[1]).toEqual({ key: "called" });
  });
  it("leaves everything alone when someone does", () => {
    expect(comparableFunnel(funnel, true)).toEqual(funnel);
  });
});

describe("clientBreakdown", () => {
  const opts = { colors: ["c1", "c2"], otherColor: "grey" };
  const clients = [
    { id: "a", name: "A", leads: 50 },
    { id: "b", name: "B", leads: 30 },
    { id: "c", name: "C", leads: 15 },
    { id: "d", name: "D", leads: 5 },
    { id: "z", name: "Z", leads: 0 },
  ];

  it("ranks by leads and shares the total", () => {
    const { total, rows } = clientBreakdown(clients, opts);
    expect(total).toBe(100);
    expect(rows.map((r) => [r.label, r.share, r.value])).toEqual([
      ["A", 50, "50"],
      ["B", 30, "30"],
      ["C", 15, "15"],
      ["D", 5, "5"],
    ]);
    expect(rows[2].color).toBe("c1");
  });

  it("folds the tail into one row", () => {
    const { rows } = clientBreakdown(clients, { ...opts, limit: 2 });
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ label: "2 others", value: "20", share: 20, color: "grey" });
  });

  it("is empty when nobody has leads", () => {
    expect(clientBreakdown([{ id: "a", name: "A", leads: 0 }], opts)).toEqual({ total: 0, rows: [] });
  });
});

describe("costPerLeadSeries", () => {
  it("divides matching buckets and skips ones missing either side", () => {
    const leads = { values: [10, 0, 5, 4], labels: ["1", "2", "3", "4"], tooltipLabels: ["d1", "d2", "d3", "d4"] };
    const spend = { values: [100, 50, 20], tooltipLabels: ["d1", "d2", "d3"] };
    expect(costPerLeadSeries(leads, spend)).toEqual([
      { x: "1", current: 10, tooltipLabel: "d1" },
      { x: "3", current: 4, tooltipLabel: "d3" },
    ]);
  });
});

describe("portfolioSummary and greeting", () => {
  const kpis = [
    { key: "spend", value: "£400" },
    { key: "leads", value: "200", direction: "up", delta: "12.4%" },
  ];
  it("states clients, leads, spend and the movement", () => {
    expect(portfolioSummary({ clientCount: 2, kpis })).toBe(
      "2 clients brought in 200 leads on £400 of ad spend, up 12.4% on the previous period."
    );
  });
  it("drops the movement without a comparison", () => {
    expect(portfolioSummary({ clientCount: 1, kpis: [kpis[0], { key: "leads", value: "9" }] })).toBe(
      "1 client brought in 9 leads on £400 of ad spend."
    );
  });
  it("is null with no clients", () => {
    expect(portfolioSummary({ clientCount: 0, kpis })).toBeNull();
  });
  it("greets by the time of day", () => {
    expect(greeting(8, "Sam")).toBe("Good morning, Sam");
    expect(greeting(13)).toBe("Good afternoon");
    expect(greeting(21, "Sam")).toBe("Good evening, Sam");
  });
  it("is a neutral hello until the hour is known, so server and first client render agree", () => {
    expect(greeting(null, "Sam")).toBe("Hello, Sam");
    expect(greeting(undefined)).toBe("Hello");
  });
});

describe("callInsightItems / callsTabValue", () => {
  const insights = [
    { key: "total", label: "Total calls", value: "200" },
    { key: "perClose", label: "Calls per close", value: "4.0" },
    { key: "conversion", label: "Conversion rate", value: "8.0%" },
  ];

  it("passes every figure through when somebody dials", () => {
    expect(callInsightItems(insights, true).some((i) => i.unavailable)).toBe(false);
    expect(callsTabValue(insights, true)).toBe("200");
  });

  it("flags the call-centre figures, not conversion, when nobody dials", () => {
    const items = callInsightItems(insights, false);
    expect(items.map((i) => Boolean(i.unavailable))).toEqual([true, true, false]);
    expect(callsTabValue(insights, false)).toBe("—");
  });
});

describe("funnelStageItems", () => {
  // buildFunnel's shape: a raw value, the formatted count, a share string and a
  // numeric delta with its direction.
  const funnel = [
    { key: "leads", stage: "Leads", value: 4726, count: "4,726", share: null, direction: "up", delta: 8 },
    { key: "engaged", stage: "In CRM", value: 2930, count: "2,930", share: "62.0%", direction: "up", delta: 4 },
    { key: "called", stage: "Called", value: 1204, count: "1,204", share: "25.5%", direction: "down", delta: 6 },
    { key: "closes", stage: "Closes", value: 240, count: "240", share: "5.1%", direction: "down", delta: 12 },
  ];

  it("labels the four stages and gives each its icon and tone", () => {
    const items = funnelStageItems(funnel, true);
    expect(items.map((i) => i.label)).toEqual(["Leads", "Engaged", "Called", "Closes"]);
    expect(items.map((i) => i.tone)).toEqual(["primary", "info", "warning", "success"]);
    for (const item of items) expect(item.icon).toBe(FUNNEL_PRESENTATION[item.key].icon);
  });

  it("passes the raw value and a signed delta against the previous period", () => {
    const items = funnelStageItems(funnel, true);
    expect(items.map((i) => i.value)).toEqual([4726, 2930, 1204, 240]);
    expect(items.map((i) => i.delta?.change)).toEqual([8, 4, -6, -12]);
    expect(items[0].delta.comparison).toBe("vs previous period");
  });

  it("captions only the last stage, with its share of leads", () => {
    const items = funnelStageItems(funnel, true);
    expect(items.map((i) => i.caption)).toEqual([undefined, undefined, undefined, "5.1% of leads"]);
  });

  it("leaves a stage with no movement without a delta", () => {
    const flat = funnel.map(({ direction, delta, ...rest }) => rest);
    expect(funnelStageItems(flat, true).every((i) => i.delta === undefined)).toBe(true);
  });

  it("gives a stage that held level a zero change, so it reads as no change", () => {
    const [leads, ...rest] = funnel;
    const { direction, delta, ...held } = leads;
    const items = funnelStageItems([{ ...held, flat: true }, ...rest], true);
    expect(items[0].delta).toEqual({ change: 0, comparison: "vs previous period" });
  });

  it("makes Called unavailable when no client dials: no value, delta or tone", () => {
    const called = funnelStageItems(funnel, false).find((i) => i.key === "called");
    expect(called).toMatchObject({ unavailable: true, tone: "neutral", value: null });
    expect(called.delta).toBeUndefined();
    // The other three stages are unaffected.
    expect(funnelStageItems(funnel, false).filter((i) => i.unavailable)).toHaveLength(1);
  });
});

describe("funnelNotice", () => {
  it("is a warning naming the problem", () => {
    const notice = funnelNotice(
      { state: "problem", title: "Problem found: close rate", body: "Closes are down 12%." },
      { hasComparison: true }
    );
    expect(notice).toEqual({ tone: "warning", title: "Problem found: close rate", body: "Closes are down 12%." });
  });

  it("is a success when the funnel is healthy", () => {
    const notice = funnelNotice(
      { state: "healthy", title: "All looking good", body: "Leads are up 8%." },
      { hasComparison: true }
    );
    expect(notice).toEqual({ tone: "success", title: "All looking good", body: "Leads are up 8%." });
  });

  it("asks for a comparable period when there is none", () => {
    const notice = funnelNotice({ state: "healthy", title: "All looking good", body: "" }, { hasComparison: false });
    expect(notice).toEqual({
      tone: "info",
      body: "Pick Today, Last 7 Days, This Month, This Quarter or This Year to compare against the period before it.",
    });
  });
});
