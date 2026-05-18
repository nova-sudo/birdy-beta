"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
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
  Target,
  Users,
  Clock,
  Mail,
  Slack,
  Calculator,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { ghlIcon } from "@/lib/icons"
import { apiRequest } from "@/lib/api"
import MetricPicker from "@/components/ui/MetricPicker"
import { buildMetricPickerOptions } from "@/lib/metric-picker-options"
import {
  METRIC_OPTIONS, OPERATOR_OPTIONS, PERIOD_OPTIONS, SNOOZE_OPTIONS, EMPTY_FORM,
  TYPE_OPTIONS, FREQUENCY_OPTIONS,
  statusBadge, formatRelative, conditionSummary, ProgressToTrigger, metricIcon
} from "@/lib/alert-helpers"

// ── Main page ─────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState({ active: [], triggered: [], paused: [], counts: {} })
  const [clientGroups, setClientGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [customMetrics, setCustomMetrics] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [snoozeHours, setSnoozeHours] = useState(24)
  const [evaluating, setEvaluating] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [birdyInput, setBirdyInput] = useState("")

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
      const res = await apiRequest("/api/client-groups")
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

  const openCreate = () => {
    setEditingAlert(null)
    setForm(EMPTY_FORM)
    setClientSearch("")
    setBirdyInput("")
    setDialogOpen(true)
  }

  const openEdit = (alert) => {
    setEditingAlert(alert)
    setForm({
      name: alert.name || "",
      description: alert.description || "",
      type: alert.type || "warning",
      metric: alert.condition?.metric || "lead_count",
      operator: alert.condition?.operator || "gt",
      value: String(alert.condition?.value ?? "0"),
      period: alert.condition?.period || "day",
      target_group_ids: alert.target_group_ids || [],
      notification_channels: alert.notification_channels || ["in_app"],
      frequency: alert.frequency || "daily",
    })
    setClientSearch("")
    setBirdyInput("")
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
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="active">
              Active Alerts
              {alerts.counts?.active > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {alerts.counts.active}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="triggered">
              Triggered
              {alerts.counts?.triggered > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {alerts.counts.triggered}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="paused">
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
        <DialogContent
          className="w-[90vw] !max-w-none max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-background sm:!max-w-none"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="bg-white dark:bg-card px-6 py-4 border-b border-border rounded-t-lg">
            <div className="flex flex-col text-center sm:text-left space-y-1">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {editingAlert ? "Edit Alert" : "Create Alert"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingAlert ? "Update the alert configuration." : "Set up a metric alert to stay informed."}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* Ask Birdy — Coming Soon */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm mb-6 relative overflow-hidden">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">Need help? Ask Birdy to build it for you!</h3>
                  <Badge className="bg-purple-100 text-purple-700 border-0 text-xs font-medium">Coming Soon</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Describe your alert in plain English and Birdy will configure it automatically — just type something like
                  &quot;Alert me when cost per lead exceeds £5&quot; and we&apos;ll fill in the metric, condition, and targets for you.
                </p>
                <div className="flex gap-2 mt-3 opacity-50 pointer-events-none">
                  <Input
                    className="flex-1 h-11 rounded-lg"
                    placeholder="e.g. 'Alert me when cost per lead exceeds £5'"
                    disabled
                  />
                  <Button
                    className="h-11 w-11 rounded-lg bg-primary text-primary-foreground shrink-0"
                    disabled
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Form */}
            <form id="create-alert-form" onSubmit={e => { e.preventDefault(); handleSave() }}>
              <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Left Column */}
                <div className="w-full lg:w-2/3 flex-1 space-y-4">
                  {/* Basic Info */}
                  <div className="rounded-lg border border-border bg-card p-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Name</Label>
                        <Input
                          placeholder="e.g. Low ROI Alert"
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Description</Label>
                        <Input
                          placeholder="Describe when this alert fires..."
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Type</Label>
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {TYPE_OPTIONS.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                    <h3 className="text-base font-semibold">Condition</h3>
                    <div className="grid grid-cols-[2fr_1fr_80px_1fr] gap-4">
                      <div className="space-y-2">
                        <MetricPicker
                          metrics={alertMetricOptions}
                          value={form.metric}
                          onChange={v => setForm(f => ({ ...f, metric: v }))}
                          placeholder="Select metric..."
                          triggerClassName="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {OPERATOR_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-10"
                          value={form.value}
                          onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {PERIOD_OPTIONS.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Target Client Groups */}
                  <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                    <h3 className="text-base font-semibold">Target Client Groups</h3>
                    <div className="space-y-4">
                      <Input
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                      />
                      <div className="max-h-[200px] overflow-y-auto border rounded-md divide-y">
                        {/* Select All */}
                        <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors font-medium bg-muted/30">
                          <Checkbox
                            checked={clientGroups.length > 0 && form.target_group_ids.length === clientGroups.length}
                            onCheckedChange={(checked) => {
                              setForm(f => ({
                                ...f,
                                target_group_ids: checked ? clientGroups.map(g => g.id) : [],
                              }))
                            }}
                          />
                          <span className="text-sm font-medium">Target All Client Groups</span>
                        </label>
                        {/* Client groups */}
                        {clientGroups
                          .filter(g => g.name.toLowerCase().includes(clientSearch.toLowerCase()))
                          .map(g => {
                            const selected = form.target_group_ids.includes(g.id)
                            return (
                              <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={() => toggleGroup(g.id)}
                                />
                                <span className="text-sm">{g.name}</span>
                              </label>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="w-full lg:w-1/3 flex-shrink-0 self-stretch space-y-4">
                  {/* Preview Card */}
                  <div className="rounded-lg border text-card-foreground shadow-sm bg-card flex flex-col">
                    <div className="p-6 pt-6 flex-1 flex flex-col">
                      <div className="text-center p-4 flex-1 flex flex-col justify-center">
                        <div className="text-lg font-bold">{form.name || "Unnamed Alert"}</div>
                        <div className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-2">
                          {(() => {
                            const sel = alertMetricOptions.find(m => m.id === form.metric)
                            if (!sel) return "Select a metric to preview"
                            return (
                              <>
                                {sel.icon && <Image src={sel.icon} alt="" width={16} height={16} className="opacity-70" />}
                                {sel.label}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="border-t border-border pt-4 mt-2 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Target className="h-4 w-4" />
                            <span>Scope</span>
                          </div>
                          <Badge variant="outline" className="capitalize">client</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>Targets</span>
                          </div>
                          <span className="font-medium">
                            {form.target_group_ids.length
                              ? `${form.target_group_ids.length} selected`
                              : "None"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Frequency</span>
                          </div>
                          <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              {FREQUENCY_OPTIONS.map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>Channels</span>
                          </div>
                          <span className="font-medium">
                            {form.notification_channels.length} active
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notification Channels */}
                  <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                    <h3 className="text-base font-semibold">Notification Channels</h3>
                    <div className="space-y-3">
                      {/* Internal */}
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Internal</span>
                          </div>
                          <Switch
                            checked={form.notification_channels.includes("in_app")}
                            onCheckedChange={(checked) => {
                              setForm(f => ({
                                ...f,
                                notification_channels: checked
                                  ? [...f.notification_channels.filter(c => c !== "in_app"), "in_app"]
                                  : f.notification_channels.filter(c => c !== "in_app"),
                              }))
                            }}
                          />
                        </div>
                        {form.notification_channels.includes("in_app") && (
                          <p className="text-xs text-muted-foreground">Notifications will appear in your Birdy dashboard.</p>
                        )}
                      </div>
                      {/* Slack — Coming Soon */}
                      <div className="rounded-lg border border-border p-3 space-y-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Slack className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Slack</span>
                            <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] font-medium px-1.5 py-0">Soon</Badge>
                          </div>
                          <Switch disabled checked={false} />
                        </div>
                      </div>
                      {/* Email — Coming Soon */}
                      <div className="rounded-lg border border-border p-3 space-y-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Email</span>
                            <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] font-medium px-1.5 py-0">Soon</Badge>
                          </div>
                          <Switch disabled checked={false} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-white dark:bg-card px-6 py-4 border-t border-border rounded-b-lg flex-shrink-0">
            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-alert-form"
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving
                  ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Saving...</>
                  : (editingAlert ? "Save Changes" : "Create Alert")}
              </Button>
            </div>
          </div>
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