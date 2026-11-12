// Answers to a 409 claim conflict, and what Turn on says when the server refuses.

/** Answering "Move all" after "Only flag": the flagged clients ride along, or the move takes them too. */
export function moveClaims(flagOnly) {
  return flagOnly.length > 0 ? { move_claims: true, only_flag: flagOnly } : { move_claims: true }
}

/** What Turn on says when the server refuses. */
export function activationMessage(err) {
  if (err?.status === 404) return "Turning the agent on isn't available yet. Your setup is saved, so you can come back to it."
  if (err?.status === 409) {
    // The route sends {detail, missing}; older shapes nested missing in detail.
    const missing = err.missing ?? err.detail?.missing
    if (Array.isArray(missing) && missing.length) return `It isn't ready to turn on yet. Still needed: ${missing.join(", ")}.`
    return typeof err.detail === "string" ? err.detail : "It isn't ready to turn on yet."
  }
  if (err?.status === 400) return typeof err.detail === "string" ? err.detail : "Check the setup and try again."
  return "Couldn't turn it on. Try again in a moment."
}
