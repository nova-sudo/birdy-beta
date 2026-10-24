import { useEffect, useState } from "react"
import { apiRequest } from "@/lib/api"

export function useReviewPolling({ booting, currentKey }) {
  const [review, setReview] = useState(null)
  const [reviewSettled, setReviewSettled] = useState(false)

  // Review step: poll while the background prep job (kicked off at
  // acceptSync) is still checking sub-accounts, so the table opens with real
  // 90/30-day activity flags. Gives up after ~100s and shows what's known.
  useEffect(() => {
    if (booting || currentKey !== "sub_accounts_review") return
    let cancelled = false
    let ticks = 0
    let timer
    const tick = async () => {
      ticks += 1
      let settled = true
      try {
        const res = await apiRequest("/api/onboarding/subaccounts-review")
        if (cancelled) return
        if (!res.ok) throw new Error("review")
        const d = await res.json()
        setReview(d)
        settled = d?.prep?.status !== "running"
      } catch {
        if (!cancelled) {
          setReview((prev) => prev || { accounts: [], fb_accounts: [], prep: {}, stats: {} })
        }
      }
      if (cancelled) return
      if (!settled && ticks < 25) {
        timer = setTimeout(tick, 4000)
      } else {
        setReviewSettled(true)
      }
    }
    setReviewSettled(false)
    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [booting, currentKey])

  return { review, reviewSettled }
}
