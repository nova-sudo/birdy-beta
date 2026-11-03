"use client"

import { useEffect, useRef, useState } from "react"

import { Notice, SearchInput, Skeleton } from "@/components/ds"
import { searchCreativeAds } from "@/lib/creatives-api"

const num = (n, digits = 0) => Number(n).toLocaleString("en", { maximumFractionDigits: digits, minimumFractionDigits: digits })

/**
 * Searchable picker over the agency's cached ads (last 30 days).
 *
 * @param {object} props
 * @param {(ad: object) => void} props.onPick
 */
export function RevivePicker({ onPick }) {
  const [q, setQ] = useState("")
  const [ads, setAds] = useState(null)
  const [error, setError] = useState("")
  const seq = useRef(0)

  useEffect(() => {
    const mine = ++seq.current
    searchCreativeAds(q.trim(), { limit: 30 }).then(
      (rows) => {
        if (mine !== seq.current) return
        setAds(Array.isArray(rows) ? rows : [])
        setError("")
      },
      (e) => {
        if (mine !== seq.current) return
        setError(e?.message || "Could not search your ads.")
        setAds([])
      }
    )
  }, [q])

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={q} onChange={setQ} debounceMs={300} placeholder="Search your ads by name" label="Search ads" />
      {error && <Notice tone="danger">{error}</Notice>}
      {ads === null ? (
        <Skeleton className="h-40 w-full rounded-control" />
      ) : ads.length === 0 && !error ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No ads found. Try another search.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {ads.map((ad) => (
            <li key={ad.ad_id}>
              <button
                type="button"
                onClick={() => onPick(ad)}
                className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                {ad.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.thumbnail} alt="" className="size-12 shrink-0 rounded-control object-cover" />
                ) : (
                  <span className="size-12 shrink-0 rounded-control bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{ad.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[ad.client_name, ad.ad_account_id, ad.status].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  <span className="block">CPL {ad.metrics?.cpl == null ? "—" : num(ad.metrics.cpl, 2)}</span>
                  <span className="block">
                    {num(ad.metrics?.leads ?? 0)} leads · {num(ad.metrics?.spend ?? 0)} spent
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
