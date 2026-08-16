import { describe, it, expect } from "vitest";
import {
  deltaTone,
  diagnoseFunnel,
  isImprovement,
  HIGHER_IS_BETTER,
  LOWER_IS_BETTER,
  MATERIAL_DECLINE_PCT,
} from "@/lib/portfolio-metrics";

describe("delta polarity", () => {
  it("reads a rise as good for an ordinary metric", () => {
    expect(isImprovement("up", HIGHER_IS_BETTER)).toBe(true);
    expect(isImprovement("down", HIGHER_IS_BETTER)).toBe(false);
  });

  it("reads a fall as good for an inverted metric", () => {
    // Average CPL, speed to lead, calls per close.
    expect(isImprovement("down", LOWER_IS_BETTER)).toBe(true);
    expect(isImprovement("up", LOWER_IS_BETTER)).toBe(false);
  });

  it("defaults to higher-is-better when no polarity is given", () => {
    expect(isImprovement("up")).toBe(true);
  });

  it("colours a falling CPL green and a rising one red", () => {
    expect(deltaTone("down", LOWER_IS_BETTER).text).toBe("text-pd-success");
    expect(deltaTone("up", LOWER_IS_BETTER).text).toBe("text-pd-danger");
  });

  it("colours falling leads red", () => {
    expect(deltaTone("down", HIGHER_IS_BETTER).text).toBe("text-pd-danger");
    expect(deltaTone("down", HIGHER_IS_BETTER).bg).toBe("bg-pd-danger-bg");
  });
});

describe("diagnoseFunnel", () => {
  const stages = [
    { stage: "Leads", direction: "up", delta: 12.1, issue: "lead flow", stageNoun: "lead" },
    { stage: "Engaged", direction: "up", delta: 9.4, issue: "engagement", stageNoun: "engagement" },
    { stage: "Convos", direction: "up", delta: 6.2, issue: "conversation rate", stageNoun: "conversation" },
    { stage: "Closes", direction: "down", delta: 4.8, issue: "close rate", stageNoun: "closing" },
    { stage: "Shows", direction: "up", delta: 3.1, issue: "show rate", stageNoun: "show" },
  ];

  it("reproduces the handoff's banner for the design's figures", () => {
    expect(diagnoseFunnel(stages)).toEqual({
      state: "problem",
      title: "Problem found: close rate",
      body:
        "Closes are down 4.8% while convos are up 6.2% — the drop is at the closing stage, not lead flow.",
    });
  });

  it("names the strongest stage when nothing is materially down", () => {
    const healthy = stages.map((s) => ({ ...s, direction: "up" }));
    const result = diagnoseFunnel(healthy);

    expect(result.state).toBe("healthy");
    expect(result.title).toBe("All looking good");
    expect(result.body).toContain("Leads are up 12.1%");
  });

  it("ignores a dip smaller than the material threshold", () => {
    const noisy = stages.map((s) =>
      s.stage === "Closes" ? { ...s, delta: MATERIAL_DECLINE_PCT / 2 } : { ...s, direction: "up" }
    );
    expect(diagnoseFunnel(noisy).state).toBe("healthy");
  });

  it("picks the worst stage when several are falling", () => {
    const sliding = stages.map((s) =>
      s.stage === "Convos" ? { ...s, direction: "down", delta: 15 } : s
    );
    expect(diagnoseFunnel(sliding).title).toBe("Problem found: conversation rate");
  });

  it("drops the upstream contrast when the feeding stage is also falling", () => {
    // The whole funnel sliding is not a problem localised to one step, so
    // singling one out would misread it.
    const sliding = stages.map((s) =>
      s.stage === "Convos" ? { ...s, direction: "down", delta: 3 } : s
    );
    const result = diagnoseFunnel(sliding);

    expect(result.body).toBe("Closes are down 4.8%.");
    expect(result.body).not.toContain("while");
  });

  it("ignores stages that carry no delta at all", () => {
    // Attributed stages are derived from one window's lead rows and have no
    // prior period. Reading their missing delta as zero would let a stage with
    // no information win "strongest stage" — or mask a real decline elsewhere.
    const mixed = [
      { stage: "Leads", direction: "up", delta: 4.2, issue: "lead flow" },
      { stage: "In CRM", issue: "CRM sync" },
      { stage: "Closes", issue: "close rate" },
    ];
    const result = diagnoseFunnel(mixed);

    expect(result.state).toBe("healthy");
    expect(result.body).toContain("Leads are up 4.2%");
    expect(result.body).not.toContain("undefined");
  });

  it("stays quiet when no stage has anything to compare", () => {
    const result = diagnoseFunnel([{ stage: "Leads" }, { stage: "In CRM" }]);
    expect(result).toEqual({ state: "healthy", title: "All looking good", body: "" });
  });

  it("survives an empty funnel", () => {
    expect(diagnoseFunnel([]).state).toBe("healthy");
    expect(diagnoseFunnel(undefined).state).toBe("healthy");
  });
});
