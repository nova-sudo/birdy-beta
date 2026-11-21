import { describe, expect, it } from "vitest";
import {
  BLANK_FORM, alertMetricOptions, alertPayload, alertsTabHref, allRules, conditionLine, formFromAlert, formProblems, formSentence, groupTriggered,
  historyRows, isOn, metricName, nextStatus, progressOf, statusOf, tabFromParam, tagsFromGroups, targetsLine, toggleId, withChannel,
  withCreativeMetric, withScope,
} from "../alert-rules";

const rule = (over = {}) => ({
  id: "a1", name: "High spend", status: "active", tracking_mode: "total", scope: "clients",
  condition: { metric: "spend", operator: "gt", value: 500, period: "day" },
  target_group_ids: [], ...over,
});

describe("tabs", () => {
  it("opens the old ?tab= values and falls back to Triggered", () => {
    expect(tabFromParam("active")).toBe("active");
    expect(tabFromParam("paused")).toBe("paused");
    expect(tabFromParam("history")).toBe("history");
    expect(tabFromParam("nope")).toBe("triggered");
    expect(tabFromParam(null)).toBe("triggered");
  });

  it("writes each tab's address inside Settings", () => {
    expect(alertsTabHref("triggered")).toBe("/settings?section=alerts");
    expect(alertsTabHref("paused")).toBe("/settings?section=alerts&tab=paused");
  });
});

describe("metrics", () => {
  it("lists the fixed metrics, tags and custom formulas with catalogue categories", () => {
    const opts = alertMetricOptions({ availableTags: ["booked"], customMetrics: [{ id: "c1", name: "CPA" }] });
    expect(opts.find((o) => o.id === "spend")).toEqual({ id: "spend", label: "Total Spend", category: "Meta Ads" });
    expect(opts.find((o) => o.id === "tag:booked")).toEqual({ id: "tag:booked", label: "booked", category: "Tags" });
    expect(opts.find((o) => o.id === "custom:c1")).toEqual({ id: "custom:c1", label: "CPA", category: "Custom Formula" });
  });

  it("names any metric id", () => {
    expect(metricName("cpl")).toBe("Cost Per Lead ($)");
    expect(metricName("creative_verdict")).toBe("Creative verdict");
    expect(metricName("tag:hot")).toBe("hot");
    expect(metricName("mystery")).toBe("mystery");
  });

  it("collects every tag the clients have seen, sorted", () => {
    expect(tagsFromGroups([
      { gohighlevel: { metrics: { tag_breakdown: { b: 1, a: 2 } } } },
      { gohighlevel_cache: { metrics: { tag_breakdown: { c: 1 } } } },
      {},
    ])).toEqual(["a", "b", "c"]);
  });
});

describe("the editor's form", () => {
  it("round-trips an existing rule into the payload the API takes", () => {
    const form = formFromAlert(rule({ description: "d", target_group_ids: ["g1"], notification_channels: ["in_app", "email"], frequency: "hourly", type: "win" }));
    expect(alertPayload(form)).toEqual({
      name: "High spend", description: "d", type: "win",
      condition: { metric: "spend", operator: "gt", value: 500, period: "day" },
      scope: "clients", creative_test_ids: [], target_group_ids: ["g1"],
      notification_channels: ["in_app", "email"], frequency: "hourly", tracking_mode: "total",
    });
  });

  it("sends a creative rule's fixed condition and no client ids", () => {
    const form = { ...withScope({ ...BLANK_FORM, name: "Verdicts", target_group_ids: ["g1"] }, "creative_tests"), creative_test_ids: ["t1"] };
    const p = alertPayload(form);
    expect(p.condition).toMatchObject({ metric: "creative_verdict", operator: "eq", value: 1 });
    expect(p.target_group_ids).toEqual([]);
    expect(p.creative_test_ids).toEqual(["t1"]);
    expect(alertPayload(withCreativeMetric(form, "creative_post_failed")).condition).toMatchObject({ operator: "gt", value: 0 });
  });

  it("clears the value when leaving a fixed creative metric, and keeps a valid operator", () => {
    const fixed = withScope(BLANK_FORM, "creative_tests");
    const cpl = withCreativeMetric(fixed, "creative_cpl");
    expect(cpl.value).toBe("");
    expect(cpl.operator).toBe("eq");
    expect(withCreativeMetric({ ...cpl, operator: "pct_rise" }, "creative_ctr").operator).toBe("gt");
  });

  it("switching back to clients starts on spend", () => {
    expect(withScope(withScope(BLANK_FORM, "creative_tests"), "clients")).toMatchObject({ scope: "clients", metric: "spend", operator: "gt", value: "0" });
  });

  it("asks for a name and a number, but no number for a fixed creative metric", () => {
    expect(formProblems({ ...BLANK_FORM, value: "x" })).toEqual({ name: "Give this alert a name.", value: "Enter a number." });
    expect(formProblems({ ...withScope(BLANK_FORM, "creative_tests"), name: "V", value: "" })).toEqual({});
    expect(formProblems({ ...BLANK_FORM, name: "Ok", value: "12.5" })).toEqual({});
  });

  it("adds and drops ids and channels", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
    expect(withChannel(["in_app", "email"], "in_app", false)).toEqual(["email"]);
    expect(withChannel(["email"], "in_app", true)).toEqual(["email", "in_app"]);
  });

  it("reads the form back as a sentence", () => {
    const s = formSentence({ ...BLANK_FORM, name: "CPL watch", metric: "cpl", operator: "gt", value: "40", period: "week", target_group_ids: ["g1", "g2"], tracking_mode: "per_client" }, alertMetricOptions());
    expect(s).toBe("CPL watch fires when Cost Per Lead ($) > 40, last 7 days, across 2 clients (each client on its own).");
    expect(formSentence(withScope({ ...BLANK_FORM, name: "V" }, "creative_tests"), [])).toBe("V fires when a test gets a winner or loser verdict, across every live test (combined).");
  });
});

