"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Bell,
  CirclePlus,
  Ellipsis,
  Pencil,
  Trash2,
  Play,
  Pause,
  BellRing,
  RefreshCw,
  BellOff,
  Zap,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest } from "@/lib/api"
import {
  METRIC_OPTIONS, OPERATOR_OPTIONS, PERIOD_OPTIONS, SNOOZE_OPTIONS, EMPTY_FORM,
  statusBadge, formatRelative, conditionSummary, ProgressToTrigger, metricIcon
} from "@/lib/alert-helpers"

// ── Main page ─────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState({ active: [], triggered: [], paused: [], counts: {} })
  const [clientGroups, setClientGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [snoozeHours, setSnoozeHours] = useState(24)
  const [evaluating, setEvaluating] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
      const res = await apiRequest("/api/client-groups")
      if (!res.ok) return
      const data = await res.json()
      setClientGroups(data.client_groups || [])
    } catch { }
  }, [])

  useEffect(() => {
    fetchAlerts()
    fetchClientGroups()
  }, [fetchAlerts, fetchClientGroups])

  // ── Form helpers ─────────────────────────────────────────────

  const openCreate = () => {
    setEditingAlert(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (alert) => {
    setEditingAlert(alert)
    setForm({
      name: alert.name || "",
      description: alert.description || "",
      metric: alert.condition?.metric || "lead_count",
      operator: alert.condition?.operator || "pct_drop",
      value: String(alert.condition?.value ?? "30"),
      period: alert.condition?.period || "week",
      target_group_ids: alert.target_group_ids || [],
      notification_channels: alert.notification_channels || ["in_app"],
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Alert name is required"); return }
    if (!form.value || isNaN(Number(form.value))) { toast.error("Please enter a valid threshold value"); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        condition: {
          metric: form.metric,
          operator: form.operator,
          value: Number(form.value),
          period: form.period,
        },
        target_group_ids: form.target_group_ids,
        notification_channels: form.notification_channels,
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

  // ── Actions ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiRequest(`/api/alerts/${deleteTarget.id}`, { method: "DELETE" })
      toast.success("Alert deleted")
      setDeleteTarget(null)
      fetchAlerts()
    } catch {
      toast.error("Failed to delete alert")
    }
  }

  const handleTogglePause = async (alert) => {
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
  }

  const handleSnooze = async () => {
    if (!snoozeTarget) return
    try {
      await apiRequest(`/api/alerts/${snoozeTarget.id}/snooze`, {
        method: "POST",
        body: JSON.stringify({ hours: snoozeHours }),
      })
      toast.success(`Alert snoozed for ${SNOOZE_OPTIONS.find(s => s.value === snoozeHours)?.label}`)
      setSnoozeTarget(null)
      fetchAlerts()
    } catch {
      toast.error("Failed to snooze alert")
    }
  }

  const handleEvaluate = async (alert) => {
    setEvaluating(alert.id)
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
  }

  const toggleGroup = (id) => {
    setForm(f => ({
      ...f,
      target_group_ids: f.target_group_ids.includes(id)
        ? f.target_group_ids.filter(g => g !== id)
        : [...f.target_group_ids, id],
    }))
  }

  // ── Render rows ───────────────────────────────────────────────

  const AlertRow = ({ alert }) => (
    <tr className="border-b transition-colors hover:bg-muted/50 h-12 bg-white">
      {/* Name */}
      <td className="py-3 px-4 align-middle min-w-[180px]">
        <div className="font-semibold text-md">{alert.name}</div>
        {alert.description && (
          <div className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate">{alert.description}</div>
        )}
      </td>

      {/* Metric */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{metricIcon(alert.condition?.metric)}</span>
          <span>{METRIC_OPTIONS.find(m => m.value === alert.condition?.metric)?.label || alert.condition?.metric}</span>
        </div>
      </td>

      {/* Condition */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="text-sm font-mono font-medium">{conditionSummary(alert)}</div>
        {alert.condition?.period && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {["pct_drop", "pct_rise"].includes(alert.condition?.operator) ? "vs " : "window: "}
            {alert.condition.period}
          </div>
        )}
      </td>

      {/* Progress to trigger */}
      <td className="py-3 px-4 align-middle">
        <ProgressToTrigger alert={alert} />
      </td>

      {/* Status */}
      <td className="py-3 px-4 align-middle min-w-[120px]">
        {statusBadge(alert.status, alert.snoozed_until)}
      </td>

      {/* Targets */}
      <td className="py-3 px-4 align-middle min-w-[140px]">
        {alert.target_group_ids?.length ? (
          <div className="flex flex-col gap-0.5 max-w-[180px]">
            {(alert.target_group_names?.length ? alert.target_group_names : alert.target_group_ids)
              .slice(0, 2)
              .map((name, i) => (
                <span key={i} className="text-sm truncate">{name}</span>
              ))}
            {alert.target_group_ids.length > 2 && (
              <span className="text-xs text-muted-foreground">+{alert.target_group_ids.length - 2} more</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Global (All)</span>
        )}
      </td>

      {/* Last updated */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="text-sm text-muted-foreground">{formatRelative(new Date(alert.updated_at))}</div>
        {alert.last_triggered_at && (
          <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <BellRing className="h-3 w-3" />
            {formatRelative(new Date(alert.last_triggered_at))}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-white">
            <DropdownMenuItem onClick={() => openEdit(alert)} className="gap-2 cursor-pointer">
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleEvaluate(alert)}
              disabled={evaluating === alert.id}
              className="gap-2 cursor-pointer"
            >
              {evaluating === alert.id
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <Zap className="h-4 w-4" />}
              Evaluate now
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleTogglePause(alert)} className="gap-2 cursor-pointer">
              {alert.status === "paused"
                ? <><Play className="h-4 w-4" /> Activate</>
                : <><Pause className="h-4 w-4" /> Pause</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSnoozeTarget(alert); setSnoozeHours(24) }} className="gap-2 cursor-pointer">
              <BellOff className="h-4 w-4" /> Snooze
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(alert)}
              className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )

  const EmptyState = ({ label }) => (
    <tr>
      <td colSpan={8} className="py-16 text-center">
        <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No {label} alerts</p>
      </td>
    </tr>
  )

  const AlertTable = ({ rows, emptyLabel }) => (
    <div className="relative w-full overflow-auto rounded-md border border-border/60">
      <table className="w-full caption-bottom text-sm">
        <thead className="bg-white sticky top-0 z-20">
          <tr className="border-b h-11">
            {["Alert Name", "Metric", "Condition", "Progress", "Status", "Targets", "Last Updated", "Actions"].map(h => (
              <th key={h} className="h-11 px-4 text-left align-middle font-semibold text-[#71658B] bg-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {rows.length === 0
            ? <EmptyState label={emptyLabel} />
            : rows.map(a => <AlertRow key={a.id} alert={a} />)
          }
        </tbody>
      </table>
    </div>
  )

  const isPctOp = ["pct_drop", "pct_rise"].includes(form.operator)

  return (
    <main className="min-h-screen w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto">
      <div className=" mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">Alerts</h1>

          </div>
          <Button onClick={openCreate} className="bg-[#713cdd] hover:bg-[#5f2fc0] text-white gap-2">
            <CirclePlus className="h-4 w-4" />
            Create Alert
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="w-full gap-4">
          <TabsList className="inline-flex h-13 w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm overflow-x-auto md:overflow-x-hidden gap-2 md:gap-0">
            <TabsTrigger value="active" className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Active Alerts
              {alerts.counts?.active > 0 && (
                <span className="ml-2 rounded-full bg-[#713cdd]/10 px-2 py-0.5 text-xs font-medium text-[#713cdd]">
                  {alerts.counts.active}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="triggered" className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Triggered
              {alerts.counts?.triggered > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {alerts.counts.triggered}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="paused" className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Snoozed / Paused
              {alerts.counts?.paused > 0 && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {alerts.counts.paused}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            // <div className="flex items-center justify-center py-24">
            //   <RefreshCw className="h-6 w-6 animate-spin text-[#713cdd]" />
            // </div>
            <div className="flex w-full mx-auto py-30 max-w-xs flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <>
              <TabsContent value="active" className="mt-2"><AlertTable rows={alerts.active || []} emptyLabel="active" /></TabsContent>
              <TabsContent value="triggered" className="mt-2"><AlertTable rows={alerts.triggered || []} emptyLabel="triggered" /></TabsContent>
              <TabsContent value="paused" className="mt-2"><AlertTable rows={alerts.paused || []} emptyLabel="paused" /></TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingAlert ? "Edit Alert" : "Create Alert"}</DialogTitle>
            <DialogDescription>
              {editingAlert ? "Update the alert configuration." : "Set up a metric alert to stay informed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Alert Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Low ROI Alert"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Describe when this alert fires…"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Condition row */}
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <div className="flex gap-2">
                {/* Metric */}
                <Select value={form.metric} onValueChange={v => setForm(f => ({ ...f, metric: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Metric" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {METRIC_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator */}
                <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {OPERATOR_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value */}
                <Input
                  className="w-24"
                  type="number"
                  min="0"
                  placeholder={isPctOp ? "30" : "0"}
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                />
              </div>

              {/* Period (only for pct operators) */}
              {/* Period — always visible, meaning changes based on operator */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">
                  {isPctOp ? "Compare to:" : "Time window:"}
                </span>
                <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {PERIOD_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isPctOp && (
                  <span className="text-xs text-muted-foreground">of data to aggregate</span>
                )}
              </div>
            </div>

            {/* Target groups */}
            <div className="space-y-1.5">
              <Label>Target Client Groups</Label>
              <p className="text-xs text-muted-foreground">Leave empty to monitor all groups globally.</p>
              {clientGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No client groups found.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {clientGroups.map(g => {
                    const selected = form.target_group_ids.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selected
                          ? "bg-[#713cdd] text-white border-[#713cdd]"
                          : "bg-white text-foreground border-border hover:border-[#713cdd]"
                          }`}
                      >
                        {g.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#713cdd] hover:bg-[#5f2fc0] text-white"
            >
              {saving ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Saving…</> : (editingAlert ? "Save Changes" : "Create Alert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Snooze Dialog ─────────────────────────────────────── */}
      <Dialog open={!!snoozeTarget} onOpenChange={open => !open && setSnoozeTarget(null)}>
        <DialogContent className="bg-white sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Snooze Alert</DialogTitle>
            <DialogDescription>
              Temporarily silence <strong>"{snoozeTarget?.name}"</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Label>Snooze for</Label>
            <Select value={String(snoozeHours)} onValueChange={v => setSnoozeHours(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {SNOOZE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeTarget(null)}>Cancel</Button>
            <Button onClick={handleSnooze} className="bg-[#713cdd] hover:bg-[#5f2fc0] text-white gap-2">
              <BellOff className="h-4 w-4" /> Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}