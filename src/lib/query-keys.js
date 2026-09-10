/**
 * Every SWR key in one place.
 *
 * A key is the endpoint path, so building them here rather than inline is what
 * makes sharing work: `useClientGroups` on the dashboard and on /clients only
 * dedupe into one request if they spell the URL identically, down to
 * parameter order. Hardcoding the string at each call site is how you end up
 * with two caches of the same six megabytes.
 *
 * The other half is the reason there is a `variant` in the client-groups key
 * at all. /clients asks for include_daily=false; the hubs that chart trends
 * need the series. Sharing one key meant whichever loaded first won, and the
 * hub then summed per-day fields that weren't there and rendered a confident
 * zero. The parameter is part of the identity of the thing, so it is part of
 * the key.
 */

export const queryKeys = {
  clientGroups: (preset, includeDaily = true) =>
    `/api/client-groups?date_preset=${preset}` + (includeDaily ? "" : "&include_daily=false"),

  // No preset in this key, deliberately. The per-day series are stored and
  // served whole — each row is a day, and which days you want is decided in
  // the browser — so the answer is identical for every window. One key means
  // moving the date picker doesn't refetch a few hundred kilobytes of history
  // that cannot have changed.
  clientGroupsDaily: () => "/api/client-groups/daily",

  alerts: () => "/api/alerts",

  dashboardSummary: () => "/api/dashboard/summary",

  creditsStatus: () => "/api/credits/status",

  userViews: () => "/api/user/views",

  facebookLeadSeries: (params) => `/api/facebook-leads/series?${params}`,

  callCenter: (params) => `/api/hotprospector/call-center?${params}`,
}
