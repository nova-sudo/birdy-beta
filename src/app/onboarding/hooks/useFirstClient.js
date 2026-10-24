import { useCallback, useRef, useState } from "react"
import { apiRequest } from "@/lib/api"
import { hasAnyTarget } from "../wizard"

// Creating the first client group and getting the KPI targets onto it (and, when
// they were set as defaults, onto every other client). The group id lives in the
// page because boot restores it; everything that acts on it lives here.
export function useFirstClient({
  firstGroupId,
  setFirstGroupId,
  selectedClient,
  selectedAd,
  clientNameConfirm,
  salesTool,
  currency,
  persistState,
}) {
  const [creationError, setCreationError] = useState(null)
  // idle | creating | done | error. The wizard no longer waits on this: see
  // startFirstClientCreation.
  const [creationState, setCreationState] = useState("idle")
  const pendingTargetsRef = useRef(null)

  const applyTargets = useCallback(
    async (groupId, targets) => {
      try {
        const res = await apiRequest(`/api/client-groups/${groupId}/targets`, {
          method: "PUT",
          body: JSON.stringify(targets),
        })
        // A rejected PUT used to be indistinguishable from a saved one here:
        // nothing read the status, so a payload the server would not accept
        // failed in complete silence and the user reached a client that said
        // it had no targets, having just been told "Targets applied".
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}))
          console.error("Failed to apply targets:", res.status, detail)
        }
      } catch (e) {
        console.error("Failed to apply targets:", e)
      }
    },
    []
  )

  // Creates the first client group. The request blocks server-side on a full
  // GHL history fetch, so it is slow — see startFirstClientCreation, which is
  // what the wizard actually calls and which does not wait for it.
  //
  // The first client group is free (billing_middleware allows a
  // subscription-less user's very first one), so a failure here is a real
  // problem — GHL, network, a 500 — not an expected payment wall, which is why
  // the caller surfaces it rather than swallowing it.
  // `chosenCurrency` is passed in rather than read off state because the
  // client_currency step starts creation in the same handler that sets it, and
  // a state update isn't visible to a callback created in that render.
  const createFirstClient = useCallback(async (chosenCurrency) => {
    if (firstGroupId) return true
    if (!selectedClient) return false
    setCreationError(null)
    const groupCurrency = chosenCurrency || currency || selectedAd?.currency || null
    const clientName = clientNameConfirm.trim() || selectedClient.name
    const payload = {
      name: clientName,
      ghl_location_id: selectedClient.id,
      meta_ad_account_id: selectedAd?.id || null,
      hotprospector_group_id: null,
      // The user's explicit answer on client_currency wins over the ad
      // account's own currency: they may report in a different one than Meta
      // bills them in, and the whole point of asking was to stop guessing.
      ad_account_currency: groupCurrency,
      // "none" is a real, persisted answer — "I don't currently call my
      // leads" — not a missing value. The Sales Hub and every call-centre
      // metric read it to render "not available" instead of a misleading 0.
      call_log_provider:
        salesTool === "hp" ? "hotprospector" : salesTool === "none" ? "none" : "ghl",
      notes: "",
    }
    try {
      const res = await apiRequest("/api/client-groups", { method: "POST", body: JSON.stringify(payload) })
      const d = await res.json().catch(() => ({}))
      let groupId = d?.client_group?.id || null
      if (!res.ok && res.status !== 409) {
        const detail = d?.detail
        setCreationError(
          typeof detail === "string" ? detail : detail?.message || "Client creation failed"
        )
        return false
      }
      if (res.status === 409 || !groupId) {
        // Duplicate (e.g. wizard re-run) — find the existing group instead.
        try {
          const listRes = await apiRequest("/api/client-groups?date_preset=today&include_daily=false")
          if (listRes.ok) {
            const list = await listRes.json()
            const match = (list?.client_groups || []).find(
              (g) => g.ghl_location_id === selectedClient.id
            )
            if (match) groupId = match.id
          }
        } catch { /* ignore — targets fall back to onboarding state */ }
      }
      if (!groupId) {
        setCreationError("Client creation failed — please try again.")
        return false
      }
      setFirstGroupId(groupId)
      persistState({ data: { first_client: {
        group_id: groupId,
        name: clientName,
        ghl_location_id: selectedClient.id,
        meta_ad_account_id: selectedAd?.id || null,
        currency: groupCurrency,
      } } })
      if (pendingTargetsRef.current) {
        applyTargets(groupId, pendingTargetsRef.current)
        pendingTargetsRef.current = null
      }
      return true
    } catch (e) {
      console.error("Client creation failed:", e)
      setCreationError("Client creation failed — check your connection and try again.")
      return false
    }
  }, [selectedClient, selectedAd, clientNameConfirm, salesTool, currency, firstGroupId, persistState, applyTargets])

  // Fire-and-forget wrapper. The creation request blocks on a full GHL history
  // fetch and routinely takes tens of seconds; making the user watch a
  // "Creating client…" spinner for that long, before they have seen a single
  // thing Birdy does, was the worst dead spot in the wizard.
  //
  // Nothing between here and the completion step needs the group id: the KPI
  // step already parks its targets in pendingTargetsRef and createFirstClient
  // applies them the moment the id lands, and the sync badge already has a
  // branch for "creation still running". So the wizard carries on and the
  // result is reported asynchronously — as a badge while it runs, and as a
  // blocking error on the completion step if it fails, which is the last
  // point at which we can still do something about it.
  const startFirstClientCreation = useCallback((chosenCurrency) => {
    if (firstGroupId || creationState === "creating") return
    setCreationState("creating")
    setCreationError(null)
    createFirstClient(chosenCurrency).then(
      (ok) => setCreationState(ok ? "done" : "error"),
      () => setCreationState("error")
    )
  }, [createFirstClient, firstGroupId, creationState])

  // The first client's group id, found wherever it actually is. This is also
  // where "Take a look at Birdy" gets its destination — the point of the
  // wizard is the client they just set up, not the hub.
  //
  // firstGroupId is the in-memory answer, but it is not a reliable one on its
  // own: it is set when the background creation resolves, and the OAuth hops,
  // a Whop checkout redirect and a plain refresh all wipe React state between
  // then and here. boot() restores it, so usually it is there — but "usually"
  // is how someone ends up on the hub wondering where their client went. So
  // the server-side copy is the fallback, and the group list after that.
  const resolveFirstGroupId = useCallback(async () => {
    if (firstGroupId) return firstGroupId

    try {
      const res = await apiRequest("/api/onboarding/status")
      if (res.ok) {
        const state = await res.json()
        const saved = state?.data?.first_client?.group_id
        if (saved) return saved
      }
    } catch { /* fall through to the list */ }

    // Last resort: the group exists, we just never learned its id — creation
    // succeeded while the tab was away, or the persist that followed it failed.
    // Matching on the GHL location is exact, so this is a lookup, not a guess.
    if (selectedClient?.id) {
      try {
        const res = await apiRequest("/api/client-groups?date_preset=today&include_daily=false")
        if (res.ok) {
          const list = await res.json()
          const match = (list?.client_groups || []).find(
            (g) => g.ghl_location_id === selectedClient.id
          )
          if (match?.id) return match.id
        }
      } catch { /* no id to be had */ }
    }

    return null
  }, [firstGroupId, selectedClient])

  /**
   * Send any targets still waiting on a client group, and report which group
   * they went to. Safe to call twice: the payload is taken out of the ref
   * before the request, so a second caller finds nothing left to send.
   */
  const flushPendingTargets = useCallback(async () => {
    const groupId = await resolveFirstGroupId()
    if (!groupId) return null
    setFirstGroupId(groupId)
    const payload = pendingTargetsRef.current
    if (payload) {
      pendingTargetsRef.current = null
      await applyTargets(groupId, payload)
    }
    return groupId
  }, [resolveFirstGroupId, applyTargets])

  // "Yes, set as default" is a promise about every client, and only the first
  // one was ever getting targets — import-subaccounts carries a name, an ad
  // account, a currency and a status, and nothing else. So a user who set
  // targets for everyone still arrived at a hub full of clients each reporting
  // "no monthly targets set for this client yet".
  //
  // Every client the account has, not only the ones this run imported: a
  // second pass through the wizard is exactly when someone notices the earlier
  // batch has no targets on it, and "all clients" has to mean all of them or
  // it just moves the same complaint to a different set.
  //
  // Called from finish(), where the first client and the freshly imported ones
  // both already exist, so one sweep covers the lot.
  const applyTargetsToAllClients = useCallback(
    async (targets) => {
      try {
        const res = await apiRequest("/api/client-groups?date_preset=today&include_daily=false")
        if (!res.ok) return
        const list = await res.json()
        // Only the ones with nothing set. A client someone has already given a
        // number to has been thought about, and these are defaults — a default
        // that overwrites a deliberate answer is not a default. The endpoint
        // merges per field, so without this a wizard run would replace exactly
        // the fields it has an opinion on and leave the rest, which is the
        // most confusing half of both worlds.
        const ids = (list?.client_groups || [])
          .filter((g) => g.id && !hasAnyTarget(g.targets))
          .map((g) => g.id)
        // save_as_default stays off here: the account-level default was already
        // written by the first client's PUT, and re-sending it once per client
        // would just store the same thing again for every one of them.
        await Promise.all(ids.map((id) => applyTargets(id, targets)))
      } catch (e) {
        console.error("Failed to apply targets to all clients:", e)
      }
    },
    [applyTargets]
  )

  return {
    creationState,
    creationError,
    pendingTargetsRef,
    applyTargets,
    startFirstClientCreation,
    flushPendingTargets,
    applyTargetsToAllClients,
  }
}
