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

export const DEFAULT_DATE_PRESET = "last_7d"

// Curated, tool-calling-capable models for the BYOK "add your own AI agent"
// connect form (src/app/settings/page.jsx). The backend independently
// re-validates the specific model on every save (a real API call, forced
// tool_choice), so a stale entry here just means that one save is rejected
// with a clear message — not silent breakage.
export const AI_MODELS = {
  anthropic: [
    { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4o", label: "GPT-4o" },
  ],
}

export const CACHE_KEYS = {
  CLIENT_GROUPS: "clientGroups",
  USER_VIEWS: "userViews",
}

export const CACHE_DURATION = {
  clientGroups: 60 * 60 * 1000,
  userViews: 24 * 60 * 60 * 1000,
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
  SALES_HUB_CALLS_LIMIT: "sales_hub_calls_limit",
}

export const PUBLIC_ROUTES = ["/", "/login", "/register"]

export const PROTECTED_ROUTES = [
  "/clients",
  "/call-center",
  "/settings",
  "/campaigns",
  "/contacts",
  "/admin",
]
