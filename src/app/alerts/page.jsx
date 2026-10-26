"use client"

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { BellOff, Plus } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Label,
  PageHeader,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  confirm,
} from "@/components/ds"
import { usePageHeader } from "@/components/page-header"
import { apiRequest } from "@/lib/api"
import { buildMetricPickerOptions } from "@/lib/metric-picker-options"
import { SNOOZE_OPTIONS, EMPTY_FORM } from "@/lib/alert-helpers"
import AlertRuleEditor from "./AlertRuleEditor"
import AlertsList from "./AlertsList"
import { activeGroups } from "@/lib/client-status"


// ── Main page ─────────────────────────────────────────────────────────────────

const EXTENDED_EMPTY_FORM = {
  ...EMPTY_FORM,
  tracking_mode: "total",
}

// useSearchParams opts a route out of static rendering unless what reads it
// sits behind a Suspense boundary — Next needs something to render while the
// params resolve. This page went years without one because nothing here ever
// rendered on the server: ProtectedLayout returned null until it had hydrated,
// so the requirement never came up. Same shape as /settings and /login.
function AlertsPageContent() {
  const [alerts, setAlerts] = useState({ active: [], triggered: [], paused: [], counts: {} })
  const [clientGroups, setClientGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [customMetrics, setCustomMetrics] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [snoozeHours, setSnoozeHours] = useState(24)
  const [evaluating, setEvaluating] = useState(null)
  const [form, setForm] = useState(EXTENDED_EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [dialogMode, setDialogMode] = useState("birdy") // "birdy" | "manual"
  const [birdyChatKey, setBirdyChatKey] = useState(0)
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "triggered")

  // Alerts should only ever target active clients
  const activeClientGroups = useMemo(
    () => activeGroups(clientGroups),
    [clientGroups],
  )

  // Extract unique tags from all client groups for the tag metric picker
  const availableTags = useMemo(() => {
    const tagSet = new Set()
    for (const g of clientGroups) {
      const breakdown = g.gohighlevel?.metrics?.tag_breakdown || g.gohighlevel_cache?.metrics?.tag_breakdown || {}
      for (const tag of Object.keys(breakdown)) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort()
  }, [clientGroups])

  // Build metric options for the MetricPicker (tabs + icons)
  const alertMetricOptions = useMemo(() =>
    buildMetricPickerOptions({ availableTags, customMetrics }),
  [availableTags, customMetrics])

  // ── Data fetching ────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    setLoadFailed(false)
    try {
      const res = await apiRequest("/api/alerts")
      if (!res.ok) throw new Error("Failed to load alerts")
      const data = await res.json()
      setAlerts(data)
    } catch (e) {
      setLoadFailed(true)
      toast.error("Could not load alerts")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchClientGroups = useCallback(async () => {
    try {
      // Only needs names, ids and status to build the target picker — never a
      // trend chart — so it opts out of the 6.38 MB of per-day series.
      const res = await apiRequest("/api/client-groups?include_daily=false")
      if (!res.ok) return
      const data = await res.json()
      setClientGroups(data.client_groups || [])
    } catch { }
  }, [])

  const fetchCustomMetrics = useCallback(async () => {
    try {
      const res = await apiRequest("/api/custom-metrics")
      if (!res.ok) return
      const data = await res.json()
      setCustomMetrics((data.custom_metrics || []).map(m => ({
        id: m.id, name: m.name, formulaParts: m.formula_parts || [],
      })))
    } catch { }
  }, [])

  useEffect(() => {
    fetchAlerts()
    fetchClientGroups()
    fetchCustomMetrics()
  }, [fetchAlerts, fetchClientGroups, fetchCustomMetrics])

  // ── Form helpers ─────────────────────────────────────────────

  // useCallback because the header memo below closes over it, and an unstable
  // dep there republishes the top bar on every render.
  const openCreate = useCallback(() => {
    setEditingAlert(null)
    setForm(EXTENDED_EMPTY_FORM)
    setDialogMode("birdy")
    setBirdyChatKey(k => {
      // Clear the stale session so Birdy always starts fresh
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`birdy_alert_session_${k + 1}`)
      }
      return k + 1
    })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((alert) => {
    const realAlert = alert._virtual || alert._isGroup ? { ...alert } : alert
    setEditingAlert(realAlert)
    setForm({
      name: realAlert.name || "",
      description: realAlert.description || "",
      type: realAlert.type || "warning",
      metric: realAlert.condition?.metric || "lead_count",
      operator: realAlert.condition?.operator || "gt",
      value: String(realAlert.condition?.value ?? "0"),
      period: realAlert.condition?.period || "day",
      target_group_ids: realAlert.target_group_ids || [],
      notification_channels: realAlert.notification_channels || ["in_app"],
      frequency: realAlert.frequency || "daily",
      tracking_mode: realAlert.tracking_mode || "total",
    })
    setDialogMode("manual")
    setDialogOpen(true)
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Alert name is required"); return }
    if (!form.value || isNaN(Number(form.value))) { toast.error("Please enter a valid threshold value"); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        condition: {
          metric: form.metric,
          operator: form.operator,
          value: Number(form.value),
          period: form.period,
        },
        target_group_ids: form.target_group_ids,
        notification_channels: form.notification_channels,
        frequency: form.frequency,
        tracking_mode: form.tracking_mode,
      }

      const url = editingAlert ? `/api/alerts/${editingAlert.id}` : `/api/alerts`
      const method = editingAlert ? "PATCH" : "POST"

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(await res.text())

      toast.success(editingAlert ? "Alert updated" : "Alert created")
      setDialogOpen(false)
      fetchAlerts()
    } catch (e) {
      toast.error("Failed to save alert")
    } finally {
      setSaving(false)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (alert) => {
    const ok = await confirm({
      title: "Delete alert?",
      description: `"${alert.name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
    })
    if (!ok) return
    try {
      const res = await apiRequest(`/api/alerts/${alert.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Alert deleted")
      fetchAlerts()
    } catch {
      toast.error("Failed to delete alert")
    }
  }, [fetchAlerts])

  // Sub-alert delete: calls dismiss-client endpoint to surgically remove the
  // client entry from per_client_results (backend auto-flips alert to active
  // if no triggered clients remain)
  const handleDeleteSub = useCallback(async (row) => {
    const ok = await confirm({
      title: "Remove triggered entry?",
      description: `This will dismiss the triggered entry for ${row._client_name}. The alert will re-trigger if the condition is met again.`,
      confirmLabel: "Remove",
    })
    if (!ok) return
    try {
      const res = await apiRequest(`/api/alerts/${row.id}/dismiss-client`, {
        method: "POST",
        body: JSON.stringify({ client_id: row._client_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(`Removed triggered entry for ${row._client_name}`)
      fetchAlerts()
    } catch {
      toast.error("Failed to remove triggered entry")
    }
  }, [fetchAlerts])

  const handleTogglePause = useCallback(async (alert) => {
    const newStatus = alert.status === "active" || alert.status === "triggered" ? "paused" : "active"
    try {
      await apiRequest(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(newStatus === "paused" ? "Alert paused" : "Alert activated")
      fetchAlerts()
    } catch {
      toast.error("Failed to update alert")
    }
  }, [fetchAlerts])

  const handleSnoozeRequest = useCallback((alert) => {
    setSnoozeTarget(alert)
    setSnoozeHours(24)
  }, [])

  const handleSnoozeConfirm = async () => {
    const target = snoozeTarget
    if (!target) return
    try {
      if (target._virtual && target._client_id) {
        await apiRequest(`/api/alerts/${target.id}/snooze-client`, {
          method: "POST",
          body: JSON.stringify({ client_id: target._client_id, hours: snoozeHours }),
        })
      } else {
        await apiRequest(`/api/alerts/${target.id}/snooze`, {
          method: "POST",
          body: JSON.stringify({ hours: snoozeHours }),
        })
      }
      const label = SNOOZE_OPTIONS.find(s => s.value === snoozeHours)?.label
      toast.success(
        target._virtual
          ? `${target._client_name} snoozed for ${label}`
          : `Alert snoozed for ${label}`
      )
      setSnoozeTarget(null)
      fetchAlerts()
    } catch {
      toast.error("Failed to snooze alert")
    }
  }

  const handleEvaluate = useCallback(async (alert) => {
    setEvaluating(alert._virtual_id ?? alert.id)
    try {
      const res = await apiRequest(`/api/alerts/${alert.id}/evaluate`, {
        method: "POST",
      })
      const data = await res.json()
      const ev = data.evaluation
      if (ev?.triggered) {
        toast.warning(`⚡ Alert triggered: ${ev.message}`)
      } else {
        const pct = ev?.progress_pct?.toFixed(0) ?? "0"
        toast.success(`All clear — ${pct}% to trigger (current: ${ev?.current_value?.toFixed(2) ?? "—"})`)
      }
      fetchAlerts()
    } catch {
      toast.error("Evaluation failed")
    } finally {
      setEvaluating(null)
    }
  }, [fetchAlerts])

  // The page's own title is in the PageHeader below; the top bar only names the page.
  const topBar = useMemo(() => ({ title: "Alerts" }), [])
  usePageHeader(topBar)

  const counts = alerts.counts || {}
  const tabs = [
    { value: "active", label: "Active Alerts", count: counts.active || undefined },
    {
      value: "triggered",
      label: "Triggered",
      count: counts.triggered ? <Badge tone="danger" size="sm">{counts.triggered}</Badge> : undefined,
    },
    {
      value: "paused",
      label: "Snoozed / Paused",
      count: counts.paused ? <Badge tone="warning" size="sm">{counts.paused}</Badge> : undefined,
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Alerts"
        description="Every rule watching your accounts, and everything it has caught"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus />
            Create Alert
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="max-w-full overflow-x-auto">
          <SegmentedTabs
            ariaLabel="Alert state"
            panelId="alerts-panel"
            value={activeTab}
            onValueChange={setActiveTab}
            items={tabs}
          />
        </div>
        <div id="alerts-panel" role="tabpanel" aria-labelledby={`alerts-panel-tab-${activeTab}`}>
          {loadFailed && !isLoading ? (
            <ErrorState
              title="Couldn't load your alerts"
              description="Nothing here is out of date — we just couldn't reach your alerts."
              onRetry={() => { setIsLoading(true); fetchAlerts() }}
            />
          ) : (
          <AlertsList
            key={activeTab}
            rows={alerts[activeTab] || []}
            tab={activeTab}
            loading={isLoading}
            evaluating={evaluating}
            onEdit={openEdit}
            onEvaluate={handleEvaluate}
            onTogglePause={handleTogglePause}
            onSnooze={handleSnoozeRequest}
            onDelete={handleDelete}
            onDeleteSub={handleDeleteSub}
          />
          )}
        </div>
      </div>

      <AlertRuleEditor
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingAlert={editingAlert}
        form={form}
        setForm={setForm}
        mode={dialogMode}
        onModeChange={setDialogMode}
        chatKey={birdyChatKey}
        onAlertsChanged={fetchAlerts}
        onSave={handleSave}
        saving={saving}
        clientGroups={activeClientGroups}
        metricOptions={alertMetricOptions}
      />

      {/* ── Snooze Dialog ─────────────────────────────────────── */}
      <Dialog open={!!snoozeTarget} onOpenChange={open => !open && setSnoozeTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Snooze Alert</DialogTitle>
            <DialogDescription>
              {snoozeTarget?._virtual
                ? <>Silence <strong>{snoozeTarget._client_name}</strong> for this alert.</>
                : <>Temporarily silence <strong>"{snoozeTarget?.name}"</strong>.</>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="snooze-hours">Snooze for</Label>
            <Select value={String(snoozeHours)} onValueChange={v => setSnoozeHours(Number(v))}>
              <SelectTrigger id="snooze-hours" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SNOOZE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={() => setSnoozeTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSnoozeConfirm}>
              <BellOff />
              {snoozeTarget?._virtual ? "Snooze Client" : "Snooze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AlertsPageContent />
    </Suspense>
  )
}
