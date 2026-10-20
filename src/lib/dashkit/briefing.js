import { DASHKIT_BASE_URL, dashkitFetch } from "./fetch"

/**
 * What the briefing widget says when a request fails, by status. dashkit shows
 * the rejection's message with a Retry button (a failed Refresh keeps the
 * briefing it was refreshing), so these are written for the reader, not taken
 * from the server's `detail`.
 */
const FAILURES = {
  429: "Too many refreshes in the last hour. Try again in a little while.",
  402: "You're out of credits, so Birdy can't write a new briefing.",
  502: "Birdy couldn't write the briefing right now.",
}
const GENERIC_FAILURE = "Couldn't load the briefing."

/**
 * dashkit's `BriefingProvider` handler: the board's AI briefing from
 * POST /api/dashboards/{id}/briefing, as dashkit's `BriefingResult`.
 *
 * The request is exactly what dashkit hands over (`focus` only when the widget
 * has one). The backend answers `generated_at`; dashkit reads `generatedAt`.
 * Any failure rejects with an Error whose message the widget shows.
 *
 * @param {import("dashkit/react").BriefingRequest} req
 * @returns {Promise<import("dashkit/react").BriefingResult>}
 */
export async function fetchBriefing({ dashboardId, focus, refresh }) {
  const url = `${DASHKIT_BASE_URL}/dashboards/${encodeURIComponent(dashboardId)}/briefing`
  let res
  try {
    res = await dashkitFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(focus ? { focus } : {}), refresh }),
    })
  } catch {
    throw new Error(GENERIC_FAILURE)
  }
  if (!res.ok) throw new Error(FAILURES[res.status] ?? GENERIC_FAILURE)

  let body
  try {
    body = JSON.parse(await res.text())
  } catch {
    throw new Error(GENERIC_FAILURE)
  }
  return {
    parts: body.parts ?? [],
    findings: body.findings ?? [],
    generatedAt: body.generated_at,
    cached: Boolean(body.cached),
  }
}
