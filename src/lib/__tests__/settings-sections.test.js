import { describe, expect, it } from "vitest";
import { sectionFromParams, sectionHref, sectionRedirect } from "../settings-sections";

const p = (q) => new URLSearchParams(q);

describe("settings sections", () => {
  it("opens the asked-for section, Connections otherwise", () => {
    expect(sectionFromParams(p("section=metrics"))).toBe("metrics");
    expect(sectionFromParams(p("section=nope"))).toBe("connections");
    expect(sectionFromParams(p(""))).toBe("connections");
  });

  it("sends the old ?tab= values to the section that holds them", () => {
    expect(sectionFromParams(p("tab=integrations"))).toBe("connections");
    expect(sectionFromParams(p("tab=ai"))).toBe("connections");
    expect(sectionFromParams(p("tab=tracking"))).toBe("connections");
    expect(sectionFromParams(p("tab=general"))).toBe("account");
    expect(sectionFromParams(p("tab=billing"))).toBe("plan");
    expect(sectionFromParams(p("tab=capabilities"))).toBe("connections");
  });

  it("writes Connections as plain /settings", () => {
    expect(sectionHref("connections")).toBe("/settings");
    expect(sectionHref("plan")).toBe("/settings?section=plan");
  });

  it("redirects an old page keeping its query string", () => {
    expect(sectionRedirect("metrics", {})).toBe("/settings?section=metrics");
    expect(sectionRedirect("metrics", { tab: "custom", q: "cpa" })).toBe("/settings?section=metrics&tab=custom&q=cpa");
    expect(sectionRedirect("plan", { topup: "success", section: "x", a: ["1", "2"] })).toBe("/settings?section=plan&topup=success&a=1&a=2");
  });

  it("lands /alerts?tab= on Alerts, not on the section an old ?tab= value names", () => {
    const href = sectionRedirect("alerts", { tab: "triggered" });
    expect(href).toBe("/settings?section=alerts&tab=triggered");
    expect(sectionFromParams(new URLSearchParams(href.split("?")[1]))).toBe("alerts");
  });
});
