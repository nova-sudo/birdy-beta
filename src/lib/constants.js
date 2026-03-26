// Shared constants used across multiple pages

export const DATE_PRESETS = [
  { value: "maximum", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week_mon_today", label: "This Week" },
  { value: "last_7d", label: "Last 7 Days" },
  { value: "last_14d", label: "Last 14 Days" },
  { value: "last_30d", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
]

export const CACHE_DURATION = {
  clientGroups: 120 * 60 * 1000,
  ghlLocations: 60 * 60 * 1000,
  metaAdAccounts: 60 * 60 * 1000,
  hotProspectorGroups: 60 * 60 * 1000,
}

export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  REFRESH_TOKEN: "refresh_token",
  USER: "user",
  USER_AUTHENTICATED: "user_authenticated",
  DEFAULT_CURRENCY: "user_default_currency",
  CUSTOM_METRICS: "customMetrics",
  OAUTH_REFRESH_QUEUE: "oauth_refresh_queue",
}

export const PUBLIC_ROUTES = ["/", "/login", "/register"]

export const PROTECTED_ROUTES = [
  "/clients",
  "/call-center",
  "/settings",
  "/campaigns",
  "/contacts",
]
