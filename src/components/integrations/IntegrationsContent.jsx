"use client"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { ghlIcon, metaIcon, hpIcon } from "@/lib/icons"
import Image from "next/image"

function formatDate(dateStr) {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleString()
}

function IntegrationCard({ name, icon, connected, details, lastRefresh, refreshStatus, onRefresh }) {
  const isRefreshing = refreshStatus === "running"

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={icon} alt={name} width={32} height={32} className="rounded" />
            <CardTitle className="text-lg">{name}</CardTitle>
          </div>
          <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
            {connected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <>
            <div className="space-y-1.5 text-sm">
              {details.map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Refresh</span>
                <span className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(lastRefresh)}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              disabled={isRefreshing}
              onClick={onRefresh}
            >
              {isRefreshing ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Invalidate & Refresh
                </>
              )}
            </Button>

            {refreshStatus === "complete" && (
              <p className="text-xs text-green-600 flex items-center gap-1 justify-center">
                <CheckCircle className="h-3 w-3" /> Refresh completed
              </p>
            )}
            {refreshStatus === "error" && (
              <p className="text-xs text-red-600 flex items-center gap-1 justify-center">
                <XCircle className="h-3 w-3" /> Refresh failed
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This integration is not connected for this client group.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function IntegrationsContent({ group, onRefreshComplete }) {
  const [refreshStatus, setRefreshStatus] = useState({ meta: "idle", ghl: "idle" })
  const pollingRef = useRef(null)

  // Poll refresh status while any integration is running
  useEffect(() => {
    const isRunning = refreshStatus.meta === "running" || refreshStatus.ghl === "running"

    if (isRunning && group?.id) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await apiRequest(`/api/client-groups/${group.id}/refresh-status`)
          if (!res.ok) return
          const data = await res.json()

          setRefreshStatus(prev => {
            const updated = {
              meta: data.meta_refresh_status || "idle",
              ghl: data.ghl_refresh_status || "idle",
            }

            // If something just finished, notify
            if (prev.meta === "running" && updated.meta === "complete") {
              toast.success("Meta data refresh complete")
              onRefreshComplete?.()
            }
            if (prev.ghl === "running" && updated.ghl === "complete") {
              toast.success("GHL data refresh complete")
              onRefreshComplete?.()
            }
            if (prev.meta === "running" && updated.meta === "error") {
              toast.error("Meta data refresh failed")
            }
            if (prev.ghl === "running" && updated.ghl === "error") {
              toast.error("GHL data refresh failed")
            }

            return updated
          })
        } catch {
          // Silently retry on next interval
        }
      }, 5000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [refreshStatus.meta, refreshStatus.ghl, group?.id, onRefreshComplete])

  const handleRefresh = async (integration) => {
    try {
      const res = await apiRequest(`/api/client-groups/${group.id}/refresh/${integration}`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.detail || "Failed to start refresh")
        return
      }
      setRefreshStatus(prev => ({ ...prev, [integration]: "running" }))
      toast.info(`${integration === "meta" ? "Meta" : "GHL"} refresh started — this may take a few minutes`)
    } catch {
      toast.error("Failed to start refresh")
    }
  }

  if (!group) return null

  const metaConnected = !!group.meta_ad_account_id
  const ghlConnected = !!group.ghl_location_id
  const hpConnected = !!(group.hotprospector && Object.keys(group.hotprospector).length > 0)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <IntegrationCard
        name="GoHighLevel"
        icon={ghlIcon}
        connected={ghlConnected}
        details={[
          { label: "Location", value: group.gohighlevel?.name || "—" },
          { label: "Location ID", value: group.ghl_location_id || "—" },
        ]}
        lastRefresh={group.last_ghl_refresh}
        refreshStatus={refreshStatus.ghl}
        onRefresh={() => handleRefresh("ghl")}
      />

      <IntegrationCard
        name="Meta Ads"
        icon={metaIcon}
        connected={metaConnected}
        details={[
          { label: "Account", value: group.facebook?.name || "—" },
          { label: "Account ID", value: group.facebook?.ad_account_id || group.meta_ad_account_id || "—" },
          { label: "Currency", value: group.facebook?.currency || group.ad_account_currency || "—" },
        ]}
        lastRefresh={group.last_meta_refresh}
        refreshStatus={refreshStatus.meta}
        onRefresh={() => handleRefresh("meta")}
      />

      <IntegrationCard
        name="HotProspector"
        icon={hpIcon}
        connected={hpConnected}
        details={[
          { label: "Group ID", value: group.hotprospector_group_id || "—" },
        ]}
        lastRefresh={group.last_hp_refresh}
        refreshStatus="idle"
        onRefresh={() => toast.info("HotProspector refresh coming soon")}
      />
    </div>
  )
}
