import { describe, expect, it } from "vitest";
import { cachedConnection, cachedSlack, connectionState, formatDate, integrationFromScope, needsYouCount } from "../integrations";

describe("cachedConnection", () => {
  const now = new Date("2026-11-21T12:00:00Z");

  it("is disconnected without a stored copy, or with a broken one", () => {
    expect(cachedConnection(null, now)).toEqual({ connected: false });
    expect(cachedConnection("{nope", now)).toEqual({ connected: false });
    expect(cachedConnection(JSON.stringify({ connected: false }), now)).toEqual({ connected: false });
  });

  it("works the expiry out again against the clock", () => {
    const stale = JSON.stringify({ connected: true, expires_at: "2026-11-20T00:00:00Z", token_expired: false });
    expect(cachedConnection(stale, now).token_expired).toBe(true);
    const fresh = JSON.stringify({ connected: true, expires_at: "2026-12-20T00:00:00Z", token_expired: true });
    expect(cachedConnection(fresh, now).token_expired).toBe(false);
  });
});

describe("cachedSlack", () => {
  it("keeps an installed copy and drops anything else", () => {
    expect(cachedSlack(JSON.stringify({ installed: true, team_name: "Acme" }))).toEqual({ installed: true, team_name: "Acme" });
    expect(cachedSlack(null)).toEqual({ installed: false });
    expect(cachedSlack("{")).toEqual({ installed: false });
  });
});

describe("integrationFromScope", () => {
  it("tells Meta's callback from GoHighLevel's", () => {
    expect(integrationFromScope("ads_read,read_insights")).toBe("facebook");
    expect(integrationFromScope("contacts.readonly")).toBe("gohighlevel");
    expect(integrationFromScope(undefined)).toBe("gohighlevel");
  });
});

describe("needsYouCount", () => {
  it("counts connected GoHighLevel and Meta with an expired token", () => {
    expect(needsYouCount({ ghl: { connected: true, token_expired: true }, facebook: { connected: true, token_expired: false } })).toBe(1);
    expect(needsYouCount({ ghl: { connected: false }, facebook: { connected: true, token_expired: true } })).toBe(1);
    expect(needsYouCount({ ghl: { connected: false }, facebook: { connected: false } })).toBe(0);
  });
});

describe("formatDate", () => {
  it("writes a date the short way, or nothing", () => {
    expect(formatDate("2026-11-06T10:00:00Z")).toBe("6 Nov 2026");
    expect(formatDate("garbage")).toBeNull();
    expect(formatDate(null)).toBeNull();
  });
});

describe("connectionState", () => {
  it("says checking until the first status lands, then connected, expired or not connected", () => {
    expect(connectionState({ connected: false }, true)).toBe("checking");
    expect(connectionState({ connected: false }, false)).toBe("disconnected");
    expect(connectionState({ connected: true }, true)).toBe("connected");
    expect(connectionState({ connected: true, token_expired: true }, false)).toBe("expired");
    expect(connectionState({ installed: true }, false)).toBe("connected");
  });
});
