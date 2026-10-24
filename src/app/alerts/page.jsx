"use client"

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSearchParams } from "next/navigation"
import { usePageHeader } from "@/components/page-header"
import { pdFontClass } from "@/lib/fonts"
import { PageTabs } from "@/components/portfolio"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { CirclePlus, BellOff } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { buildMetricPickerOptions } from "@/lib/metric-picker-options"
import { SNOOZE_OPTIONS, EMPTY_FORM } from "@/lib/alert-helpers"
import AlertRuleEditor from "./AlertRuleEditor"
import { AlertTable, AlertTableSkeleton, TriggeredTable } from "./AlertsList"
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
  const [customMetrics, setCustomMetrics] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSubTarget, setDeleteSubTarget] = useState(null)
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
    try {
      const res = await apiRequest("/api/alerts")
      if (!res.ok) throw new Error("Failed to load alerts")
      const data = await res.json()
      setAlerts(data)
    } catch (e) {
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

  const handleDeleteRequest = useCallback((alert) => {
    setDeleteTarget(alert)
  }, [])

  const handleDeleteConfirm = async () => {
    const target = deleteTarget
    if (!target) return
    setDeleteTarget(null)
    try {
      const res = await apiRequest(`/api/alerts/${target.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Alert deleted")
      setDeleteTarget(null)
      fetchAlerts()
    } catch {
      toast.error("Failed to delete alert")
    }
  }

  // Sub-alert delete: calls dismiss-client endpoint to surgically remove the
  // client entry from per_client_results (backend auto-flips alert to active
  // if no triggered clients remain)
  const handleDeleteSubRequest = useCallback((row) => {
    setDeleteSubTarget(row)
  }, [])

  const handleDeleteSubConfirm = async () => {
    const target = deleteSubTarget
    if (!target) return
    setDeleteSubTarget(null)
    try {
      const res = await apiRequest(`/api/alerts/${target.id}/dismiss-client`, {
        method: "POST",
        body: JSON.stringify({ client_id: target._client_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(`Removed triggered entry for ${target._client_name}`)
      fetchAlerts()
    } catch {
      toast.error("Failed to remove triggered entry")
    }
  }

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

  // Title and the create action belong in the global top bar, in place of the
  // Birdy wordmark — the same place Marketing, Sales, Leads and the Client Hub
  // put theirs. See components/page-header.jsx.
  const header = useMemo(
    () => ({
      title: (
        <div className={`${pdFontClass} min-w-0`}>
          <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
            Alerts
          </h1>
          <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">
            Every rule watching your accounts, and everything it has caught
          </p>
        </div>
      ),
      controls: (
        <Button onClick={openCreate} className="gap-2">
          <CirclePlus className="h-4 w-4" />
          Create Alert
        </Button>
      ),
    }),
    [openCreate]
  )
  usePageHeader(header)

  const rowHandlers = {
    evaluating,
    onEdit: openEdit,
    onEvaluate: handleEvaluate,
    onTogglePause: handleTogglePause,
    onSnooze: handleSnoozeRequest,
    onDelete: handleDeleteRequest,
  }

  return (
    <main className={`${pdFontClass} w-full min-w-0`}>
      <div className=" mx-auto">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">  
          {/* The app's page tab bar. Triggered and Snoozed keep their own badge
              colours — red and amber carry meaning here, so they override the
              strip's default tint rather than reading as a plain count. Active
              has no such meaning and takes the default. A count of 0 passes
              undefined, which renders no badge at all. */}
          <div className={pdFontClass}>
            <PageTabs
              label="Alert state"
              tabs={[
                { key: "active", label: "Active Alerts", badge: alerts.counts?.active || undefined },
                {
                  key: "triggered",
                  label: "Triggered",
                  badge: alerts.counts?.triggered || undefined,
                  badgeClassName: "bg-pd-danger-bg text-pd-danger",
                },
                {
                  key: "paused",
                  label: "Snoozed / Paused",
                  badge: alerts.counts?.paused || undefined,
                  badgeClassName: "bg-pd-warning-bg text-pd-amber",
                },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {isLoading ? (
            <div className="mt-2"><AlertTableSkeleton /></div>
          ) : (
            <>
              <TabsContent value="active" className="mt-2">
                <AlertTable rows={alerts.active || []} emptyLabel="active" {...rowHandlers} />
              </TabsContent>
              <TabsContent value="triggered" className="mt-2">
                <TriggeredTable
                  rows={alerts.triggered || []}
                  evaluating={evaluating}
                  onEdit={openEdit}
                  onEvaluate={handleEvaluate}
                  onTogglePause={handleTogglePause}
                  onSnooze={handleSnoozeRequest}
                  onDelete={handleDeleteRequest}
                  onDeleteSub={handleDeleteSubRequest}
                />
              </TabsContent>
              <TabsContent value="paused" className="mt-2">
                <AlertTable rows={alerts.paused || []} emptyLabel="paused" {...rowHandlers} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
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

      {/* ── Delete Confirmation ───────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alert?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleteTarget?.name}"</strong> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete sub-alert (client triggered entry) ─────────── */}
      <AlertDialog open={!!deleteSubTarget} onOpenChange={open => { if (!open) setDeleteSubTarget(null) }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove triggered entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will dismiss the triggered entry for <strong>{deleteSubTarget?._client_name}</strong>. The alert will re-trigger if the condition is met again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSubConfirm}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <div className="py-2 space-y-3">
            <Label>Snooze for</Label>
            <Select value={String(snoozeHours)} onValueChange={v => setSnoozeHours(Number(v))}>
              <SelectTrigger>
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
            <Button variant="outline" onClick={() => setSnoozeTarget(null)}>Cancel</Button>
            <Button onClick={handleSnoozeConfirm} className="gap-2">
              <BellOff className="h-4 w-4" />
              {snoozeTarget?._virtual ? "Snooze Client" : "Snooze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="mt-[62px]"><AlertTableSkeleton /></div>
      }
    >
      <AlertsPageContent />
    </Suspense>
  )
}
