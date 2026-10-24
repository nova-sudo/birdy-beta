import { formatDistanceToNow } from "date-fns"

/** "2 hours ago", or an em dash when the timestamp is missing or unparseable. */
export function relative(ts) {
  if (!ts) return "—"
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true })
  } catch {
    return "—"
  }
}

// Only the top plan earns a colour; the rest read as plain labels so a column of
// Free / Growth / Starter doesn't turn into a rainbow.
export const planTone = (plan) => (plan === "Scale" ? "primary" : "neutral")
