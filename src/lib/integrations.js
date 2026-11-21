// Pure helpers for Settings' connections: reading the cached status, telling
// an OAuth callback's provider apart, and the words each card shows.

/**
 * A connection's last known status from its localStorage copy. `token_expired`
 * is worked out again against the clock, so yesterday's `false` cannot claim a
 * token is still good after its `expires_at`.
 * @param {string|null} raw the stored JSON
 * @param {Date} [now]
 */
export function cachedConnection(raw, now = new Date()) {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !parsed.connected) return { connected: false };
    if (parsed.expires_at) parsed.token_expired = new Date(parsed.expires_at) < now;
    return parsed;
  } catch {
    return { connected: false };
  }
}

/** Slack's last known status. Slack says `installed`, not `connected`. */
export function cachedSlack(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.installed ? parsed : { installed: false };
  } catch {
    return { installed: false };
  }
}

/** Which provider an OAuth callback's tokens came from: Meta's scope asks for insights. */
export const integrationFromScope = (scope) => (scope?.includes("read_insights") ? "facebook" : "gohighlevel");

/** How many connections need the owner: GoHighLevel or Meta connected with an expired token. */
export function needsYouCount({ ghl, facebook }) {
  return [ghl, facebook].filter((c) => c?.connected && c.token_expired).length;
}

/** An expiry date as "6 Nov 2026", or null when there is none or it is not a date. */
export function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The state a card shows.
 * @param {{connected?: boolean, installed?: boolean, token_expired?: boolean}} status
 * @param {boolean} checking the first status request has not come back yet
 * @returns {"checking"|"connected"|"expired"|"disconnected"}
 */
export function connectionState(status, checking) {
  const on = status?.connected || status?.installed;
  if (on) return status.token_expired ? "expired" : "connected";
  return checking ? "checking" : "disconnected";
}
