"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import Cookies from "js-cookie"
import { toast } from "sonner"

const CACHE_KEY = "clientGroups"
const CACHE_DURATION = 60 * 60 * 1000 // 1 hr
const COOKIE_KEY = "clientGroupsMeta"

const fetcher = async (url) => {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch client groups")
  const data = await res.json()
  return data.client_groups || []
}

export function useClientGroups() {
  const [cachedData, setCachedData] = useState(undefined)

  // ✅ Read LOCAL cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return

      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log("✅ ClientGroups local cache loaded")
        setCachedData(data)
      } else {
        localStorage.removeItem(CACHE_KEY)
      }
    } catch (err) {
      console.error("Cache read error", err)
    }
  }, [])

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR(
    "https://birdy-backend.vercel.app/api/client-groups",
    fetcher,
    {
      fallbackData: cachedData,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  // ✅ Save LOCAL cache + COOKIE metadata when data changes
  useEffect(() => {
    if (!data) return

    try {
      // LocalStorage (full data)
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      )

      // 🍪 Cookie (metadata only)
      Cookies.set(
        COOKIE_KEY,
        JSON.stringify({
          count: data.length,
          lastUpdated: Date.now(),
        }),
        {
          expires: 1, // 1 day
          sameSite: "Lax",
          secure: true,
        }
      )

      console.log("💾 ClientGroups cached + cookie updated")
    } catch (err) {
      console.error("Cache write error", err)
    }
  }, [data])

  const refreshClientGroups = async () => {
    try {
      await mutate()
      toast.success("Client groups refreshed")
    } catch {
      toast.error("Failed to refresh client groups")
    }
  }

  return {
    clientGroups: data || [],
    loading: isLoading && !cachedData,
    error: error?.message || "",
    isRefreshing: isValidating,
    refreshClientGroups,
    mutate,
  }
}
