// Sales Hub page constants

// Recent-calls tab: how many leads' call logs to pull from the leads endpoint
// before flattening + sorting, so there are enough calls to satisfy the
// user-configured "recent calls" count (there's no dedicated flat call feed).
// NOTE: /api/hotprospector/call-center sorts leads by lead *creation* date,
// not by call recency, so a small batch can badly undercount real recent
// calls (most of the newest-created leads may have no calls at all in the
// window). Fetching a much larger batch is a heuristic band-aid, not a
// guarantee — a correct fix needs a backend aggregation that sorts by call
// time directly.
export const CALLS_FETCH_MULTIPLIER = 20
export const MIN_CALLS_TO_FETCH = 500
export const MAX_LEADS_TO_FETCH = 2000
export const MIN_CALLS_LIMIT = 5
export const MAX_CALLS_LIMIT = 100
export const DEFAULT_CALLS_LIMIT = 20