describe("how a rule reads", () => {
  it("says the condition and window", () => {
    expect(conditionLine(rule(), alertMetricOptions())).toBe("Total Spend > 500 · Yesterday");
    expect(conditionLine(rule({ condition: { metric: "cpl", operator: "pct_rise", value: 20, period: "week" } }), [])).toBe("Cost Per Lead ($) ↑ 20% · vs last 7 days");
    expect(conditionLine(rule({ scope: "creative_tests", condition: { metric: "creative_verdict", operator: "eq", value: 1, period: "day" } }), [])).toBe("Creative verdict · Winner or loser · Yesterday");
  });

  it("names the status, and the switch flips between paused and active", () => {
    expect(statusOf(rule({ status: "triggered" }))).toEqual({ tone: "danger", label: "Triggered" });
    expect(statusOf(rule({ status: "paused", snoozed_until: "2026-12-01" })).label).toBe("Snoozed");
    expect(statusOf(rule({ status: "paused" })).label).toBe("Paused");
    expect(statusOf(rule()).label).toBe("Watching");
    expect(isOn(rule({ status: "triggered" }))).toBe(true);
    expect(nextStatus(rule())).toBe("paused");
    expect(nextStatus(rule({ status: "triggered" }))).toBe("paused");
    expect(nextStatus(rule({ status: "paused" }))).toBe("active");
  });

  it("shows progress only once a rule has been checked", () => {
    expect(progressOf(rule())).toBeNull();
    expect(progressOf(rule({ current_value: 420, progress_pct: 84 }))).toEqual({ pct: 84, current: "$420.00", threshold: "> $500.00", line: "84% to firing", tone: "warning" });
    expect(progressOf(rule({ status: "triggered", current_value: 600, progress_pct: 120 })).tone).toBe("danger");
  });

  it("says who a rule watches", () => {
    expect(targetsLine(rule())).toBe("All clients · Total");
    expect(targetsLine(rule({ target_group_ids: ["1", "2", "3"], target_group_names: ["A", "B", "C"], tracking_mode: "per_client" }))).toBe("A, B +1 · Per client");
    expect(targetsLine(rule({ scope: "creative_tests", creative_test_ids: ["t1"], tracking_mode: "per_client" }), { t1: "CT-0001" })).toBe("CT-0001 · Per account");
    expect(targetsLine(rule({ scope: "creative_tests", creative_test_ids: [] }))).toBe("All live tests · Total");
  });
});

describe("triggered rows", () => {
  it("folds a per-client rule's fanned-out rows under one entry", () => {
    const rows = [
      rule({ id: "a1", status: "triggered" }),
      { ...rule({ id: "a2", name: "CPL", status: "triggered", tracking_mode: "per_client" }), _virtual: true, _virtual_id: "a2::g1", _client_id: "g1", _client_name: "One" },
      { ...rule({ id: "a2", name: "CPL", status: "triggered", tracking_mode: "per_client" }), _virtual: true, _virtual_id: "a2::g2", _client_id: "g2", _client_name: "Two" },
    ];
    const groups = groupTriggered(rows);
    expect(groups.map((g) => [g.key, g.clients.length])).toEqual([["real_a1", 0], ["group_a2", 2]]);
    expect(groups[1].alert._virtual).toBeUndefined();
    expect(groups[1].alert.name).toBe("CPL");
  });

  it("lists each rule once", () => {
    expect(allRules({ alerts: [rule()] })).toHaveLength(1);
    expect(allRules({ active: [rule()], triggered: [{ ...rule({ id: "a2" }), _virtual: true }, { ...rule({ id: "a2" }), _virtual: true }] }).map((r) => r.id)).toEqual(["a1", "a2"]);
  });
});

describe("history", () => {
  it("joins each fire to its rule, newest first", () => {
    const rows = historyRows([
      { id: "n1", alert_id: "a1", message: "old", triggered_at: "2026-11-01T10:00:00", read: true },
      { id: "n2", alert_id: "gone", message: "[Acme] new", triggered_at: "2026-11-02T10:00:00", read: false, group_name: "Acme" },
    ], [rule()]);
    expect(rows.map((r) => [r.key, r.rule, r.client, r.message, r.unread])).toEqual([["n2", null, "Acme", "new", true], ["n1", "High spend", null, "old", false]]);
  });
});
