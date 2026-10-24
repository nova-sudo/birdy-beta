"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Bell, Clock, Layers, Mail, Slack, Sparkles, Target, User, Users } from "lucide-react"
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Surface,
  Switch,
} from "@/components/ds"
import { cn } from "@/lib/utils"
import { useCurrency } from "@/hooks/useCurrency"
import MetricPicker from "@/components/ui/MetricPicker"
import { localiseMetricLabel, OPERATOR_OPTIONS, PERIOD_OPTIONS, TYPE_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/alert-helpers"
import ChatConversation from "@/components/chat/ChatConversation"

const MODES = [
  {
    value: "birdy",
    label: (
      <>
        <Sparkles className="size-3.5" /> Ask Birdy
      </>
    ),
  },
  { value: "manual", label: "Manual" },
]

const TRACKING = [
  {
    value: "total",
    label: (
      <>
        <Layers className="size-3.5" /> Total
      </>
    ),
  },
  {
    value: "per_client",
    label: (
      <>
        <User className="size-3.5" /> Per Client
      </>
    ),
  },
]

const QUICK_STARTERS = [
  { label: "CPL alert", prompt: "Alert me when cost per lead exceeds a threshold" },
  { label: "Spend alert", prompt: "Alert me when ad spend goes too high" },
  { label: "Revenue alert", prompt: "Alert me when GHL revenue drops" },
  { label: "Calls alert", prompt: "Alert me on call center metrics" },
]

function Field({ id, label, wide = false, children }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <Surface as="section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </Surface>
  )
}

function PreviewRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

function ChannelRow({ icon: Icon, label, soon, ...switchProps }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {label}
        {soon && <Badge>Soon</Badge>}
      </div>
      <Switch aria-label={label} {...switchProps} />
    </div>
  )
}

