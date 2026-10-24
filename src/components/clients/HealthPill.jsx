// components/clients/HealthPill.jsx
// The Healthy / Warning / Critical badge from the Client Detail and Client Hub
// handoffs, and the value list behind the settings dropdown.
//
// Health is set by hand, never derived. The design describes the control as
// "Manually set this client's health", and nothing in the product classifies a
// client — so this renders a stored choice and nothing more. A client with no
// choice recorded reads as Healthy, matching the backend default.

import { Badge } from "@/components/ds"

export const CLIENT_HEALTH = ["Healthy", "Warning", "Critical"]
export const DEFAULT_CLIENT_HEALTH = "Healthy"

/** Health reads in the same status tones the rest of the app uses. */
export const HEALTH_TONE = { Healthy: "success", Warning: "warning", Critical: "danger" }

/**
 * @param {string}  health   one of CLIENT_HEALTH; anything else falls back to the default
 * @param {boolean} withDot  a status dot before the label (the Client Detail header);
 *                           without it the badge is a soft tinted chip
 */
export function HealthPill({ health, withDot = true, className }) {
  const value = CLIENT_HEALTH.includes(health) ? health : DEFAULT_CLIENT_HEALTH

  return (
    <Badge tone={HEALTH_TONE[value]} variant={withDot ? "dot" : "soft"} className={className}>
      {value}
    </Badge>
  )
}
