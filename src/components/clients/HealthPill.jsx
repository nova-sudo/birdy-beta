// components/clients/HealthPill.jsx
// The Healthy / Warning / Critical pill from the Client Detail and Client Hub
// handoffs, and the value list behind the settings dropdown.
//
// Health is set by hand, never derived. The design describes the control as
// "Manually set this client's health", and nothing in the product classifies a
// client — so this renders a stored choice and nothing more. A client with no
// choice recorded reads as Healthy, matching the backend default.

export const CLIENT_HEALTH = ["Healthy", "Warning", "Critical"]
export const DEFAULT_CLIENT_HEALTH = "Healthy"

// Straight from the handoff's Design Tokens table.
const STYLES = {
  Healthy:  { color: "#25A55F", bg: "#EDF8F1" },
  Warning:  { color: "#E0920A", bg: "#FDF6EC" },
  Critical: { color: "#E5484D", bg: "#FEF1F1" },
}

export function healthStyle(health) {
  return STYLES[health] ?? STYLES[DEFAULT_CLIENT_HEALTH]
}

/**
 * @param {string}  health   one of CLIENT_HEALTH; anything else falls back to the default
 * @param {boolean} withDot  leading 6px dot — the design uses it on status pills
 *                           and on the Client Detail header, but not in the
 *                           Client Hub table's HEALTH column
 */
export function HealthPill({ health, withDot = true, className = "" }) {
  const value = CLIENT_HEALTH.includes(health) ? health : DEFAULT_CLIENT_HEALTH
  const { color, bg } = healthStyle(value)

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold ${className}`}
      style={{ color, background: bg }}
    >
      {withDot && (
        <span
          className="size-1.5 rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
      )}
      {value}
    </span>
  )
}
