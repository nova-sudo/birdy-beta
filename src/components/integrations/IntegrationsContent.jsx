"use client"
import { useState, useEffect, useRef } from "react"
import { Badge, Button, ProgressBar, Spinner, Surface } from "@/components/ds"
import { Stagger, StaggerItem } from "@/components/motion"
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { ghlIcon, metaIcon, hpIcon } from "@/lib/icons"
import Image from "next/image"
import { MetaCampaignsDialog } from "@/components/clients/MetaCampaignsDialog"
import { campaignsSummary, unassignedText } from "@/lib/meta-scope"

function formatDate(dateStr) {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleString()
}

function RefreshProgress({ progress }) {
  if (!progress || progress.status === "complete") return null

  const { presets_done = 0, presets_total = 13, presets_failed = 0, leads_status, current_step, attempt, max_attempts, next_retry_at } = progress
  const pct = presets_total > 0 ? Math.round((presets_done / presets_total) * 100) : 0

  const stepLabel = {
    presets: `Fetching presets (${presets_done}/${presets_total})`,
    leads: "Fetching leads...",
    lead_counts: "Calculating lead counts...",
    done: "Finalizing...",
  }[current_step] || "Processing..."

  return (
    <div className="space-y-2 mt-2">
      <ProgressBar tone="primary" label="Refresh progress" value={current_step === "leads" ? 85 : current_step === "lead_counts" ? 95 : pct} />
      <p className="text-xs text-muted-foreground">{stepLabel}</p>
      {presets_failed > 0 && (
        <p className="text-xs text-warning-ink">{presets_failed} preset(s) will retry</p>
      )}
      {progress.status === "partial" && next_retry_at && (
        <p className="text-xs text-info-ink">
          Retrying automatically (attempt {attempt}/{max_attempts})
        </p>
      )}
    </div>
  )
}

