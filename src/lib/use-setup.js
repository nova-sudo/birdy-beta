"use client"

import { useCallback, useMemo, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { DEFAULT_DATE_PRESET } from "./constants"
import { queryKeys } from "./query-keys"
import { deriveSteps } from "./setup-steps"
import { useClientGroups } from "./useClientGroups"

export const SETUP_KEYS = {
  onboarding: "/api/onboarding/status",
  status: "/api/status",
  hp: "/api/hotprospector/status",
  slack: queryKeys.slackStatus(),
  billing: "/api/billing/status",
}

/** A request that has answered, either way. A failed one reads as "not known", which offers the step again. */
const settled = (swr) => swr.data !== undefined || swr.error !== undefined

/**
 * Setup's state, worked out from the account (lib/setup-steps).
 *
 * @param {object} [opts]
 * @param {boolean} [opts.full] read every connection even when onboarding is
 *   finished. The rail passes false off /welcome: a finished account then costs
 *   one request, and the ring stays hidden.
 */
export function useSetup({ full = true } = {}) {
  const { mutate } = useSWRConfig()
  const onboarding = useSWR(SETUP_KEYS.onboarding)
  // Off /welcome a finished account is read in full only while it still needs a plan.
  const wanted = full || (onboarding.data !== undefined && (!onboarding.data?.completed || onboarding.data?.needs_plan === true))
  const status = useSWR(wanted ? SETUP_KEYS.status : null)
  const hp = useSWR(wanted ? SETUP_KEYS.hp : null)
  const slack = useSWR(wanted ? SETUP_KEYS.slack : null)
  const billing = useSWR(wanted ? SETUP_KEYS.billing : null)
  const groups = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })

  // The client list as last loaded. Re-reading the clients (after targets are
  // saved, or a client is added) clears the list while it reloads: without
  // this, setup went back to its loading state, the chat unmounted and came
  // back at the top, which read as the page reloading after every answer. The
  // last list stays on screen until the new one lands.
  const [held, setHeld] = useState(null)
  if (!groups.loading && groups.clientGroups !== held) setHeld(groups.clientGroups)
  const reloading = groups.loading && held !== null
  const clients = reloading ? held : groups.clientGroups

  const ready = settled(onboarding) && (!wanted || (settled(status) && settled(hp) && settled(slack) && settled(billing) && (!groups.loading || reloading || groups.error)))

  const facts = useMemo(
    () => ({
      onboarding: onboarding.data ?? null,
      status: status.data ?? null,
      hp: hp.data ?? null,
      slack: slack.data ?? null,
      clients,
      billing: billing.data ?? null,
    }),
    [onboarding.data, status.data, hp.data, slack.data, clients, billing.data],
  )
  const steps = useMemo(() => deriveSteps(facts), [facts])

  /** Ask again for one fact ("onboarding", "status", "hp", "slack", "billing", "clients"), or all of them. Settles once they're back. */
  const refresh = useCallback(
    (which) => {
      const waits = []
      if (!which || which === "clients") waits.push(groups.invalidate())
      for (const [name, key] of Object.entries(SETUP_KEYS)) {
        if (!which || which === name) waits.push(mutate(key))
      }
      return Promise.allSettled(waits)
    },
    [mutate, groups],
  )

  return {
    facts,
    steps,
    ready,
    /** Onboarding's own status failed to load: nothing else can be trusted. */
    failed: Boolean(onboarding.error) && onboarding.data === undefined,
    completed: Boolean(onboarding.data?.completed),
    wanted,
    refresh,
  }
}