/**
 * Create / edit alert in a wide side sheet. Creating opens in "Ask Birdy" (a chat
 * that makes the rule); "Manual" and editing show the form: details, condition and
 * targets on the left, a live preview with frequency and channels on the right.
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
  const { currencySymbol } = useCurrency("GBP")

  // Each open starts with an empty client search.
  useEffect(() => {
    if (open) setClientSearch("")
  }, [open])

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setField = (key) => (e) => set(key)(e.target.value)

  const toggleGroup = (id) => {
    setForm((f) => ({
      ...f,
      target_group_ids: f.target_group_ids.includes(id)
        ? f.target_group_ids.filter((g) => g !== id)
        : [...f.target_group_ids, id],
    }))
  }

  const showForm = mode === "manual" || !!editingAlert
  // The shared labels hard-code "($)"; show the user's own currency here.
  const localisedMetrics = useMemo(
    () => metricOptions.map((m) => ({ ...m, label: localiseMetricLabel(m.label, currencySymbol) })),
    [metricOptions, currencySymbol]
  )
  const selectedMetric = localisedMetrics.find((m) => m.id === form.metric)
  const perClient = form.tracking_mode === "per_client"

  const description = editingAlert
    ? "Update the alert configuration."
    : mode === "birdy"
      ? "Chat with Birdy to set up your alert — it'll create it for you."
      : "Fill in the form to configure your alert manually."

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="gap-0 p-0 md:inset-y-2 md:right-2 md:h-auto md:w-[min(880px,calc(100%-16px))] md:max-w-none md:rounded-overlay"
      >
        <SheetHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-b border-border py-4 pr-14 pl-5">
          <div className="min-w-0">
            <SheetTitle>{editingAlert ? "Edit Alert" : "Create Alert"}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </div>
          {!editingAlert && (
            <SegmentedTabs ariaLabel="How to create the alert" value={mode} onValueChange={onModeChange} items={MODES} />
          )}
        </SheetHeader>

        {/* Ask Birdy mode */}
        {mode === "birdy" && !editingAlert && (
          <>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatConversation
                key={chatKey}
                page="alerts"
                sessionKey={`birdy_alert_session_${chatKey}`}
                initialMessage="Hi, I want to create a new alert"
                bubbleWidthClass="max-w-[85%]"
                composerCompact
                composerPlaceholder="Type your answer..."
                showQuickActions={false}
                quickStarters={QUICK_STARTERS}
                emptyStateTitle="Let's create an alert"
                emptyStateSubtitle="Tell me what you want to monitor and I'll set it up for you."
                onToolUsed={(toolName) => {
                  if (toolName === "create_alert") onAlertsChanged()
                }}
              />
            </div>
            <SheetFooter className="shrink-0 flex-row justify-end border-t border-border px-5 py-3">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </SheetFooter>
          </>
        )}

        {/* Manual form mode */}
        {showForm && (
          <>
            <form
              id="create-alert-form"
              onSubmit={(e) => {
                e.preventDefault()
                onSave()
              }}
              className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto bg-muted p-4 md:grid-cols-[minmax(0,1fr)_280px]"
            >
              {/* Left column */}
              <div className="flex min-w-0 flex-col gap-4">
                <Section title="Details">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="alert-name" label="Name">
                      <Input id="alert-name" placeholder="e.g. Low ROI Alert" value={form.name} onChange={setField("name")} />
                    </Field>
                    <Field id="alert-type" label="Type">
                      <Select value={form.type} onValueChange={set("type")}>
                        <SelectTrigger id="alert-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="alert-description" label="Description" wide>
                      <Input
                        id="alert-description"
                        placeholder="Describe when this alert fires..."
                        value={form.description}
                        onChange={setField("description")}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Condition">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="alert-metric" label="Metric">
                      <MetricPicker
                        metrics={localisedMetrics}
                        value={form.metric}
                        onChange={set("metric")}
                        placeholder="Select metric..."
                        triggerClassName="w-full"
                      />
                    </Field>
                    <Field id="alert-operator" label="When it">
                      <Select value={form.operator} onValueChange={set("operator")}>
                        <SelectTrigger id="alert-operator" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATOR_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="alert-value" label="Value">
                      <Input id="alert-value" type="number" min="0" step="0.01" value={form.value} onChange={setField("value")} />
                    </Field>
                    <Field id="alert-period" label="Over">
                      <Select value={form.period} onValueChange={set("period")}>
                        <SelectTrigger id="alert-period" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIOD_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Target Client Groups"
                  action={
                    <SegmentedTabs
                      ariaLabel="Tracking mode"
                      size="sm"
                      value={form.tracking_mode}
                      onValueChange={set("tracking_mode")}
                      items={TRACKING}
                    />
                  }
                >
                  <p className="text-sm text-muted-foreground">
                    {perClient
                      ? "Alert triggers separately for each client that crosses the threshold on their own."
                      : "Alert triggers when the combined value across all selected clients crosses the threshold."}
                  </p>
                  <Input
                    aria-label="Search clients"
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <div className="max-h-[220px] divide-y divide-border overflow-y-auto rounded-control shadow-surface">
                    <label className="flex cursor-pointer items-center gap-3 bg-muted/50 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
                      <Checkbox
                        checked={clientGroups.length > 0 && form.target_group_ids.length === clientGroups.length}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({ ...f, target_group_ids: checked ? clientGroups.map((g) => g.id) : [] }))
                        }
                      />
                      Target All Client Groups
                    </label>
                    {clientGroups
                      .filter((g) => g.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((g) => (
                        <label
                          key={g.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                        >
                          <Checkbox checked={form.target_group_ids.includes(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                          {g.name}
                        </label>
                      ))}
                  </div>
                </Section>
              </div>

              {/* Right column: live preview, frequency and channels */}
              <div className="flex min-w-0 flex-col gap-4 md:sticky md:top-0 md:self-start">
                <Surface as="section" className="flex flex-col gap-4" aria-label="Preview">
                  <div className="flex flex-col items-center gap-1 py-2 text-center">
                    <div className="text-lg font-semibold text-foreground">{form.name || "Unnamed Alert"}</div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      {selectedMetric ? (
                        <>
                          {selectedMetric.icon && (
                            <Image src={selectedMetric.icon} alt="" width={16} height={16} className="opacity-70" />
                          )}
                          {selectedMetric.label}
                        </>
                      ) : (
                        "Select a metric to preview"
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <PreviewRow icon={Target} label="Scope">
                      <Badge className="capitalize">client</Badge>
                    </PreviewRow>
                    <PreviewRow icon={perClient ? User : Layers} label="Tracking">
                      {perClient ? (
                        <Badge tone="primary">
                          <User /> Per Client
                        </Badge>
                      ) : (
                        <Badge>
                          <Layers /> Total
                        </Badge>
                      )}
                    </PreviewRow>
                    <PreviewRow icon={Users} label="Targets">
                      <span className="text-sm font-medium">
                        {form.target_group_ids.length ? `${form.target_group_ids.length} selected` : "None"}
                      </span>
                    </PreviewRow>
                    <PreviewRow icon={Clock} label="Frequency">
                      <Select value={form.frequency} onValueChange={set("frequency")}>
                        <SelectTrigger size="sm" aria-label="Frequency" className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PreviewRow>
                    <PreviewRow icon={Mail} label="Channels">
                      <span className="text-sm font-medium">{form.notification_channels.length} active</span>
                    </PreviewRow>
                  </div>
                </Surface>

                <Section title="Notification Channels">
                  <div className="flex flex-col gap-3">
                    <ChannelRow
                      icon={Bell}
                      label="Internal"
                      checked={form.notification_channels.includes("in_app")}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({
                          ...f,
                          notification_channels: checked
                            ? [...f.notification_channels.filter((c) => c !== "in_app"), "in_app"]
                            : f.notification_channels.filter((c) => c !== "in_app"),
                        }))
                      }
                    />
                    {form.notification_channels.includes("in_app") && (
                      <p className="-mt-1 text-xs text-muted-foreground">Notifications will appear in your Birdy dashboard.</p>
                    )}
                    <ChannelRow icon={Slack} label="Slack" soon disabled checked={false} />
                    <ChannelRow icon={Mail} label="Email" soon disabled checked={false} />
                  </div>
                </Section>
              </div>
            </form>

            <SheetFooter className="shrink-0 flex-row justify-end border-t border-border px-5 py-3">
              <Button onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="create-alert-form" variant="primary" loading={saving}>
                {saving ? "Saving..." : editingAlert ? "Save Changes" : "Create Alert"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
