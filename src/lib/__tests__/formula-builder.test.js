import { describe, expect, it } from "vitest";
import {
  addOperand, canAddOperand, canAddOperator, copyName, dashboardDisabled, formatSample, formulaLevel, formulaProblem, formulaText, formulaWords, isEmpty, nameTaken, removePart, sampleResult,
} from "../formula-builder";

const m = (value) => ({ type: "metric", value });
const op = (value) => ({ type: "operator", value });
const n = (value) => ({ type: "number", value, label: String(value) });

describe("building a formula", () => {
  it("treats the old empty placeholder as empty", () => {
    expect(isEmpty([])).toBe(true);
    expect(isEmpty([m("")])).toBe(true);
    expect(isEmpty([m("spend")])).toBe(false);
  });

  it("alternates operands and operators", () => {
    expect(canAddOperand([])).toBe(true);
    expect(canAddOperator([])).toBe(false);
    expect(canAddOperator([m("spend")])).toBe(true);
    expect(canAddOperand([m("spend")])).toBe(false);
    expect(canAddOperand([m("spend"), op("/")])).toBe(true);
    expect(canAddOperator([m("spend"), op("/"), n(2)])).toBe(true);
  });

  it("replaces the empty placeholder with the first operand", () => {
    expect(addOperand([m("")], m("spend"))).toEqual([m("spend")]);
    expect(addOperand([m("spend"), op("/")], n(2))).toEqual([m("spend"), op("/"), n(2)]);
  });

  it("removes a part with its neighbouring operator", () => {
    const parts = [m("a"), op("+"), m("b"), op("*"), m("c")];
    expect(removePart(parts, 2)).toEqual([m("a"), op("*"), m("c")]);
    expect(removePart(parts, 0)).toEqual([m("b"), op("*"), m("c")]);
    expect(removePart([m("a")], 0)).toEqual([]);
  });

  it("names what stops a save", () => {
    expect(formulaProblem([])).toMatch(/Add a metric/);
    expect(formulaProblem([m("a"), op("+")])).toMatch(/End the formula/);
    expect(formulaProblem([m("a"), op("+"), n(1)])).toBeNull();
  });
});

describe("writing a formula out", () => {
  const labels = { spend: "Spend", ghl_revenue: "Revenue" };
  it("stores labels and raw operators, and shows people real signs", () => {
    const parts = [m("ghl_revenue"), op("/"), m("spend"), op("*"), n(100)];
    expect(formulaText(parts, (id) => labels[id])).toBe("Revenue / Spend * 100");
    expect(formulaWords(parts, (id) => labels[id])).toBe("Revenue ÷ Spend × 100");
    expect(formulaText([m("unknown")], () => undefined)).toBe("unknown");
  });
});

describe("levels and dashboards", () => {
  it("limits dashboards to the formula's level", () => {
    expect(formulaLevel([m("spend")]).level).toBe("campaign");
    expect(dashboardDisabled([m("spend")], "clients")).toBe(true);
    expect(dashboardDisabled([m("spend")], "ads")).toBe(false);
    expect(dashboardDisabled([m("custom_x")], "clients")).toBe(false);
  });

  it("refuses every dashboard when levels mix", () => {
    const parts = [m("meta_spend"), op("/"), m("spend")];
    expect(formulaLevel(parts).mixed).toBe(true);
    expect(dashboardDisabled(parts, "clients")).toBe(true);
  });
});

describe("names", () => {
  it("suggests a free copy name", () => {
    expect(copyName("CPA", ["CPA"])).toBe("CPA (copy)");
    expect(copyName("CPA", ["CPA", "cpa (copy)", "CPA (copy 2)"])).toBe("CPA (copy 3)");
  });

  it("spots a taken name, ignoring the metric being edited", () => {
    const customs = [{ id: "a", name: " CPA " }];
    expect(nameTaken("cpa", customs)).toBe(true);
    expect(nameTaken("cpa", customs, "a")).toBe(false);
    expect(nameTaken("", customs)).toBe(false);
  });
});

describe("the sample preview", () => {
  it("works the formula out with × and ÷ first", () => {
    expect(sampleResult([m("spend"), op("+"), m("spend"), op("/"), n(4)])).toBe(1250);
    expect(sampleResult([m("ghl_revenue"), op("/"), m("meta_spend")])).toBeCloseTo(4.2);
  });

  it("works a custom metric out from its own formula, and survives a loop", () => {
    const customs = [{ id: "custom_a", formulaParts: [m("spend"), op("/"), n(10)] }, { id: "custom_loop", formulaParts: [m("custom_loop")] }];
    expect(sampleResult([m("custom_a")], customs)).toBe(100);
    expect(sampleResult([m("custom_loop"), op("+"), n(1)], customs)).toBe(1);
  });

  it("has nothing to show for an empty or unfinished formula, or a division by zero", () => {
    expect(sampleResult([])).toBeNull();
    expect(sampleResult([m("spend"), op("/")])).toBeNull();
    expect(sampleResult([m("spend"), op("/"), n(0)])).toBeNull();
  });

  it("formats the figure", () => {
    expect(formatSample(8.333, "currency")).toBe("$8.33");
    expect(formatSample(0.083, "percentage")).toBe("8.3%");
    expect(formatSample(1250.4, "integer")).toBe("1,250");
    expect(formatSample(null, "integer")).toBe("–");
  });
});
