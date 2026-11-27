"use client";

// A section's views and where each one lives. Marketing Guru and Sales Coach
// have four tabs; Birdy has three, its first view being the old Portfolio
// Dashboard. The addresses come from their config.

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSuggestionCount } from "@/components/agency/use-suggestions";
import { OPS_SECTION } from "@/components/agency/sections";
import { usePendingProposals } from "@/lib/proposals-api";

/** Marketing Guru's and Sales Coach's tab pill. */
export const SECTION_TABS = [
  { value: "chat", label: "Chat" },
  { value: "birdseye", label: "Bird's Eye" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions" },
];

/**
 * Agency Ops' tab pill: the same four. Its Bird's Eye (/dashboard) is the old Portfolio
 * Dashboard and its Dashboard (/dashboard/table) the old Leads hub's table.
 */
export const OPS_TABS = SECTION_TABS;

/**
 * The pages under the "More" menu at the end of the tab pill, in the reference's order. A section
 * lists only the ones it has an address for (sections.js `paths`): Reports for every section (its
 * own Slack reports; Marketing Guru's also lists its agent's morning and weekly reports), Projections
 * for Marketing Guru only (budget pacing), so the menu never leads to a page with nothing real on it.
 */
export const MORE_PAGES = [
  { value: "reports", label: "Reports" },
  { value: "projections", label: "Projections" },
  { value: "context", label: "Context" },
];

/** The "More" pages one section has. */
export const morePagesOf = (section = OPS_SECTION) => MORE_PAGES.filter((p) => section.paths[p.value]);

/**
 * A section's tabs, with the number of its open suggestions on the Suggestions tab. Marketing Guru
 * and Sales Coach also count the proposals waiting for the owner's approval in their area.
 * @param {import("./sections").SectionConfig} [section] Birdy when left out
 */
export function useSectionTabs(section = OPS_SECTION) {
  // Each tab is its own page. Fetching them all as soon as one is open makes a switch feel like a
  // tab change, not a page load.
  const router = useRouter();
  useEffect(() => {
    for (const path of Object.values(section.paths)) router.prefetch?.(path);
  }, [router, section]);
  const ops = section === OPS_SECTION;
  // Birdy counts every suggestion, as it always has; the others count their own.
  const suggestions = useSuggestionCount(ops ? undefined : section.ownsSuggestion);
  const { proposals } = usePendingProposals(ops ? null : section.chat.agent);
  const waiting = proposals.length;
  const count = (Number(suggestions) || 0) + waiting;
  return useMemo(() => (ops ? OPS_TABS : SECTION_TABS).map((t) => (t.value === "suggestions" ? { ...t, count } : t)), [ops, count]);
}

/** Birdy's tabs. */
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

/** The address of one of Birdy's tabs. */
export const opsTabHref = (tab, search) => sectionTabHref(OPS_SECTION, tab, search);
