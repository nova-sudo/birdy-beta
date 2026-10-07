// The bullets under Birdy's headline on the Marketing Hub, and the question
// the card's footer link hands to the assistant.
//
// The sentence names the worst offender; the bullets must say only what the
// rows support beyond that, and never repeat the campaign the sentence named.

import { describe, expect, it } from "vitest";
import {
  buildMarketingFindings,
  buildMarketingInsight,
  marketingInsightPrompt,
} from "@/lib/marketing-aggregate";

const money = (v, d = 2) => `£${Number(v).toFixed(d)}`;

const row = (id, { spend, results, status = "active", name = id }) => ({
  id,
  name,
  status,
  spend,
  results,
  leads: results,
  cpl: results > 0 ? spend / results : 0,
});

const text = (finding) => finding.parts.map((p) => p.text).join("");
const strong = (finding) => finding.parts.filter((p) => p.strong).map((p) => p.text);

// Account-level blended CPL £4, so the ceiling is £8. Three campaigns sit over
// it; "Worst" is the one the sentence names, so only the other two should be
// counted. The account's 130 leads exceed the rows' 82 — Meta bills campaigns
// it no longer lists — which is the gap the share has to be honest about.
const ROWS = [
  row("worst", { spend: 100, results: 2, name: "Worst" }), // £50
  row("over-a", { spend: 90, results: 10, name: "Over A" }), // £9
  row("over-b", { spend: 85, results: 10, name: "Over B" }), // £8.50
  row("barren", { spend: 40, results: 0, name: "Barren" }),
  row("fine", { spend: 200, results: 60, name: "Soup - Body Sculpting 09" }), // £3.33
  row("tiny", { spend: 5, results: 0, name: "Tiny" }), // under the judgement floor
];
const CURRENT = { spend: 520, leads: 130, cpl: 4, activeCampaigns: 6, impressions: 0, ctr: 0 };

describe("buildMarketingFindings", () => {
  const findings = buildMarketingFindings(CURRENT, ROWS, money);

  it("counts the offenders the sentence did not name, and what they spent", () => {
    const warning = findings.find((f) => f.tone === "warning");
    expect(text(warning)).toBe("2 more campaigns run above twice the blended CPL, £175 between them.");
    expect(strong(warning)).toEqual(["2 more campaigns", "£175"]);
    // The worst offender is the sentence's, not the bullet's.
    expect(text(warning)).not.toContain("Worst");
  });

  it("names spend with no results, but only once it clears the judgement floor", () => {
    const danger = findings.find((f) => f.tone === "danger");
    expect(text(danger)).toBe("1 campaign spent £40 with no results.");
    expect(text(danger)).not.toContain("Tiny");
  });

  it("credits the campaign carrying the account, with its share and CPL", () => {
    const success = findings.find((f) => f.tone === "success");
    // 60 of the headline 130 — the account total, not the rows' 82.
    expect(text(success)).toBe(
      "Soup - Body Sculpting 09 delivered 60 results, 46% of the total, at £3.33 CPL."
    );
    expect(strong(success)).toEqual(["Soup - Body Sculpting 09", "60 results", "£3.33"]);
  });

  it("never returns more than three, in warning / danger / success order", () => {
    expect(findings.map((f) => f.tone)).toEqual(["warning", "danger", "success"]);
  });

  it("agrees with the sentence about who the worst offender is", () => {
    const { segments } = buildMarketingInsight(CURRENT, null, ROWS, money);
    const sentence = segments.map((s) => s.text).join("");
    expect(sentence).toContain("Worst is the worst offender");
    for (const f of findings) expect(text(f)).not.toContain("Worst");
  });

  it("skips a bullet the rows do not support rather than printing a zero", () => {
    const rows = [
      row("a", { spend: 100, results: 30 }),
      row("b", { spend: 80, results: 20 }),
    ];
    const current = { spend: 180, leads: 50, cpl: 3.6 };
    const out = buildMarketingFindings(current, rows, money);
    expect(out.map((f) => f.tone)).toEqual(["success"]);
    expect(text(out[0])).toBe("a delivered 30 results, 60% of the total, at £3.33 CPL.");
  });

  it("uses the singular when one campaign is in the bullet", () => {
    const rows = [
      row("worst", { spend: 100, results: 1 }), // £100
      row("over", { spend: 50, results: 2 }), // £25
      row("fine", { spend: 100, results: 50 }), // £2
    ];
    const current = { spend: 250, leads: 53, cpl: 250 / 53 };
    const warning = buildMarketingFindings(current, rows, money).find((f) => f.tone === "warning");
    expect(text(warning)).toBe("1 more campaign runs above twice the blended CPL, £50 on it.");
  });

  it("shares against the rows' own total when it is the larger", () => {
    // A stale headline must not push the top campaign's share over 100%.
    const rows = [row("a", { spend: 100, results: 40 }), row("b", { spend: 50, results: 10 })];
    const out = buildMarketingFindings({ spend: 150, leads: 20, cpl: 7.5 }, rows, money);
    expect(text(out.find((f) => f.tone === "success"))).toContain("80% of the total");
  });

  it("returns nothing with no rows or no spend", () => {
    expect(buildMarketingFindings(CURRENT, [], money)).toEqual([]);
    expect(buildMarketingFindings({ spend: 0, leads: 0, cpl: 0 }, ROWS, money)).toEqual([]);
    expect(buildMarketingFindings(null, ROWS, money)).toEqual([]);
  });
});

describe("marketingInsightPrompt", () => {
  it("joins the sentence back together and asks what to do", () => {
    const segments = [
      { text: "Spend is up " },
      { text: "12%", strong: true },
      { text: " at " },
      { text: "£4.10", strong: true },
      { text: " CPL. " },
    ];
    expect(marketingInsightPrompt(segments)).toBe(
      "About my Marketing Hub this period: Spend is up 12% at £4.10 CPL.  What should I do about it?"
    );
  });

  it("copes with no segments", () => {
    expect(marketingInsightPrompt(undefined)).toBe(
      "About my Marketing Hub this period:  What should I do about it?"
    );
  });
});
