"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Bell,
  Sparkles,
  RefreshCw,
  Target,
  Users,
  Clock,
  Mail,
  Slack,
  Layers,
  User,
} from "lucide-react"
import MetricPicker from "@/components/ui/MetricPicker"
import { OPERATOR_OPTIONS, PERIOD_OPTIONS, TYPE_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/alert-helpers"
import ChatConversation from "@/components/chat/ChatConversation"

// ── Tracking mode toggle ──────────────────────────────────────────────────────

function TrackingModeToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-muted w-fit">
      <button
        type="button"
        onClick={() => onChange("total")}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          value === "total"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Layers className="h-3.5 w-3.5" />
        Total
      </button>
      <button
        type="button"
        onClick={() => onChange("per_client")}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          value === "per_client"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <User className="h-3.5 w-3.5" />
        Per Client
      </button>
    </div>
  )
}


/**
 * Create / edit dialog. Creating opens in "Ask Birdy" (a chat that makes the
 * rule); "Manual" and editing show the form.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object|null} props.editingAlert The rule being edited, null when creating
 * @param {object} props.form
 * @param {(update: (f: object) => object) => void} props.setForm
 * @param {"birdy"|"manual"} props.mode
 * @param {(mode: "birdy"|"manual") => void} props.onModeChange
 * @param {number} props.chatKey Remounts the chat so each create starts fresh
 * @param {() => void} props.onAlertsChanged Called when the chat creates a rule
 * @param {() => void} props.onSave
 * @param {boolean} props.saving
 * @param {object[]} props.clientGroups Active clients a rule can target
 * @param {object[]} props.metricOptions Options for the metric picker
 */
