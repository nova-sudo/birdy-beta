// Agency Ops' views and where each one lives.

/** The section's tab pill. Dashboard and Suggestions are not rebuilt yet, so they are shown greyed. */
export const OPS_TABS = [
  { value: "chat", label: "Chat" },
  { value: "birdseye", label: "Bird's Eye" },
  { value: "dashboard", label: "Dashboard", disabled: true },
  { value: "suggestions", label: "Suggestions", disabled: true },
];

const PATHS = { chat: "/dashboard/chat", birdseye: "/dashboard" };

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
