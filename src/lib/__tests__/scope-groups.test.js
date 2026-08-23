/**
 * Which client groups a Marketing Hub figure is built from.
 *
 * The Clients page has always excluded inactive clients; the Marketing Hub
 * never did. That one difference made every spend figure on Marketing about
 * 11% higher than the same figure on Clients — £5,011.38 against £4,518.22
 * over seven days, from 18 inactive clients.
 *
 * The second rule matters as much: a client picked by name is shown whatever
 * its status. Picking an archived client and getting an empty screen would be
 * a worse bug than the one this fixes.
 */

import { describe, it, expect } from "vitest";
import { scopeGroups } from "@/lib/marketing-aggregate";

const g = (id, client_status) => ({ id, client_status });

const GROUPS = [
  g("a", "Active"),
  g("b", "Inactive"),
  g("c", "active"),      // lowercase — 9 rows are stored this way
  g("d", "inactive"),
  g("e", undefined),     // no status — the API treats this as active
];

describe("scopeGroups", () => {
  it("drops inactive clients on 'all'", () => {
    expect(scopeGroups(GROUPS, "all").map(x => x.id)).toEqual(["a", "c", "e"]);
  });

  it("drops them when no group is specified at all", () => {
    expect(scopeGroups(GROUPS).map(x => x.id)).toEqual(["a", "c", "e"]);
    expect(scopeGroups(GROUPS, null).map(x => x.id)).toEqual(["a", "c", "e"]);
  });

  it("matches casing the way the backend does", () => {
    // The backend uses { $ne: "Inactive" }, so lowercase 'active' counts as
    // active and a missing status counts as active.
    expect(scopeGroups([g("c", "active")], "all")).toHaveLength(1);
    expect(scopeGroups([g("d", "inactive")], "all")).toHaveLength(0);
    expect(scopeGroups([g("e", undefined)], "all")).toHaveLength(1);
  });

  it("shows a specifically picked client even when it is inactive", () => {
    expect(scopeGroups(GROUPS, "b").map(x => x.id)).toEqual(["b"]);
    expect(scopeGroups(GROUPS, "d").map(x => x.id)).toEqual(["d"]);
  });

  it("returns nothing for a group id that is not present", () => {
    expect(scopeGroups(GROUPS, "zzz")).toEqual([]);
  });

  it("is null-safe for an unloaded list", () => {
    expect(scopeGroups(null, "all")).toEqual([]);
    expect(scopeGroups(undefined)).toEqual([]);
  });

  it("tolerates padded status values", () => {
    expect(scopeGroups([g("x", "  Inactive  ")], "all")).toHaveLength(0);
  });
});