// A link-styled action inside a details value ("· Edit", "· Assign").
function InlineAction({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

// `value` may be text or a node; `extra` renders under the details rows.
function IntegrationCard({ name, icon, connected, details, extra, lastRefresh, refreshStatus, refreshProgress, refreshError, onRefresh }) {
  const isRefreshing = refreshStatus === "running"

  return (
    <Surface className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src={icon} alt={name} width={32} height={32} className="rounded-control" />
          <h3 className="text-lg font-semibold leading-tight text-foreground">{name}</h3>
        </div>
        <Badge tone={connected ? "success" : "neutral"}>
          {connected ? "Connected" : "Not Connected"}
        </Badge>
      </div>
      <div className="space-y-3">
        {connected ? (
          <>
            <div className="space-y-1.5 text-sm">
              {details.map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
              {extra}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Refresh</span>
                <span className="font-medium flex items-center gap-1">
                  {isRefreshing ? <Spinner size={12} /> : <Clock className="h-3 w-3" />}
                  {isRefreshing ? "Refreshing…" : formatDate(lastRefresh)}
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
                  <Spinner />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw />
                  Invalidate & Refresh
                </>
              )}
            </Button>

            {isRefreshing && refreshProgress && (
              <RefreshProgress progress={refreshProgress} />
            )}

            {refreshStatus === "complete" && (
              <p className="text-xs text-success-ink flex items-center gap-1 justify-center">
                <CheckCircle className="h-3 w-3" /> Refresh completed
              </p>
            )}
            {refreshStatus === "error" && (
              <div className="text-center">
                <p className="text-xs text-danger-ink flex items-center gap-1 justify-center">
                  <XCircle className="h-3 w-3" /> Refresh failed
                </p>
                {refreshError && (
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-full" title={refreshError}>
                    {refreshError}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This integration is not connected for this client group.
          </p>
        )}
      </div>
    </Surface>
  )
}

export default function IntegrationsContent({ group, onRefreshComplete, onCampaignsSaved }) {
  const [campaignsOpen, setCampaignsOpen] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState({ meta: "idle", ghl: "idle" })
  const [metaProgress, setMetaProgress] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [ghlError, setGhlError] = useState(null)
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

          // Capture granular progress
          if (data.meta_refresh_progress) {
            setMetaProgress(data.meta_refresh_progress)
          }
          if (data.meta_refresh_error) setMetaError(data.meta_refresh_error)
          if (data.ghl_refresh_error) setGhlError(data.ghl_refresh_error)

          setRefreshStatus(prev => {
            const metaStatus = data.meta_refresh_status || "idle"
            const ghlStatus = data.ghl_refresh_status || "idle"

            // Treat "partial" as done for polling purposes — the scheduler
            // handles retries automatically, no need to keep polling.
            const metaDone = metaStatus !== "running"
            const ghlDone = ghlStatus !== "running"

            // Notify on transitions
            if (prev.meta === "running" && metaDone) {
              if (metaStatus === "complete") {
                toast.success("Meta data refresh complete")
                onRefreshComplete?.()
              } else if (metaStatus === "error" || metaStatus === "failed") {
                toast.error(data.meta_refresh_error || "Meta data refresh failed")
              } else if (metaStatus === "partial") {
                toast.info("Meta refresh partially complete — retrying failed steps automatically")
                onRefreshComplete?.()
              }
              setMetaProgress(null)
            }
            if (prev.ghl === "running" && ghlDone) {
              if (ghlStatus === "complete") {
                toast.success("GHL data refresh complete")
                onRefreshComplete?.()
              } else if (ghlStatus === "error") {
                toast.error(data.ghl_refresh_error || "GHL data refresh failed")
              }
            }

            return {
              meta: metaDone ? metaStatus : "running",
              ghl: ghlDone ? ghlStatus : "running",
            }
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

  // Which campaigns of the ad account this client owns. Older payloads have
  // no meta_scope; they read as "All campaigns", which is what null means.
  const metaScope = group.meta_scope ?? null
  const unassigned = unassignedText(metaScope)
  const openCampaigns = () => setCampaignsOpen(true)

  return (
    <>
    <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StaggerItem>
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
      </StaggerItem>

      <StaggerItem>
        <IntegrationCard
          name="Meta Ads"
          icon={metaIcon}
          connected={metaConnected}
          details={[
            { 
              label: "Account", 
              value: (group.facebook?.name && group.facebook.name !== "Unknown Ad Account")
                ? group.facebook.name 
                : group.name
            },
            { label: "Account ID", value: group.facebook?.ad_account_id || group.meta_ad_account_id || "—" },
            { label: "Currency", value: group.facebook?.currency || group.ad_account_currency || "—" },
            {
              label: "Campaigns",
              value: (
                <>
                  {campaignsSummary(metaScope)} · <InlineAction onClick={openCampaigns}>Edit</InlineAction>
                </>
              ),
            },
          ]}
          extra={
            unassigned && (
              <p className="rounded-control bg-warning-soft px-2.5 py-1.5 text-xs text-warning-ink">
                {unassigned} · <InlineAction onClick={openCampaigns}>Assign</InlineAction>
              </p>
            )
          }
          lastRefresh={group.last_meta_refresh}
          refreshStatus={refreshStatus.meta}
          refreshProgress={metaProgress}
          refreshError={metaError}
          onRefresh={() => handleRefresh("meta")}
        />
      </StaggerItem>

      <StaggerItem>
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
      </StaggerItem>
    </Stagger>
      {metaConnected && (
        <MetaCampaignsDialog
          open={campaignsOpen}
          onOpenChange={setCampaignsOpen}
          group={group}
          onSaved={() => {
            // The save starts a Meta refresh server-side; poll it like a manual one.
            setRefreshStatus(prev => ({ ...prev, meta: "running" }))
            ;(onCampaignsSaved ?? onRefreshComplete)?.()
          }}
        />
      )}
    </>
  )
}
