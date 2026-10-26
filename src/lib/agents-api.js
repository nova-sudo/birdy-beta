"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

/** SWR key for the agent list. */
export const AGENTS_KEY = "/api/agents"

/**
 * The agents this agency has set up. `/api/agents` lands with the backend work,
 * so a 404 (or any network error) reads as "none yet" rather than an error.
 */
async function agentsFetcher(endpoint) {
  try {
    const data = await fetcher(endpoint)
    if (Array.isArray(data)) return data
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

/** @returns {{ agents: object[], isLoading: boolean, mutate: Function }} */
export function useAgents() {
  const { data, isLoading, mutate } = useSWR(AGENTS_KEY, agentsFetcher)
  return { agents: data ?? [], isLoading, mutate }
}

/** Number of open agent work items, for the nav badge. `null` until agents ship. */
export function useAgentWorkCount() {
  return null
}
