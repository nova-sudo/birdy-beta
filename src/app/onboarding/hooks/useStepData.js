import { useEffect, useState } from "react"
import { apiRequest } from "@/lib/api"

// The lists each picker step loads lazily, the first time the wizard lands on it
// with the integration behind it connected.
export function useStepData({ booting, currentKey, ghlStatus, metaStatus, slackStatus }) {
  const [locations, setLocations] = useState(null)
  const [locationsError, setLocationsError] = useState(null)
  const [adAccounts, setAdAccounts] = useState(null)
  const [adError, setAdError] = useState(null)
  const [channels, setChannels] = useState(null)
  // Why the channel list is empty, when the reason was ours rather than the
  // workspace's. Null means "no failure" — an empty list is then genuinely an
  // empty list.
  const [channelsError, setChannelsError] = useState(null)

  useEffect(() => {
    if (booting) return
    if (currentKey === "client_picker" && locations === null && ghlStatus === "success") {
      apiRequest("/api/subaccount/locations")
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json())?.detail || `status ${res.status}`)
          const d = await res.json()
          setLocations(d.locations || [])
        })
        .catch((e) => setLocationsError(String(e.message || e)))
    }
    if (currentKey === "meta_ad_picker" && adAccounts === null && metaStatus === "success") {
      apiRequest("/api/facebook/adaccounts")
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json())?.detail || `status ${res.status}`)
          const d = await res.json()
          setAdAccounts(d?.data?.data || [])
        })
        .catch((e) => setAdError(String(e.message || e)))
    }
    if (currentKey === "slack_channel" && channels === null && slackStatus === "success") {
      // A failed lookup and a workspace with no channels are different
      // answers and used to arrive here as the same one — the catch turned
      // any error into an empty list, so the step told people to "invite the
      // Birdy app to a channel" when what the server actually said was that
      // it could not list channels at all and Slack needed reconnecting.
      // They would go and do the thing it suggested, and it would still be
      // empty.
      setChannelsError(null)
      apiRequest("/api/integrations/slack/channels")
        .then(async (res) => {
          const d = await res.json().catch(() => ({}))
          if (!res.ok) {
            // 409 is the server saying Slack refused the token or withheld a
            // scope: retrying cannot fix either, so the step offers the hop
            // that can instead of a button that will fail again.
            const err = new Error(d.detail || "Couldn't load your Slack channels.")
            err.needsReconnect = res.status === 409
            throw err
          }
          setChannels(d.channels || [])
        })
        .catch((e) => {
          setChannelsError({
            message: String(e.message || e),
            needsReconnect: Boolean(e.needsReconnect),
          })
          setChannels([])
        })
    }
  }, [booting, currentKey, locations, adAccounts, channels, ghlStatus, metaStatus, slackStatus])

  return { locations, locationsError, adAccounts, adError, channels, setChannels, channelsError }
}
