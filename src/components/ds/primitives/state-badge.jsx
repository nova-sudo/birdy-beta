import * as React from "react"

import { Badge } from "./badge"
import { BADGE_STATES } from "./badge-states"

/**
 * A badge for a named state: the state picks the tone, icon and default label.
 *
 * @param {object} props
 * @param {string} props.state  a key of BADGE_STATES ("live", "paused", "failed"...)
 * @param {"sm"|"md"} [props.size="md"]
 */
function StateBadge({ state, children, ...props }) {
  const { tone, icon, label } = BADGE_STATES[state] ?? BADGE_STATES.unknown
  return (
    <Badge data-ds="badge" data-state={state} tone={tone} icon={icon} {...props}>
      {children ?? label}
    </Badge>
  )
}

export { StateBadge }
