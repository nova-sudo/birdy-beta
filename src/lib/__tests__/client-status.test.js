/**
 * Client status — the casing bug, pinned.
 *
 * The collection holds 49 "Active", 18 "Inactive" and 9 lowercase "active".
 * Every frontend surface compared with `=== "Active"`, so those 9 groups fell
 * out of the stat cards and were counted as inactive in the filter badges,
 * while the backend (which uses `{$ne: "Inactive"}`) counted them as active.
 */

import { describe, it, expect } from "vitest";
import {
  activeGroups,
  isActive,
  matchesStatusFilter,
  normalizeStatus,
  statusCounts,
} from "@/lib/client-status";

const g = (client_status) => ({ id: String(client_status), client_status });

describe("normalizeStatus", () => {
  it("canonicalises casing and whitespace", () => {
    expect(normalizeStatus("Active")).toBe("Active");
    expect(normalizeStatus("active")).toBe("Active");
    expect(normalizeStatus("Inactive")).toBe("Inactive");
    expect(normalizeStatus("inactive")).toBe("Inactive");
    expect(normalizeStatus("  INACTIVE  ")).toBe("Inactive");
  });

  it("treats missing and unrecognised values as active, like the API does", () => {
    expect(normalizeStatus(undefined)).toBe("Active");
    expect(normalizeStatus(null)).toBe("Active");
    expect(normalizeStatus("")).toBe("Active");
    expect(normalizeStatus("archived")).toBe("Active");
  });
});

describe("isActive", () => {
  it("counts a lowercase stored status as active — the actual bug", () => {
    expect(isActive(g("active"))).toBe(true);
  });

  it("still excludes inactive in any casing", () => {
    expect(isActive(g("Inactive"))).toBe(false);
    expect(isActive(g("inactive"))).toBe(false);
  });

  it("defaults a group with no status to active", () => {
    expect(isActive({ id: "x" })).toBe(true);
  });
});

describe("activeGroups", () => {
  it("keeps every casing of active and drops every casing of inactive", () => {
    const groups = [g("Active"), g("active"), g("Inactive"), g("inactive"), { id: "none" }];
    expect(activeGroups(groups).map((x) => x.id)).toEqual(["Active", "active", "none"]);
  });

  it("is null-safe for an unloaded list", () => {
    expect(activeGroups(undefined)).toEqual([]);
    expect(activeGroups(null)).toEqual([]);
  });
});

describe("matchesStatusFilter", () => {
  it("matches a lowercase stored value against the Active filter chip", () => {
    expect(matchesStatusFilter(g("active"), "Active")).toBe(true);
    expect(matchesStatusFilter(g("Active"), "Active")).toBe(true);
    expect(matchesStatusFilter(g("Inactive"), "Active")).toBe(false);
  });

  it("passes everything through on 'all'", () => {
    expect(matchesStatusFilter(g("Inactive"), "all")).toBe(true);
    expect(matchesStatusFilter(g("active"), "all")).toBe(true);
  });
});

describe("statusCounts", () => {
  it("does not file lowercase-active groups under inactive", () => {
    const groups = [g("Active"), g("active"), g("active"), g("Inactive")];
    expect(statusCounts(groups)).toEqual({ all: 4, active: 3, inactive: 1 });
  });

  it("handles an empty list", () => {
    expect(statusCounts([])).toEqual({ all: 0, active: 0, inactive: 0 });
  });
});
