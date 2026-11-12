// The six steps of a custom agent's chat setup, in the order Birdy asks them.
// The server marks each one done in `agent.training.steps` (the setup tools and the matching PATCHes).

export const SETUP_STEPS = [
  { key: "purpose", label: "What it does" },
  { key: "playbook", label: "Its playbook" },
  { key: "clients", label: "Clients" },
  { key: "permissions", label: "What it can change" },
  { key: "schedule", label: "Report time" },
  { key: "slack", label: "Slack" },
]

/** The step Birdy is asking now: the first one not done, or null once all are. */
export function currentStep(steps) {
  const done = steps ?? {}
  return SETUP_STEPS.find((s) => !done[s.key])?.key ?? null
}

/** How many of the six steps are done. */
export function stepsDone(steps) {
  const done = steps ?? {}
  return SETUP_STEPS.filter((s) => done[s.key]).length
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

const PERMISSION_LABELS = [
  ["ads", "ads"],
  ["adsets", "ad sets"],
  ["campaigns", "campaigns"],
  ["budgets", "budgets"],
]

/** "a", "a and b", "a, b and c". */
function listOf(items) {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/**
 * One line that sums up a step's answer for the rail, or null when there's nothing to say.
 * `rules` (the agent's playbook) and `channels` (the user's Slack channels) come from their own
 * routes, since the agent document carries neither the rule count nor the channel name.
 */
export function stepAnswer(agent, key, { rules, channels } = {}) {
  const scope = agent?.scope ?? {}
  switch (key) {
    case "purpose":
      return agent?.description?.trim() || null
    case "playbook": {
      if (!Array.isArray(rules)) return null
      return count(rules.filter((r) => r.enabled !== false).length, "rule", "rules")
    }
    case "clients": {
      const n = scope.client_group_ids?.length ?? 0
      return n ? count(n, "client", "clients") : null
    }
    case "permissions": {
      if (!agent?.permissions) return null
      const allowed = PERMISSION_LABELS.filter(([k]) => agent.permissions[k]).map(([, label]) => label)
      return allowed.length ? `Can change ${listOf(allowed)}` : "Flags only, changes nothing"
    }
    case "schedule": {
      const time = scope.schedule?.time
      return time ? [time, scope.schedule?.tz].filter(Boolean).join(" ") : null
    }
    case "slack": {
      const id = scope.slack_channel_id
      if (!id) return null
      const name = channels?.find((c) => c.id === id)?.name
      return name ? `#${name}` : "Channel picked"
    }
    default:
      return null
  }
}
