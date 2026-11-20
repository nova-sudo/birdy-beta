"use client";

// A section's views and where each one lives. Agency Ops, Media Buyer and
// Sales Coach have the same four tabs; the addresses come from their config.

import { useMemo } from "react";
import { useSuggestionCount } from "@/components/agency/use-suggestions";
import { OPS_SECTION } from "@/components/agency/sections";

/** The section's tab pill. */
export const OPS_TABS = [
  { value: "chat", label: "Chat" },
  { value: "birdseye", label: "Bird's Eye" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions" },
];

/**
 * The pages under the "More" menu at the end of the tab pill. The reference also lists Reports and
 * Projections there; they join this list once they are built, so the menu never leads nowhere.
 */
export const MORE_PAGES = [{ value: "context", label: "Context" }];

/**
 * A section's tabs, with the number of its open suggestions on the Suggestions tab.
 * @param {import("./sections").SectionConfig} [section] Agency Ops when left out
 */
export function useSectionTabs(section = OPS_SECTION) {
  // Agency Ops counts every suggestion, as it always has; the others count their own.
  const count = useSuggestionCount(section === OPS_SECTION ? undefined : section.ownsSuggestion);
  return useMemo(() => OPS_TABS.map((t) => (t.value === "suggestions" ? { ...t, count } : t)), [count]);
}

/** Agency Ops' tabs. */
export const useOpsTabs = () => useSectionTabs(OPS_SECTION);

/**
 * The address of a section's tab, keeping the client and the date range the current address carries.
 * @param {import("./sections").SectionConfig} section
 * @param {string} tab
 * @param {URLSearchParams} [search] the current address's query
 * @param {Record<string, string>} [extra] more to put on the address, such as the conversation to open
 */
export function sectionTabHref(section, tab, search, extra = {}) {
  const keep = new URLSearchParams();
  for (const key of ["client", "range"]) {
    const value = search?.get(key);
    if (value) keep.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) if (value) keep.set(key, value);
  const query = keep.toString();
  return `${section.paths[tab] ?? section.paths.birdseye}${query ? `?${query}` : ""}`;
}

/** The address of one of Agency Ops' tabs. */
export const opsTabHref = (tab, search) => sectionTabHref(OPS_SECTION, tab, search);
