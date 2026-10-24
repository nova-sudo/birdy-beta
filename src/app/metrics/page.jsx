"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { apiRequest } from "@/lib/api"
import {
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  confirm,
} from "@/components/ds"
import { Plus, Trash2, Copy, X, Eye, EyeOff, Search, Pencil, InboxIcon } from "lucide-react"
import ChatConversation from "@/components/chat/ChatConversation"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { flaskIcon as Flask, ghlIcon, metaIcon, hpIcon as HP } from "@/lib/icons"
import { FormulaMetricPicker } from "@/components/metrics/FormulaMetricPicker"
import { SourceBadge } from "@/components/metrics/SourceBadge"
import { toast } from "sonner"
import { usePageHeader } from "@/components/page-header"
import { SOURCE_TABS, matchesSourceTab, sourceForCategory } from "@/lib/metric-sources"
import { setCustomMetricsCache } from "@/lib/metrics"
import { DEFAULT_METRICS } from "@/lib/default-metrics"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 15

export default function MetricsHub() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [customMetrics, setCustomMetrics] = useState([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState("birdy") // "birdy" | "manual"
  const [birdyChatKey, setBirdyChatKey] = useState(0)
  const [editingMetric, setEditingMetric] = useState(null)
  // Source metric when the dialog is open in "duplicate" mode (null otherwise).
  // We track it separately from editingMetric so save still POSTs as a new row
  // — duplicating must never overwrite the source.
  const [duplicatingFrom, setDuplicatingFrom] = useState(null)
  const [clientGroups, setClientGroups] = useState([])
  const [discoveredMetrics, setDiscoveredMetrics] = useState([])
  const [availableMetricsForFormulas, setAvailableMetricsForFormulas] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE })
  const [loadError, setLoadError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [saving, setSaving] = useState(false)
  // Metric ids this user has hidden with the show/hide eye. Kept as a Set so
  // the row render is a lookup rather than a scan of the whole catalog.
  const [hiddenMetrics, setHiddenMetrics] = useState(() => new Set())

  // Form state for creating/editing metrics
  const [metricForm, setMetricForm] = useState({
    name: "",
    description: "",
    dashboards: [],
    formulaParts: [{ type: "metric", value: "" }],
    formatType: "integer",
    aggregation: "total",
  })

  // Fetch available fields (lightweight) and custom metrics on mount
  const fetchData = useCallback(async () => {
      setLoadError(false)
      try {
        const [fieldsRes, metricsRes, hiddenRes] = await Promise.all([
          apiRequest("/api/custom-metrics/available-fields"),
          apiRequest("/api/custom-metrics"),
          apiRequest("/api/user/hidden-metrics"),
        ])
        if (!fieldsRes.ok && !metricsRes.ok) throw new Error("Metric catalog unavailable")
        if (hiddenRes.ok) {
          const data = await hiddenRes.json()
          setHiddenMetrics(new Set(data.hidden || []))
        }
        if (fieldsRes.ok) {
          const data = await fieldsRes.json()
          // Build availableMetricsForFormulas from the lightweight response
          const metrics = (data.base_metrics || []).map(m => ({
            id: m.id,
            label: m.label,
            category: m.category,
            level: m.level,
            description: m.description || "",
          }))
          // Birdy's own metrics are computed client-side (lib/default-metrics.js)
          // rather than served by the catalog endpoint, so merge them in here.
          // They land in the table like any other base metric — badged Birdy,
          // show/hide as their only control, no delete. Skipped if the backend
          // ever starts shipping one of them itself.
          for (const dm of DEFAULT_METRICS) {
            if (metrics.some(m => m.id === dm.id)) continue
            metrics.push({
              id: dm.id,
              label: dm.label,
              category: dm.category,
              level: dm.level,
              description: dm.description || "",
            })
          }
          // Add tags
          for (const tag of (data.tags || [])) {
            const tagId = `tag_${tag.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
            metrics.push({ id: tagId, label: `Tag: ${tag}`, category: "Tags", level: "group" })
          }
          // Account-level metrics (e.g. per-agent call-center KPIs) are account-wide
          // and can't be resolved per client group, so they'd silently evaluate to 0
          // inside a custom formula — exclude them from the formula builder. They
          // still appear in the catalog table (discoveredMetrics) below.
          setAvailableMetricsForFormulas(metrics.filter(m => m.level !== "account"))
          // Build discovered metrics for the table display (map to expected field names)
          setDiscoveredMetrics(metrics.map(m => ({
            id: m.id,
            name: m.label,
            label: m.label,
            source: sourceForCategory(m.category),
            dashboard: m.category === "Campaigns" ? "Marketing Hub" : m.category === "Tags" ? "Clients" : "All",
            description: m.description || "",
            category: m.category === "custom" ? "custom" : "standard",
            enabled: true,
          })))
        }
        if (metricsRes.ok) {
          const data = await metricsRes.json()
          const dbMetrics = (data.custom_metrics || []).map(m => ({
            id: m.id,
            name: m.name,
            description: m.description || "",
            source: "custom",
            dashboard: (m.dashboards || []).join(", "),
            dashboards: m.dashboards || [],
            formula: m.formula_display || "",
            formulaParts: m.formula_parts || [],
            formatType: m.format_type || "integer",
            aggregation: m.aggregation || "total",
            displayOnDashboard: true,
            category: "custom",
            enabled: true,
          }))
          setCustomMetrics(dbMetrics)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Sync custom metrics cache for other modules (metrics.js)
  useEffect(() => {
    setCustomMetricsCache(customMetrics)
  }, [customMetrics])

  // Enrich formula metrics with icons for the formula picker, and merge user's
  // existing custom metrics so they can be referenced inside another formula.
  // (E.g. create CPA = Meta Spend / Won Opps, then use CPA in another metric.)
  // The metric currently being edited is excluded so users can't directly
  // reference themselves; deeper cycles are caught server-side on save.
  const ICON_MAP = { "Meta Ads": metaIcon, "GoHighLevel": ghlIcon, "Tags": ghlIcon, "Campaigns": metaIcon, "Calculated": Flask, "Custom": Flask, "HotProspector": HP, "Call Center": HP, "Call Center Agents": HP }
  const formulaMetricOptions = useMemo(() => {
    const baseOptions = availableMetricsForFormulas
      // Hiding a metric takes it out of the picker. Formulas that already
      // reference one keep evaluating — hiding governs what you're offered
      // next, it isn't a delete.
      .filter(m => !hiddenMetrics.has(m.id))
      .map(m => ({
        ...m,
        icon: ICON_MAP[m.category] || null,
      }))
    const editingId = editingMetric?.id
    const customOptions = customMetrics
      .filter(cm => cm.id !== editingId)
      .map(cm => ({
        id: cm.id,
        label: cm.name,
        category: "Custom",
        icon: Flask,
      }))
    return [...baseOptions, ...customOptions]
  }, [availableMetricsForFormulas, customMetrics, editingMetric, hiddenMetrics])

  // Combine discovered and custom metrics
  const allMetrics = [...discoveredMetrics, ...customMetrics]

  // Filter by the active source tab and the search box. The tabs are the
  // metric's SOURCE now — Meta, GHL, Sales, Birdy, Tags — not the old
  // standard/webhook split, which named an implementation detail nobody
  // outside the codebase could act on.
  const query = searchQuery.trim().toLowerCase()
  const filteredMetrics = allMetrics.filter((metric) => {
    const matchesSearch =
      query === "" ||
      (metric.name || "").toLowerCase().includes(query) ||
      (metric.description || "").toLowerCase().includes(query)

    return matchesSourceTab(activeTab, metric.source) && matchesSearch
  })

  // Show/hide eye. Optimistic: the row flips immediately and reverts if the
  // write fails, because a toggle that waits on a round trip feels broken.
  const toggleMetricVisibility = async (metric) => {
    const willHide = !hiddenMetrics.has(metric.id)
    setHiddenMetrics((prev) => {
      const next = new Set(prev)
      if (willHide) next.add(metric.id)
      else next.delete(metric.id)
      return next
    })
    try {
      const res = await apiRequest("/api/user/hidden-metrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_id: metric.id, hidden: willHide }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setHiddenMetrics(new Set(data.hidden || []))
    } catch {
      setHiddenMetrics((prev) => {
        const next = new Set(prev)
        if (willHide) next.delete(metric.id)
        else next.add(metric.id)
        return next
      })
      toast.error("Could not save", {
        description: `"${metric.name}" is still ${willHide ? "visible" : "hidden"}.`,
      })
    }
  }

  const openCreateDialog = useCallback(() => {
    setEditingMetric(null)
    setDuplicatingFrom(null)
    setDialogMode("birdy")
    setBirdyChatKey(k => {
      sessionStorage.removeItem(`birdy_metric_session_${k + 1}`)
      return k + 1
    })
    setIsCreateDialogOpen(true)
  }, [])

  // The page's own title is in the PageHeader below; the top bar only names the page.
  const topBar = useMemo(() => ({ title: "Metrics" }), [])
  usePageHeader(topBar)

  const buildFormulaString = (parts) => {
    return parts
      .map((part) => {
        if (part.type === "metric") {
          const metric = availableMetricsForFormulas.find((m) => m.id === part.value)
          return metric ? metric.label : part.value
        }
        return part.value
      })
      .join(" ")
  }

  const handleCreateMetric = async () => {
    const trimmedName = (metricForm.name || "").trim()
    if (!trimmedName || metricForm.dashboards.length === 0) {
      toast.error("Please fill in a name and select at least one dashboard")
      return
    }

    // Uniqueness check on custom metric names (case-insensitive).
    // When editing, exclude the metric being edited. When duplicating or
    // creating, any case-insensitive match is a duplicate — this is what
    // enforces "you have to change the name" on duplicate.
    const lowerName = trimmedName.toLowerCase()
    const conflict = customMetrics.find(m =>
      (m.name || "").trim().toLowerCase() === lowerName &&
      m.id !== editingMetric?.id
    )
    if (conflict) {
      toast.error(`A metric named "${trimmedName}" already exists. Please choose a different name.`)
      return
    }

    setSaving(true)
    const formulaString = buildFormulaString(metricForm.formulaParts)

    const payload = {
      name: metricForm.name,
      description: metricForm.description || "",
      formula_parts: metricForm.formulaParts,
      formula_display: formulaString,
      dashboards: metricForm.dashboards,
      format_type: metricForm.formatType || "integer",
      aggregation: metricForm.aggregation || "total",
    }

    try {
      if (editingMetric) {
        const res = await apiRequest(`/api/custom-metrics/${editingMetric.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to update metric")
        setCustomMetrics(customMetrics.map(m =>
          m.id === editingMetric.id
            ? { ...m, ...payload, formula: formulaString, dashboard: payload.dashboards.join(", "), formatType: payload.format_type, aggregation: payload.aggregation }
            : m
        ))
      } else {
        const res = await apiRequest("/api/custom-metrics", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to create metric")
        const data = await res.json()
        const newMetric = {
          id: data.metric.id,
          name: payload.name,
          description: payload.description,
          source: "Custom Formula",
          dashboard: payload.dashboards.join(", "),
          dashboards: payload.dashboards,
          formula: formulaString,
          formulaParts: payload.formula_parts,
          formatType: payload.format_type,
          aggregation: payload.aggregation,
          displayOnDashboard: true,
          category: "custom",
          enabled: true,
        }
        setCustomMetrics([...customMetrics, newMetric])
      }
      resetForm()
    } catch (err) {
      toast.error("Failed to save metric", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setMetricForm({
      name: "",
      description: "",
      dashboards: [],
      formulaParts: [{ type: "metric", value: availableMetricsForFormulas[0]?.id || "" }],
      formatType: "integer",
      aggregation: "total",
    })
    setIsCreateDialogOpen(false)
    setEditingMetric(null)
    setDuplicatingFrom(null)
  }

  const handleEditMetric = (metric) => {
    if (metric.category !== "custom") return

    setEditingMetric(metric)
    setDuplicatingFrom(null)
    setDialogMode("manual")
    setMetricForm({
      name: metric.name,
      description: metric.description || "",
      dashboards: metric.dashboards || (metric.dashboard ? [metric.dashboard.toLowerCase()] : []),
      formulaParts: metric.formulaParts || [{ type: "metric", value: availableMetricsForFormulas[0]?.id || "" }],
      formatType: metric.formatType || "integer",
      aggregation: metric.aggregation || "total",
    })
    setIsCreateDialogOpen(true)
  }

  const handleDuplicateMetric = (metric) => {
    if (metric.category !== "custom") return

    // Pre-fill with "{name} (copy)", incrementing the suffix if needed so the
    // suggested name doesn't collide with an existing metric. The user can
    // still type their own name; the uniqueness check in handleCreateMetric
    // is what actually enforces "the name must change".
    const baseName = `${metric.name} (copy)`
    const existingNames = new Set(
      customMetrics.map(m => (m.name || "").trim().toLowerCase())
    )
    let suggestedName = baseName
    let counter = 2
    while (existingNames.has(suggestedName.trim().toLowerCase())) {
      suggestedName = `${metric.name} (copy ${counter})`
      counter += 1
    }

    setEditingMetric(null)       // explicitly NOT edit mode — save will POST
    setDuplicatingFrom(metric)
    setDialogMode("manual")
    setMetricForm({
      name: suggestedName,
      description: metric.description || "",
      dashboards: [...(metric.dashboards || [])],
      formulaParts: metric.formulaParts
        ? metric.formulaParts.map(p => ({ ...p }))
        : [{ type: "metric", value: availableMetricsForFormulas[0]?.id || "" }],
      formatType: metric.formatType || "integer",
      aggregation: metric.aggregation || "total",
    })
    setIsCreateDialogOpen(true)
  }

  const handleDeleteMetric = async (metricId) => {
    const confirmed = await confirm({
      title: "Delete this metric?",
      description: "Dashboards and formulas that use it will stop showing it. This can't be undone.",
      confirmLabel: "Delete",
    })
    if (!confirmed) return
    try {
      const res = await apiRequest(`/api/custom-metrics/${metricId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setCustomMetrics(customMetrics.filter(m => m.id !== metricId))
    } catch (err) {
      toast.error("Failed to delete metric")
    }
  }

  const addOperation = () => {
    const firstMetricId = availableMetricsForFormulas[0]?.id || ""
    setMetricForm({
      ...metricForm,
      formulaParts: [...metricForm.formulaParts, { type: "operator", value: "+" }, { type: "metric", value: firstMetricId }],
    })
  }

  const removeFormulaPart = (index) => {
    if (metricForm.formulaParts.length <= 1) return

    const newParts = [...metricForm.formulaParts]
    if (index > 0 && newParts[index - 1].type === "operator") {
      newParts.splice(index - 1, 2)
    } else if (index < newParts.length - 1 && newParts[index + 1].type === "operator") {
      newParts.splice(index, 2)
    } else {
      newParts.splice(index, 1)
    }
    setMetricForm({ ...metricForm, formulaParts: newParts })
  }

  const updateFormulaPart = (index, value) => {
    const newParts = [...metricForm.formulaParts]
    newParts[index].value = value
    setMetricForm({ ...metricForm, formulaParts: newParts })
  }

  // ── Derived validation used by the metric dialog ─────────────────────────
  // Case-insensitive duplicate-name check across custom metrics. When editing,
  // the metric being edited is excluded. When duplicating or creating, any
  // match counts as a duplicate. Drives both the inline error message and
  // the Save button's disabled state.
  const _trimmedFormName = (metricForm.name || "").trim()
  const isNameDuplicate = !!_trimmedFormName && customMetrics.some(m =>
    (m.name || "").trim().toLowerCase() === _trimmedFormName.toLowerCase() &&
    m.id !== editingMetric?.id
  )


  // A narrower tab or a search can leave the current page past the end of the
  // list; start over from page 1 rather than showing a blank table.
  useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }, [activeTab, query])

  const iconButton = "size-8 rounded-full p-0"
  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Metric name",
        meta: { label: "Metric name" },
        cell: ({ row }) => {
          const metric = row.original
          return (
            <div className={cn("truncate text-sm font-medium", hiddenMetrics.has(metric.id) ? "text-muted-foreground line-through" : "text-foreground")}>
              {metric.name}
            </div>
          )
        },
      },
      {
        accessorKey: "description",
        header: "Notes",
        meta: { label: "Notes" },
        cell: ({ row }) => (
          <span className="block max-w-md truncate text-sm text-muted-foreground">{row.original.description || "–"}</span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        meta: { label: "Source" },
        cell: ({ row }) => <SourceBadge source={row.original.source} />,
      },
      {
        id: "controls",
        // Custom formulas are the only rows you can edit, duplicate and
        // delete; everything else offers show/hide alone.
        header: () => (activeTab === "custom" ? "Controls" : "Show / hide"),
        meta: { label: activeTab === "custom" ? "Controls" : "Show / hide" },
        enableSorting: false,
        cell: ({ row }) => {
          const metric = row.original
          const isHidden = hiddenMetrics.has(metric.id)
          if (metric.source === "custom") {
            return (
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon-sm"
                  className={iconButton}
                  title="Edit metric"
                  aria-label={`Edit ${metric.name}`}
                  onClick={() => handleEditMetric(metric)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  className={iconButton}
                  title="Duplicate metric"
                  aria-label={`Duplicate ${metric.name}`}
                  onClick={() => handleDuplicateMetric(metric)}
                >
                  <Copy />
                </Button>
                <Button
                  size="icon-sm"
                  className={cn(iconButton, "text-danger")}
                  title="Delete metric"
                  aria-label={`Delete ${metric.name}`}
                  onClick={() => handleDeleteMetric(metric.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            )
          }
          return (
            <Button
              size="icon-sm"
              className={iconButton}
              aria-pressed={isHidden}
              title={isHidden ? "Show in the formula builder" : "Hide from the formula builder"}
              aria-label={`${isHidden ? "Show" : "Hide"} ${metric.name}`}
              onClick={() => toggleMetricVisibility(metric)}
            >
              {isHidden ? <EyeOff /> : <Eye />}
            </Button>
          )
        },
      },
    ],
    // The handlers close over page state but only read it when clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenMetrics, activeTab, customMetrics, availableMetricsForFormulas]
  )

  const emptyLabel = SOURCE_TABS.find((t) => t.key === activeTab)?.label.toLowerCase() ?? "metrics"
  const tabItems = SOURCE_TABS.map((t) => ({ value: t.key, label: t.label }))
  const showBirdy = dialogMode === "birdy" && !editingMetric && !duplicatingFrom
  const showManual = dialogMode === "manual" || editingMetric || duplicatingFrom

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Metrics Hub"
        description="Every metric powering your dashboards and formulas"
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search metrics&hellip;"
                aria-label="Search metrics"
                className="w-full pl-9 sm:w-56"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="primary" aria-label="Create metric" onClick={openCreateDialog}>
              <Plus />
              <span className="hidden sm:inline">Create metric</span>
            </Button>
          </>
        }
      />

      <div className="max-w-full overflow-x-auto">
        <SegmentedTabs ariaLabel="Metric source" items={tabItems} value={activeTab} onValueChange={setActiveTab} />
      </div>

      <div id="metrics-table" role="tabpanel" aria-label="Metrics">
        {loadError ? (
          <ErrorState title="Couldn't load metrics" onRetry={() => { setIsLoading(true); fetchData() }} />
        ) : (
          <DataTable
            columns={columns}
            data={filteredMetrics}
            loading={isLoading}
            pageSize={PAGE_SIZE}
            getRowId={(row) => row.id}
            state={{ pagination }}
            onStateChange={(next) => setPagination(next.pagination)}
            empty={
              <EmptyState
                icon={InboxIcon}
                title={query ? `No metrics match "${searchQuery.trim()}"` : `No ${emptyLabel} yet`}
                description={
                  activeTab === "custom"
                    ? "Create your first custom metric using the Create metric button above."
                    : "No metrics are available for this source yet."
                }
              />
            }
          />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) resetForm() }}>
        <DialogContent
          className="flex h-[88vh] w-[min(1120px,94vw)] max-w-none flex-col gap-0 overflow-hidden bg-muted p-0 sm:max-w-none"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-border bg-background px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {editingMetric ? "Edit Metric" : duplicatingFrom ? "Duplicate Metric" : "Create Metric"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {editingMetric
                    ? "Update the metric configuration."
                    : duplicatingFrom
                      ? <>Editing a copy of <span className="font-medium text-foreground">&ldquo;{duplicatingFrom.name}&rdquo;</span> — choose a unique name before saving.</>
                      : dialogMode === "birdy"
                        ? "Chat with Birdy to build your metric — it'll create it for you."
                        : "Build a formula by combining metrics and operations."}
                </DialogDescription>
              </div>
              {!editingMetric && !duplicatingFrom && (
                <SegmentedTabs
                  ariaLabel="How to build the metric"
                  value={dialogMode}
                  onValueChange={setDialogMode}
                  items={[
                    {
                      value: "birdy",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <BirdyAvatar size={18} />
                          Ask Birdy
                        </span>
                      ),
                    },
                    { value: "manual", label: "Manual" },
                  ]}
                />
              )}
            </div>
          </div>

            {/* Body — Birdy AI mode */}
            {showBirdy && (
              <div className="flex-1 min-h-0 flex flex-col bg-muted overflow-hidden">
                <div className="flex-1 min-h-0 h-full overflow-hidden">
                  <ChatConversation
                    key={birdyChatKey}
                    page="custom_metrics"
                    sessionKey={`birdy_metric_session_${birdyChatKey}`}
                    initialMessage="Hi, I want to create a new custom metric"
                    bubbleWidthClass="max-w-[85%]"
                    composerCompact
                    composerPlaceholder="Type your answer..."
                    showQuickActions={false}
                    quickStarters={[
                      { label: "Cost per booking", prompt: "Help me create a cost per booking metric" },
                      { label: "Lead-to-close ratio", prompt: "I want a lead-to-close ratio metric" },
                      { label: "Revenue per lead", prompt: "Create a revenue per lead metric" },
                      { label: "CPL formula", prompt: "Build a cost per lead formula" },
                    ]}
                    emptyStateTitle="Let's build a metric"
                    emptyStateSubtitle="Tell me what you want to measure and I'll set it up for you."
                    onToolUsed={(toolName) => {
                      if (toolName === "create_custom_metric") {
                        apiRequest("/api/custom-metrics").then(async (res) => {
                          if (res.ok) {
                            const data = await res.json()
                            setCustomMetrics((data.custom_metrics || []).map(m => ({
                              id: m.id,
                              name: m.name,
                              description: m.description || "",
                              source: "Custom Formula",
                              dashboard: (m.dashboards || []).join(", "),
                              dashboards: m.dashboards || [],
                              formula: m.formula_display || "",
                              formulaParts: m.formula_parts || [],
                              formatType: m.format_type || "integer",
                              aggregation: m.aggregation || "total",
                              displayOnDashboard: true,
                              category: "custom",
                              enabled: true,
                            })))
                          }
                        })
                      }
                    }}
                  />
                </div>
                <div className="shrink-0 px-7 py-3 border-t border-border bg-background flex justify-end">
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Body — Manual / Edit / Duplicate mode */}
            {showManual && (
            <div className="px-7 py-6 overflow-y-auto flex-1">
              <div className="flex flex-col gap-6">
                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                  {/* Left column */}
                  <div className="w-full lg:w-2/3 flex-1 space-y-4">
                    {/* Name + Description */}
                    <div className="rounded-surface border border-border bg-background p-6 shadow-surface grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="metric-name" className="text-xs font-semibold text-foreground">Metric Name</Label>
                        <Input
                          id="metric-name"
                          placeholder="e.g., Lead-to-Close Ratio"
                          value={metricForm.name}
                          onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })}
                          aria-invalid={isNameDuplicate || undefined}
                        />
                        {isNameDuplicate && (
                          <p className="text-xs text-danger">
                            A metric with this name already exists. Pick a different name.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metric-description" className="text-xs font-semibold text-foreground">Description</Label>
                        <Input
                          id="metric-description"
                          placeholder="Describe what this metric measures"
                          value={metricForm.description}
                          onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Dashboard selector */}
                    <div className="rounded-surface border border-border bg-background p-6 shadow-surface space-y-4">
                      <h3 className="text-base font-semibold text-foreground">Show on Dashboards</h3>
                      {(() => {
                        const LEVEL_MAP = {
                          meta_spend: "group", meta_impressions: "group", meta_clicks: "group",
                          meta_reach: "group", meta_results: "group", meta_ctr: "group",
                          meta_cpc: "group", meta_cpm: "group", meta_leads: "group",
                          ghl_contacts: "group", ghl_revenue: "group", ghl_conversion: "group",
                          conversion_rate: "group", cost_per_lead: "group", engagement_rate: "group",
                          roas: "group",
                          spend: "campaign", impressions: "campaign", clicks: "campaign",
                          reach: "campaign", results: "campaign", leads: "campaign",
                          ctr: "campaign", cpc: "campaign", cpm: "campaign",
                          frequency: "campaign", cpl: "campaign", cost_per_result: "campaign",
                          opportunityValue: "lead",
                        }
                        const LEVEL_DASHBOARDS = {
                          group: ["clients"],
                          campaign: ["campaigns", "adsets", "ads"],
                          lead: ["leads", "marketing_leads"],
                        }
                        const formulaMetricIds = metricForm.formulaParts
                          .filter(p => p.type === "metric" && p.value)
                          .map(p => p.value)
                        const levels = new Set(formulaMetricIds.map(id => LEVEL_MAP[id]).filter(Boolean))
                        const detectedLevel = levels.size === 1 ? [...levels][0] : null
                        const mixedLevels = levels.size > 1
                        const allowedDashboards = detectedLevel ? new Set(LEVEL_DASHBOARDS[detectedLevel]) : null

                        const DASHBOARD_OPTIONS = [
                          { value: "clients", label: "Client Groups", group: "Group Level" },
                          { value: "campaigns", label: "Campaigns", group: "Campaign Level" },
                          { value: "adsets", label: "Ad Sets", group: "Campaign Level" },
                          { value: "ads", label: "Ads", group: "Campaign Level" },
                          { value: "leads", label: "Leads Hub", group: "Lead Level" },
                          { value: "marketing_leads", label: "Marketing Hub — Leads", group: "Lead Level" },
                        ]

                        let lastGroup = ""
                        return (
                          <div className="space-y-2">
                            {mixedLevels && (
                              <p className="text-xs font-semibold text-danger">Cannot mix group-level and campaign-level metrics in the same formula.</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {DASHBOARD_OPTIONS.map(d => {
                                const checked = metricForm.dashboards.includes(d.value)
                                const disabled = mixedLevels || (allowedDashboards && !allowedDashboards.has(d.value))
                                lastGroup = d.group
                                return (
                                  <label
                                    key={d.value}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                      disabled
                                        ? "opacity-40 cursor-not-allowed bg-muted border-border text-body"
                                        : checked
                                          ? "bg-primary-soft border-primary/40 text-primary cursor-pointer"
                                          : "bg-background border-border text-body hover:border-primary/40 cursor-pointer"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={disabled}
                                      onCheckedChange={(c) => {
                                        setMetricForm(f => ({
                                          ...f,
                                          dashboards: c
                                            ? [...f.dashboards, d.value]
                                            : f.dashboards.filter(x => x !== d.value),
                                        }))
                                      }}
                                      className="size-3.5"
                                    />
                                    {d.label}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Calculation Logic */}
                    <div className="rounded-surface border border-border bg-background p-6 shadow-surface flex-1 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Calculation Logic</h3>
                        <p className="text-xs text-muted-foreground mt-1">Reads left to right, like a sentence.</p>
                      </div>
                      <div className="min-h-22 rounded-surface border border-dashed border-border bg-muted px-4 py-3 flex flex-wrap gap-2 items-center">
                        {metricForm.formulaParts.length === 0 || (metricForm.formulaParts.length === 1 && !metricForm.formulaParts[0].value) ? (
                          <span className="text-xs text-muted-foreground">Click &quot;Add Metric&quot; to start building your formula</span>
                        ) : (
                          metricForm.formulaParts.map((part, index) => {
                            if (part.type === "operator") {
                              return (
                                <span key={index} className="flex size-7 items-center justify-center rounded-full bg-muted text-sm font-bold text-body">
                                  {part.value === "*" ? "×" : part.value === "/" ? "÷" : part.value}
                                </span>
                              )
                            }
                            if (part.type === "number") {
                              return (
                                <span key={index} className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold tabular-nums text-warning-ink">
                                  {part.label ?? part.value}
                                  <button
                                    type="button"
                                    aria-label="Remove number"
                                    onClick={() => removeFormulaPart(index)}
                                    className="opacity-60 hover:opacity-100 hover:text-danger transition-colors"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              )
                            }
                            const metricLabel =
                              availableMetricsForFormulas.find(m => m.id === part.value)?.label
                              || customMetrics.find(cm => cm.id === part.value)?.name
                              || part.value
                            return (
                              <span key={index} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                                {metricLabel}
                                <button
                                  type="button"
                                  aria-label={`Remove ${metricLabel}`}
                                  onClick={() => removeFormulaPart(index)}
                                  className="opacity-60 hover:opacity-100 hover:text-danger transition-colors disabled:opacity-30"
                                  disabled={metricForm.formulaParts.length === 1}
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            )
                          })
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* Operator buttons */}
                        <div className="flex items-center gap-1.5">
                          {["+", "-", "×", "/"].map(op => {
                            const lastPart = metricForm.formulaParts[metricForm.formulaParts.length - 1]
                            const canAddOp = (lastPart?.type === "metric" && lastPart?.value) || lastPart?.type === "number"
                            return (
                              <Button
                                key={op}
                                type="button"
                                size="icon-sm"
                                className="rounded-full text-sm font-semibold"
                                aria-label={`Add ${op}`}
                                disabled={!canAddOp}
                                onClick={() => {
                                  const opVal = op === "×" ? "*" : op === "÷" || op === "/" ? "/" : op
                                  setMetricForm(f => ({
                                    ...f,
                                    formulaParts: [...f.formulaParts, { type: "operator", value: opVal }],
                                  }))
                                }}
                              >
                                {op}
                              </Button>
                            )
                          })}
                        </div>

                        {/* Add Metric */}
                        {(() => {
                          const lastPart = metricForm.formulaParts[metricForm.formulaParts.length - 1]
                          const isEmpty = metricForm.formulaParts.length === 0 || (metricForm.formulaParts.length === 1 && !metricForm.formulaParts[0].value)
                          const canAddMetric = isEmpty || lastPart?.type === "operator"
                          return (
                            <FormulaMetricPicker
                              metrics={formulaMetricOptions}
                              value=""
                              disabled={!canAddMetric}
                              placeholder="+ Add Metric"
                              className="w-auto"
                              onChange={(metricId) => {
                                if (isEmpty) {
                                  setMetricForm(f => ({ ...f, formulaParts: [{ type: "metric", value: metricId }] }))
                                } else {
                                  setMetricForm(f => ({
                                    ...f,
                                    formulaParts: [...f.formulaParts, { type: "metric", value: metricId }],
                                  }))
                                }
                              }}
                            />
                          )
                        })()}

                        {/* Add Number */}
                        {(() => {
                          const lastPart = metricForm.formulaParts[metricForm.formulaParts.length - 1]
                          const isEmpty = metricForm.formulaParts.length === 0 || (metricForm.formulaParts.length === 1 && !metricForm.formulaParts[0].value)
                          const canAddNumber = isEmpty || lastPart?.type === "operator"
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={!canAddNumber}
                                  className="w-auto"
                                >
                                  + Add Number
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-3">
                                <Input
                                  type="number"
                                  placeholder="e.g. 100"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = parseFloat(e.target.value)
                                      if (!isNaN(val)) {
                                        setMetricForm(f => {
                                          const currentParts = f.formulaParts
                                          const currentIsEmpty = currentParts.length === 0 || (currentParts.length === 1 && !currentParts[0].value)
                                          return {
                                            ...f,
                                            formulaParts: currentIsEmpty
                                              ? [{ type: "number", value: val, label: String(val) }]
                                              : [...currentParts, { type: "number", value: val, label: String(val) }],
                                          }
                                        })
                                        e.target.value = ""
                                      }
                                    }
                                  }}
                                />
                                <p className="text-xs text-muted-foreground mt-1.5">Press Enter to add</p>
                              </PopoverContent>
                            </Popover>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Right column — Preview */}
                  <div className="w-full lg:w-1/3 flex-shrink-0 self-stretch">
                    <div className="rounded-surface border border-border bg-background shadow-surface h-full flex flex-col">
                      <div className="p-6 pt-6 flex-1 flex flex-col justify-between">
                        <div className="text-center p-4 flex-1 flex flex-col justify-center">
                          <div className="text-2xl font-bold tabular-nums text-foreground">
                            {(() => {
                              const parts = metricForm.formulaParts
                              if (!parts.length || !parts[0].value) return "–"
                              const lastPart = parts[parts.length - 1]
                              if (lastPart.type === "operator") return "–"
                              const sampleData = {
                                meta_spend: 1000, spend: 1000, meta_impressions: 50000, impressions: 50000,
                                meta_clicks: 1500, clicks: 1500, meta_reach: 20000, reach: 20000,
                                meta_results: 120, results: 120, leads: 120, meta_leads: 120,
                                meta_ctr: 3.0, ctr: 3.0, meta_cpc: 0.67, cpc: 0.67,
                                meta_cpm: 20.0, cpm: 20.0, ghl_contacts: 200, frequency: 2.5,
                                conversion_rate: 8.0, cost_per_lead: 8.33, engagement_rate: 3.24,
                                ghl_revenue: 4200, roas: 4.2,
                              }
                              // Recursively resolve a metric reference's sample value.
                              // For built-ins, look up sampleData. For custom metrics
                              // (id starts with "custom_"), recurse into their formula.
                              // `seen` prevents infinite loops on cycles.
                              const resolveMetricSample = (id, seen = new Set()) => {
                                if (sampleData[id] !== undefined) return Number(sampleData[id])
                                if (seen.has(id)) return 0  // cycle guard
                                if (id?.startsWith("custom_")) {
                                  const cm = customMetrics.find(m => m.id === id)
                                  if (cm?.formulaParts?.length) {
                                    const sub = new Set(seen).add(id)
                                    try {
                                      const subExpr = cm.formulaParts.map(p => {
                                        if (p.type === "operator") return p.value === "×" ? "*" : p.value === "÷" ? "/" : p.value
                                        return String(resolveMetricSample(p.value, sub))
                                      }).join(" ")
                                      const subResult = Function(`"use strict"; return (${subExpr})`)()
                                      return isFinite(subResult) ? subResult : 0
                                    } catch { return 0 }
                                  }
                                }
                                return 100  // default sample for unknown ids
                              }
                              try {
                                const expr = parts.map(p => {
                                  if (p.type === "operator") return p.value === "×" ? "*" : p.value === "÷" ? "/" : p.value
                                  if (p.type === "number") return String(p.value)
                                  return String(resolveMetricSample(p.value))
                                }).join(" ")
                                const result = Function(`"use strict"; return (${expr})`)()
                                if (!isFinite(result)) return "–"
                                const fmt = metricForm.formatType
                                if (fmt === "currency") return `$${result.toFixed(2)}`
                                if (fmt === "percentage") return `${(result * 100).toFixed(1)}%`
                                if (fmt === "decimal") return result.toFixed(2)
                                return Math.round(result).toLocaleString()
                              } catch { return "–" }
                            })()}
                          </div>
                          <div className="text-xs font-bold uppercase text-muted-foreground mt-2">sample preview</div>
                          <div className="text-base font-semibold text-foreground mt-4">{metricForm.name || "Unnamed Metric"}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {metricForm.formulaParts.length > 0 && metricForm.formulaParts[0].value
                              ? buildFormulaString(metricForm.formulaParts)
                              : "No formula"}
                          </div>
                        </div>
                        <div className="border-t border-border pt-4 mt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-foreground">Format</Label>
                              <Select
                                value={metricForm.formatType}
                                onValueChange={v => setMetricForm(f => ({ ...f, formatType: v }))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background">
                                  <SelectItem value="integer">Integer</SelectItem>
                                  <SelectItem value="currency">Currency</SelectItem>
                                  <SelectItem value="percentage">Percentage</SelectItem>
                                  <SelectItem value="decimal">Decimal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-foreground">Aggregation</Label>
                              <Select
                                value={metricForm.aggregation}
                                onValueChange={v => setMetricForm(f => ({ ...f, aggregation: v }))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background">
                                  <SelectItem value="total">Total</SelectItem>
                                  <SelectItem value="average">Average</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Footer — only shown in manual/edit/duplicate mode */}
            {showManual && (
            <div className="bg-background px-7 py-4 border-t border-border flex-shrink-0">
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>
                <Button
                  onClick={handleCreateMetric}
                  disabled={saving || isNameDuplicate || !_trimmedFormName}
                >
                  {saving
                    ? "Saving..."
                    : editingMetric
                      ? "Update Metric"
                      : duplicatingFrom
                        ? "Save Duplicate"
                        : "Save Metric"}
                </Button>
              </div>
            </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