export default function AlertRuleEditor({
  open, onOpenChange, editingAlert, form, setForm, mode, onModeChange,
  chatKey, onAlertsChanged, onSave, saving, clientGroups, metricOptions,
}) {
  const [clientSearch, setClientSearch] = useState("")

  // Each open starts with an empty client search.
  useEffect(() => {
    if (open) setClientSearch("")
  }, [open])

  const toggleGroup = (id) => {
    setForm(f => ({
      ...f,
      target_group_ids: f.target_group_ids.includes(id)
        ? f.target_group_ids.filter(g => g !== id)
        : [...f.target_group_ids, id],
    }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[min(1120px,94vw)] !max-w-none h-[88vh] p-0 gap-0 flex flex-col overflow-hidden bg-pd-canvas sm:!max-w-none"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="bg-pd-surface px-7 py-5 border-b border-pd-border shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-pd-display text-[22px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
                  {editingAlert ? "Edit Alert" : "Create Alert"}
                </h2>
                <p className="text-[13px] text-pd-subtle mt-1.5">
                  {editingAlert
                    ? "Update the alert configuration."
                    : mode === "birdy"
                      ? "Chat with Birdy to set up your alert — it'll create it for you."
                      : "Fill in the form to configure your alert manually."}
                </p>
              </div>
              {!editingAlert && (
                <div className="flex items-center gap-1 p-1 rounded-full bg-muted shrink-0">
                  <button
                    type="button"
                    onClick={() => onModeChange("birdy")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      mode === "birdy"
                        ? "bg-pd-primary text-white shadow-pd-segment"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${mode === "birdy" ? "text-white" : "text-muted-foreground"}`} />
                    Ask Birdy
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange("manual")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      mode === "manual"
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Manual
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Body — Birdy AI mode */}
          {mode === "birdy" && !editingAlert && (
            <div className="flex-1 min-h-0 flex flex-col bg-pd-canvas overflow-hidden">
              <div className="flex-1 min-h-0 h-full overflow-hidden">
                <ChatConversation
                  key={chatKey}
                  page="alerts"
                  sessionKey={`birdy_alert_session_${chatKey}`}
                  initialMessage="Hi, I want to create a new alert"
                  bubbleWidthClass="max-w-[85%]"
                  composerCompact
                  composerPlaceholder="Type your answer..."
                  showQuickActions={false}
                  quickStarters={[
                    { label: "CPL alert", prompt: "Alert me when cost per lead exceeds a threshold" },
                    { label: "Spend alert", prompt: "Alert me when ad spend goes too high" },
                    { label: "Revenue alert", prompt: "Alert me when GHL revenue drops" },
                    { label: "Calls alert", prompt: "Alert me on call center metrics" },
                  ]}
                  emptyStateTitle="Let's create an alert"
                  emptyStateSubtitle="Tell me what you want to monitor and I'll set it up for you."
                  onToolUsed={(toolName) => {
                    if (toolName === "create_alert") onAlertsChanged()
                  }}
                />
              </div>
              <div className="shrink-0 px-7 py-3 border-t border-pd-border bg-pd-surface flex justify-end">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* Body — Manual form mode */}
          {(mode === "manual" || editingAlert) && (
          <div className="px-7 py-6 overflow-y-auto flex-1">
            {/* Form */}
            <form id="create-alert-form" onSubmit={e => { e.preventDefault(); onSave() }}>
              <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Left Column */}
                <div className="w-full lg:w-2/3 flex-1 space-y-4">
                  {/* Basic Info */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Name</Label>
                        <Input
                          placeholder="e.g. Low ROI Alert"
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Description</Label>
                        <Input
                          placeholder="Describe when this alert fires..."
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Type</Label>
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm space-y-4">
                    <h3 className="font-pd-display text-[16px] font-semibold text-pd-ink">Condition</h3>
                    <div className="grid grid-cols-[2fr_1fr_110px_1fr] gap-4">
                      <div className="space-y-2">
                      <Label className="text-[12.5px] font-semibold text-pd-ink">Metric</Label>
                      <MetricPicker
                        metrics={metricOptions}
                        value={form.metric}
                        onChange={v => setForm(f => ({ ...f, metric: v }))}
                        placeholder="Select metric..."
                        triggerClassName="w-full"
                      />
                      </div>
                      <div className="space-y-2">
                      <Label className="text-[12.5px] font-semibold text-pd-ink">When it</Label>
                      <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        <SelectContent>
                            {OPERATOR_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12.5px] font-semibold text-pd-ink">Value</Label>
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
                      <Label className="text-[12.5px] font-semibold text-pd-ink">Over</Label>
                      <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        <SelectContent>
                            {PERIOD_OPTIONS.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      </div>
                    </div>
                  </div>

                  {/* Target Client Groups */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <h3 className="font-pd-display text-[16px] font-semibold text-pd-ink">Target Client Groups</h3>
                      <div className="flex flex-col items-end gap-1">
                        <TrackingModeToggle value={form.tracking_mode} onChange={v => setForm(f => ({ ...f, tracking_mode: v }))} />
                        <p className="text-xs text-muted-foreground max-w-[280px] text-right">
                          {form.tracking_mode === "total"
                            ? "Alert triggers when the combined value across all selected clients crosses the threshold."
                            : "Alert triggers separately for each client that crosses the threshold on their own."}
                        </p>
                      </div>
                    </div>
                    <Input placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                    <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-pd-border divide-y divide-pd-divider">
                        {/* Select All */}
                      <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-pd-table-head transition-colors font-medium bg-muted/30">
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
                        .map(g => (
                          <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-pd-table-head transition-colors">
                            <Checkbox checked={form.target_group_ids.includes(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                            <span className="text-sm">{g.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="w-full lg:w-1/3 flex-shrink-0 self-stretch space-y-4">
                  {/* Preview Card */}
                  <div className="rounded-xl border border-pd-border bg-pd-surface shadow-sm flex flex-col">
                    <div className="p-6 pt-6 flex-1 flex flex-col">
                      <div className="text-center p-4 flex-1 flex flex-col justify-center">
                        <div className="font-pd-display text-[20px] font-bold tracking-[-0.01em] text-pd-ink">{form.name || "Unnamed Alert"}</div>
                        <div className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-2">
                          {(() => {
                            const sel = metricOptions.find(m => m.id === form.metric)
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
                          <Badge variant="secondary" className="capitalize">client</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {form.tracking_mode === "per_client" ? <User className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                            <span>Tracking</span>
                          </div>
                          {form.tracking_mode === "per_client" ? (
                            <Badge className="gap-1 text-xs"><User className="h-3 w-3" /> Per Client</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs"><Layers className="h-3 w-3" /> Total</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span>Targets</span></div>
                          <span className="font-medium">{form.target_group_ids.length ? `${form.target_group_ids.length} selected` : "None"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span>Frequency</span></div>
                          <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
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
                  <div className="rounded-xl border border-pd-border bg-pd-surface p-6 shadow-sm space-y-4">
                    <h3 className="font-pd-display text-[16px] font-semibold text-pd-ink">Notification Channels</h3>
                    <div className="space-y-3">
                      {/* Internal */}
                      <div className="rounded-2xl border border-pd-border p-3.5 space-y-2">
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
                      <div className="rounded-2xl border border-pd-border p-3.5 space-y-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Slack className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Slack</span>
                            <Badge className="bg-pd-divider text-pd-body border-0 text-[10px] px-2 py-0">Soon</Badge>
                          </div>
                          <Switch disabled checked={false} />
                        </div>
                      </div>
                      {/* Email — Coming Soon */}
                      <div className="rounded-2xl border border-pd-border p-3.5 space-y-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Email</span>
                            <Badge className="bg-pd-divider text-pd-body border-0 text-[10px] px-2 py-0">Soon</Badge>
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
          )}

          {/* Footer — only shown in manual/edit mode */}
          {(mode === "manual" || editingAlert) && (
          <div className="bg-pd-surface px-7 py-4 border-t border-pd-border flex-shrink-0">
            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-alert-form"
                disabled={saving}
              >
                {saving
                  ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Saving...</>
                  : (editingAlert ? "Save Changes" : "Create Alert")}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
