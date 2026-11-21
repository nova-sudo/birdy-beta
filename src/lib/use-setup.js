"use client"

import { useCallback, useMemo } from "react"
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
  const wanted = full || (onboarding.data !== undefined && !onboarding.data?.completed)
  const status = useSWR(wanted ? SETUP_KEYS.status : null)
  const hp = useSWR(wanted ? SETUP_KEYS.hp : null)
  const slack = useSWR(wanted ? SETUP_KEYS.slack : null)
  const groups = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })

  const ready = settled(onboarding) && (!wanted || (settled(status) && settled(hp) && settled(slack) && (!groups.loading || groups.error)))

  const facts = useMemo(
    () => ({
      onboarding: onboarding.data ?? null,
      status: status.data ?? null,
      hp: hp.data ?? null,
      slack: slack.data ?? null,
      clients: groups.clientGroups,
    }),
    [onboarding.data, status.data, hp.data, slack.data, groups.clientGroups],
  )
  const steps = useMemo(() => deriveSteps(facts), [facts])

  /** Ask again for one fact ("onboarding", "status", "hp", "slack", "clients"), or all of them. */
  const refresh = useCallback(
    (which) => {
      if (!which || which === "clients") groups.invalidate()
      for (const [name, key] of Object.entries(SETUP_KEYS)) {
        if (!which || which === name) mutate(key)
      }
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
