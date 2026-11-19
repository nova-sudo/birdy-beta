"use client";

// Agency Ops' views and where each one lives.

import { useMemo } from "react";
import { useSuggestionCount } from "@/components/agency/use-suggestions";

/** The section's tab pill. */
export const OPS_TABS = [
  { value: "chat", label: "Chat" },
  { value: "birdseye", label: "Bird's Eye" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions" },
];

const PATHS = { chat: "/dashboard/chat", birdseye: "/dashboard", dashboard: "/dashboard/table", suggestions: "/dashboard/suggestions" };

/** The tabs, with the number of open suggestions on its tab. */
export function useOpsTabs() {
  const count = useSuggestionCount();
  return useMemo(() => OPS_TABS.map((t) => (t.value === "suggestions" ? { ...t, count } : t)), [count]);
}

/**
 * The address of a tab, keeping the client and the date range the current address carries.
 * @param {string} tab
 * @param {URLSearchParams} [search] the current address's query
 */
export function opsTabHref(tab, search) {
  const keep = new URLSearchParams();
  for (const key of ["client", "range"]) {
    const value = search?.get(key);
    if (value) keep.set(key, value);
  }
  const query = keep.toString();
  return `${PATHS[tab] ?? PATHS.birdseye}${query ? `?${query}` : ""}`;
}
