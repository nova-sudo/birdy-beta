"use client"

import useSWR, { mutate as globalMutate } from "swr"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"

/** A list URL for the filters; unset filters are left out. */
function listKey({ status, clientGroupId } = {}) {
  const qs = new URLSearchParams()
  if (status) qs.set("status", status)
  if (clientGroupId) qs.set("client_group_id", clientGroupId)
  const s = qs.toString()
  return s ? `${queryKeys.creatives()}?${s}` : queryKeys.creatives()
}

async function testsFetcher(endpoint) {
  const data = await fetcher(endpoint)
  return Array.isArray(data?.items) ? data.items : []
}

/** Creative tests, each with its ads. @returns {{ tests: object[], error, isLoading, mutate }} */
export function useCreativeTests(filters) {
  const { data, error, isLoading, mutate } = useSWR(listKey(filters), testsFetcher)
  return { tests: data ?? [], error, isLoading, mutate }
}

/** One test with its ads and `days` ({meta_ad_id: day rows}). @returns {{ test: object|null, error, isLoading, mutate }} */
export function useCreativeTest(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.creative(id) : null, fetcher)
  return { test: data ?? null, error, isLoading, mutate }
}

/** Sends a request and returns its JSON; a failure throws an Error with `status` and `detail`. */
async function send(endpoint, method, body) {
  const res = await apiRequest(endpoint, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // Empty or non-JSON body.
  }
  if (!res.ok) {
    const detail = data?.detail ?? data?.error ?? null
    const err = new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`)
    err.status = res.status
    err.detail = detail
    throw err
  }
  return data
}

const isCreativesKey = (key) => typeof key === "string" && key.startsWith(queryKeys.creatives())

/** Re-reads every cached list (any filter) and, with an id, that test. */
async function revalidate(id) {
  await globalMutate(isCreativesKey)
  if (id) await globalMutate(queryKeys.creative(id))
}

async function mutating(id, endpoint, method, body) {
  const data = await send(endpoint, method, body)
  await revalidate(id ?? data?.id)
  return data
}

/** `{name, origin, creative, targets?}`. */
export function createCreativeTest(body) {
  return mutating(null, queryKeys.creatives(), "POST", body)
}

export function updateCreativeTest(id, body) {
  return mutating(id, queryKeys.creative(id), "PATCH", body)
}

/** Archives the test; its Meta ads stay. */
export function archiveCreativeTest(id) {
  return mutating(id, `${queryKeys.creative(id)}/archive`, "POST")
}

export function refreshCreativeTest(id) {
  return mutating(id, `${queryKeys.creative(id)}/refresh`, "POST")
}

/** Attaches an existing Meta ad to the test. 409 when it cannot be adopted. */
export function adoptCreativeAd(id, adId) {
  return mutating(id, `${queryKeys.creative(id)}/adopt`, "POST", { ad_id: adId })
}

/** Cached ads matching `q` across the agency's accounts (last 30 days, best spend first). */
export function searchCreativeAds(q = "", { adAccountId, limit = 30 } = {}) {
  const qs = new URLSearchParams({ q, limit: String(limit) })
  if (adAccountId) qs.set("ad_account_id", adAccountId)
  return send(`${queryKeys.creatives()}/ads/search?${qs}`, "GET")
}

// Stable empty list: a fresh [] per render would re-trigger effects that depend on it.
const EMPTY = Object.freeze([])

/** Agency ad accounts, one row per account with every client name. @returns {{ accounts: object[], error, isLoading }} */
export function useCreativeAdAccounts() {
  const { data, error, isLoading } = useSWR(`${queryKeys.creatives()}/ad-accounts`, fetcher)
  return { accounts: Array.isArray(data) ? data : EMPTY, error, isLoading }
}

/** One account's ad sets with `compatible`/`reason` for the destination. Keyed per account; null `act` skips. */
export function useCreativeAdsets(act, destination) {
  const key = act && destination ? `${queryKeys.creatives()}/ad-accounts/${act}/adsets?destination=${destination}` : null
  const { data, error, isLoading } = useSWR(key, fetcher)
  return { adsets: Array.isArray(data) ? data : EMPTY, error, isLoading }
}

/** One account's promote Pages. */
export function useCreativePages(act) {
  const { data, error, isLoading } = useSWR(act ? `${queryKeys.creatives()}/ad-accounts/${act}/pages` : null, fetcher)
  return { pages: Array.isArray(data) ? data : EMPTY, error, isLoading }
}

/** A Page's lead forms. */
export function useCreativeLeadForms(pageId) {
  const { data, error, isLoading } = useSWR(pageId ? `${queryKeys.creatives()}/pages/${pageId}/lead-forms` : null, fetcher)
  return { forms: Array.isArray(data) ? data : EMPTY, error, isLoading }
}
