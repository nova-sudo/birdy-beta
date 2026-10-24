import { useState, useEffect } from "react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"

// Billing tab state: the plan status, the Whop portal link and cancelling or
// reactivating the subscription.
export function useBilling() {
  const [billingStatus, setBillingStatus] = useState(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [subscriptionBusy, setSubscriptionBusy] = useState(false)

  useEffect(() => {
    apiRequest("/api/billing/status")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setBillingStatus(data) })
      .catch(() => {})
  }, [])

  // Cancelling and un-cancelling happen in place now — Whop's API supports
  // both, so the only thing still worth a trip to its portal is a plan change
  // or a card update. Both refetch the billing status rather than patching it
  // locally, so what the page shows is what the server will report on reload.
  const mutateSubscription = async (endpoint, successMessage) => {
    setSubscriptionBusy(true)
    try {
      const res = await apiRequest(endpoint, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail ?? "Something went wrong. Please try again.")
      const refreshed = await apiRequest("/api/billing/status")
      if (refreshed.ok) setBillingStatus(await refreshed.json())
      toast.success(successMessage)
    } catch (err) {
      toast.error("Subscription", { description: err.message })
    } finally {
      setSubscriptionBusy(false)
    }
  }

  const handleCancelSubscription = () =>
    mutateSubscription(
      "/api/billing/cancel",
      "Your subscription will end when the current period does."
    )

  const handleReactivateSubscription = () =>
    mutateSubscription("/api/billing/reactivate", "Your subscription will keep running.")

  const handlePortal = async () => {
    setLoadingPortal(true)
    try {
      const res = await apiRequest("/api/billing/portal-url")
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Failed to open billing portal")
      if (data.portal_url) window.open(data.portal_url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error("Billing Portal Error", { description: err.message })
    } finally {
      setLoadingPortal(false)
    }
  }

  return {
    billingStatus,
    loadingPortal,
    subscriptionBusy,
    handlePortal,
    handleCancelSubscription,
    handleReactivateSubscription,
  }
}
