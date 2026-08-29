"use client"
import { useState, useEffect, useMemo } from "react"
import { apiRequest } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Copy, X, Bird, Eye, EyeOff, Search, Pencil, ChevronLeft, ChevronRight } from "lucide-react"
import ChatConversation from "@/components/chat/ChatConversation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronDown } from "lucide-react"
import {
  discoverAllMetrics,
  getMetricsStatistics,
  getAvailableSources,
  getAvailableDashboards,
  searchMetrics,
  getAvailableMetricsForFormulas
} from "@/lib/metrics-discovery"
import { ghlIcon as ghl, metaIcon as metaa, hpIcon as HP, flaskIcon as Flask, ghlIcon, metaIcon } from "@/lib/icons"
import MetricPicker from "@/components/ui/MetricPicker"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { PdSegmented } from "@/components/portfolio"
import { SourceBadge } from "@/components/metrics/SourceBadge"
import { SOURCE_TABS, matchesSourceTab, sourceForCategory } from "@/lib/metric-sources"
import { pageNumbers } from "@/lib/page-numbers"
import { setCustomMetricsCache } from "@/lib/metrics"
import { InboxIcon } from "lucide-react"
import {Hash} from "lucide-react"

const operators = [
  { value: "+", label: "Add (+)" },
  { value: "-", label: "Subtract (−)" },
  { value: "*", label: "Multiply (×)" },
  { value: "/", label: "Divide (÷)" },
]

const MetricSelector = ({ value, onChange, availableMetrics }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeSource, setActiveSource] = useState("all")

  const metricsBySource = availableMetrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = []
    }
    acc[metric.category].push(metric)
    return acc
  }, {})

  const currentName = availableMetrics.find((m) => m.id === value)?.label || "Select metric..."

  const filterMetrics = (metrics) => {
    if (!search) return metrics
    const firstWord = search.trim().split(" ")[0].toLowerCase()
    return metrics.filter((m) => m.label.toLowerCase().startsWith(firstWord))
  }

  const filteredAll = filterMetrics(availableMetrics)
  const filteredBySource = Object.fromEntries(
    Object.entries(metricsBySource).map(([source, metrics]) => [source, filterMetrics(metrics)])
  )

  const handleTabChange = (val) => {
    setActiveSource(val)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch("") }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex-1 justify-between"
        >
          {currentName}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-fit bg-white">
        <Tabs defaultValue="all" className="w-fit" onValueChange={handleTabChange}>
          <TabsList className="w-fit">
            <TabsTrigger value="all">
              All {availableMetrics.length}
            </TabsTrigger>
            {Object.keys(metricsBySource).map(source => (
              <TabsTrigger key={source} value={source.toLowerCase()}>
                {source} {metricsBySource[source].length}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Shared search input */}
          <div className="px-2 py-2 border-b">
            <Input
              placeholder={activeSource === "all" ? "Search all metrics..." : `Search in ${activeSource}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          <TabsContent value="all" className="border-0 p-0">
            <Command shouldFilter={false}>
              <CommandList>
                {filteredAll.length === 0
                  ? <CommandEmpty>No metric found.</CommandEmpty>
                  : filteredAll.map((metric) => (
                    <CommandItem
                      key={metric.id}
                      value={metric.label}
                      onSelect={() => { onChange(metric.id); setOpen(false) }}
                    >
                      <Check className={metric.id === value ? "mr-2 h-4 w-4" : "mr-2 h-4 w-4 opacity-0"} />
                      {metric.label}
                    </CommandItem>
                  ))
                }
              </CommandList>
            </Command>
          </TabsContent>

          {Object.entries(metricsBySource).map(([source, metrics]) => (
            <TabsContent key={source} value={source.toLowerCase()} className="border-0 p-0">
              <Command shouldFilter={false}>
                <CommandList>
                  {filteredBySource[source].length === 0
                    ? <CommandEmpty>No metric found.</CommandEmpty>
                    : filteredBySource[source].map((metric) => (
                      <CommandItem
                        key={metric.id}
                        value={metric.label}
                        onSelect={() => { onChange(metric.id); setOpen(false) }}
                      >
                        <Check className={metric.id === value ? "mr-2 h-4 w-4" : "mr-2 h-4 w-4 opacity-0"} />
                        {metric.label}
                      </CommandItem>
                    ))
                  }
                </CommandList>
              </Command>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

const MetricsHub = () => {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true)
  const itemsPerPage = 15; // Adjust as needed

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
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fieldsRes, metricsRes, hiddenRes] = await Promise.all([
          apiRequest("/api/custom-metrics/available-fields"),
          apiRequest("/api/custom-metrics"),
          apiRequest("/api/user/hidden-metrics"),
        ])
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
          }))
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
            description: "",
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
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Sync custom metrics cache for other modules (metrics.js)
  useEffect(() => {
    setCustomMetricsCache(customMetrics)
  }, [customMetrics])

  // Enrich formula metrics with icons for MetricPicker, and merge user's
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

  const totalPages = Math.ceil(filteredMetrics.length / itemsPerPage);
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // A narrower tab or a search can leave the current page past the end of the
  // list — the table then renders empty with pagination still pointing at
  // page 6 of 2. Snap back rather than showing a blank card.
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, query])

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

  // Title lives in the global top bar, where the design puts it. No controls —
  // this page's search and + button sit in the toolbar over the table.
  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle
          title="Metrics Hub"
          subtitle="Every metric powering your dashboards and formulas"
        />
      ),
    }),
    []
  )
  usePageHeader(header)

  const currentMetrics = filteredMetrics.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      alert("Please fill in a name and select at least one dashboard")
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
      alert(`A metric named "${trimmedName}" already exists. Please choose a different name.`)
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
      alert("Failed to save metric: " + err.message)
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
    if (!confirm("Are you sure you want to delete this metric?")) return
    try {
      const res = await apiRequest(`/api/custom-metrics/${metricId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setCustomMetrics(customMetrics.filter(m => m.id !== metricId))
    } catch (err) {
      alert("Failed to delete metric")
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

  return (
    // Same shell as the Lead and Sales hubs: the design's canvas, its 22/24
    // scroll region, and the pd typefaces the segmented control needs.
    <SalesHubShell>
      <div className="flex flex-col gap-[16px]">
        {/* Toolbar — tab strip left, search + create right. The title moved to
            the global header bar; see `header` above. */}
        <div className="flex flex-wrap items-center gap-[12px]">
          <PdSegmented
            role="tablist"
            label="Metric source"
            panelId="metrics-table"
            options={SOURCE_TABS}
            value={activeTab}
            onChange={setActiveTab}
            className="rounded-[10px]"
            itemClassName="px-[20px] py-[9px] text-[13px] rounded-[8px] whitespace-nowrap"
          />

          <div className="ml-auto flex items-center gap-[10px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-[13px] top-1/2 size-[15px] -translate-y-1/2 text-pd-faint" />
              <Input
                type="search"
                placeholder="Search metrics&hellip;"
                aria-label="Search metrics"
                className="h-[38px] w-[220px] rounded-[10px] border-pd-border bg-pd-surface pl-[36px] text-[13px] placeholder:text-pd-faint"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              aria-label="Create a custom metric"
              onClick={() => {
                setEditingMetric(null)
                setDuplicatingFrom(null)
                setDialogMode("birdy")
                setBirdyChatKey(k => k + 1)
                sessionStorage.removeItem(`birdy_metric_session_${birdyChatKey + 1}`)
                setIsCreateDialogOpen(true)
              }}
              className="size-[38px] rounded-[10px] bg-pd-primary p-0 hover:bg-[#5A3FD6]"
            >
              <Plus className="size-[17px] text-white" />
            </Button>
          </div>
        </div>

        <div id="metrics-table" role="tabpanel" className="overflow-hidden rounded-[16px] border border-pd-border bg-pd-surface">
          <div className="flex items-center border-b border-pd-border bg-pd-table-head px-[22px] py-[13px] text-[11.5px] font-bold tracking-[0.03em] text-pd-faint">
            <div className="flex-1">METRIC NAME</div>
            <div className="hidden flex-[1.4] md:block">NOTES</div>
            <div className="flex-[0_0_200px] text-center">SOURCE</div>
            {/* Custom formulas are the only rows you can edit, duplicate and
                delete; everything else offers show/hide alone. */}
            <div className="flex-[0_0_160px] text-center">
              {activeTab === "custom" ? "CONTROLS" : "SHOW / HIDE"}
            </div>
          </div>

          {isLoading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="flex items-center border-b border-pd-row-border px-[22px] py-[12px]">
                <div className="flex-1 pr-[12px]"><Skeleton className="h-4 w-40" /></div>
                <div className="hidden flex-[1.4] pr-[12px] md:block"><Skeleton className="h-3 w-56" /></div>
                <div className="flex flex-[0_0_200px] justify-center"><Skeleton className="h-6 w-28 rounded-full" /></div>
                <div className="flex flex-[0_0_160px] justify-center gap-[8px]"><Skeleton className="size-[26px] rounded-[8px]" /></div>
              </div>
            ))
          ) : filteredMetrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-pd-faint">
              <div className="flex size-12 items-center justify-center rounded-full bg-pd-divider">
                <InboxIcon className="size-6 text-pd-chevron" />
              </div>
              <p className="text-sm font-medium text-pd-muted">
                {query
                  ? `No metrics match "${searchQuery.trim()}"`
                  : `No ${SOURCE_TABS.find((t) => t.key === activeTab)?.label.toLowerCase() ?? "metrics"} yet`}
              </p>
              <p className="text-xs">
                {activeTab === "custom"
                  ? "Create your first custom metric using the + button above."
                  : "No metrics are available for this source yet."}
              </p>
            </div>
          ) : (
            currentMetrics.map((metric) => {
              const isCustom = metric.source === "custom"
              const isHidden = hiddenMetrics.has(metric.id)

              return (
                <div key={metric.id} className="flex items-center border-b border-pd-row-border px-[22px] py-[12px] last:border-b-0 hover:bg-pd-row-zebra">
                  <div className="min-w-0 flex-1 pr-[12px]">
                    <div className={`truncate text-[13.5px] font-semibold ${isHidden ? "text-pd-faint line-through" : "text-pd-ink"}`}>
                      {metric.name}
                    </div>
                    {/* Below md the NOTES column is gone, so the note rides
                        under the name rather than disappearing. */}
                    {metric.description && (
                      <div className="truncate text-[12.5px] text-pd-subtle md:hidden">{metric.description}</div>
                    )}
                  </div>

                  <div className="hidden min-w-0 flex-[1.4] truncate pr-[12px] text-[12.5px] text-pd-subtle md:block">
                    {metric.description || "\u2013"}
                  </div>

                  <div className="flex flex-[0_0_200px] justify-center">
                    <SourceBadge source={metric.source} />
                  </div>

                  <div className="flex flex-[0_0_160px] items-center justify-center gap-[8px]">
                    {isCustom ? (
                      <>
                        <button
                          type="button"
                          title="Edit metric"
                          aria-label={`Edit ${metric.name}`}
                          onClick={() => handleEditMetric(metric)}
                          className="flex size-[26px] cursor-pointer items-center justify-center rounded-[8px] border border-pd-border text-pd-primary hover:bg-pd-primary-tint"
                        >
                          <Pencil className="size-[14px]" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate metric"
                          aria-label={`Duplicate ${metric.name}`}
                          onClick={() => handleDuplicateMetric(metric)}
                          className="flex size-[26px] cursor-pointer items-center justify-center rounded-[8px] border border-pd-border text-pd-body hover:bg-pd-divider"
                        >
                          <Copy className="size-[14px]" />
                        </button>
                        <button
                          type="button"
                          title="Delete metric"
                          aria-label={`Delete ${metric.name}`}
                          onClick={() => handleDeleteMetric(metric.id)}
                          className="flex size-[26px] cursor-pointer items-center justify-center rounded-[8px] border border-pd-border text-pd-danger hover:bg-pd-danger-surface"
                        >
                          <Trash2 className="size-[14px]" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={isHidden}
                        title={isHidden ? "Show in the formula builder" : "Hide from the formula builder"}
                        aria-label={`${isHidden ? "Show" : "Hide"} ${metric.name}`}
                        onClick={() => toggleMetricVisibility(metric)}
                        className="flex size-[26px] cursor-pointer items-center justify-center rounded-[8px] border border-pd-border text-pd-body hover:bg-pd-divider"
                      >
                        {isHidden ? <EyeOff className="size-[14px]" /> : <Eye className="size-[14px]" />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {!isLoading && totalPages > 1 && (
          <nav aria-label="Metrics pages" className="flex items-center justify-center gap-[6px]">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="flex cursor-pointer items-center gap-[5px] rounded-[9px] px-[14px] py-[8px] text-[13.5px] font-semibold text-pd-body disabled:cursor-default disabled:opacity-40"
            >
              <ChevronLeft className="size-[14px]" />
              Previous
            </button>

            {pageNumbers(currentPage, totalPages).map((n, i) =>
              n === "ellipsis" ? (
                <span key={`gap-${i}`} className="flex h-[36px] min-w-[36px] items-center justify-center text-[13.5px] font-semibold text-pd-faint">
                  &middot;&middot;&middot;
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-current={n === currentPage ? "page" : undefined}
                  onClick={() => handlePageChange(n)}
                  className={`flex h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-[9px] px-[6px] text-[13.5px] font-semibold ${
                    n === currentPage ? "bg-pd-surface text-pd-ink shadow-pd-segment" : "text-pd-body"
                  }`}
                >
                  {n}
                </button>
              )
            )}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="flex cursor-pointer items-center gap-[5px] rounded-[9px] px-[14px] py-[8px] text-[13.5px] font-semibold text-pd-body disabled:cursor-default disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-[14px]" />
            </button>
          </nav>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) resetForm() }}>
          <DialogContent
            className="w-[90vw] !max-w-none h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-background sm:!max-w-none"
            showCloseButton={false}
          >
            {/* Header */}
            <div className="bg-white dark:bg-card px-6 py-4 border-b border-border rounded-t-lg shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold leading-none tracking-tight">
                    {editingMetric ? "Edit Metric" : duplicatingFrom ? "Duplicate Metric" : "Create Metric"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {editingMetric
                      ? "Update the metric configuration."
                      : duplicatingFrom
                        ? <>Editing a copy of <span className="font-medium text-foreground">&ldquo;{duplicatingFrom.name}&rdquo;</span> — choose a unique name before saving.</>
                        : dialogMode === "birdy"
                          ? "Chat with Birdy to build your metric — it'll create it for you."
                          : "Build a formula by combining metrics and operations."}
                  </p>
                </div>
                {!editingMetric && !duplicatingFrom && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/70 border border-border/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDialogMode("birdy")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        dialogMode === "birdy"
                          ? "bg-white text-purple-700 shadow-sm border border-purple-200/60"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Bird className={`h-3.5 w-3.5 ${dialogMode === "birdy" ? "text-purple-500" : "text-muted-foreground"}`} />
                      Ask Birdy
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialogMode("manual")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        dialogMode === "manual"
                          ? "bg-white text-foreground shadow-sm border border-border/60"
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
            {dialogMode === "birdy" && !editingMetric && !duplicatingFrom && (
              <div className="flex-1 min-h-0 flex flex-col bg-[#FAFAFA] overflow-hidden">
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
                <div className="shrink-0 px-6 py-3 border-t border-border bg-white flex justify-end">
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Body — Manual / Edit / Duplicate mode */}
            {(dialogMode === "manual" || editingMetric || duplicatingFrom) && (
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex flex-col gap-6">
                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                  {/* Left column */}
                  <div className="w-full lg:w-2/3 flex-1 space-y-4">
                    {/* Name + Description */}
                    <div className="rounded-lg border border-border bg-card p-6 grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="metric-name" className="block text-base font-semibold mb-1">Metric Name</Label>
                        <Input
                          id="metric-name"
                          placeholder="e.g., Lead-to-Close Ratio"
                          value={metricForm.name}
                          onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })}
                          className={isNameDuplicate ? "border-destructive focus-visible:ring-destructive/30" : ""}
                        />
                        {isNameDuplicate && (
                          <p className="mt-1 text-xs text-destructive">
                            A metric with this name already exists. Pick a different name.
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="metric-description" className="block text-base font-semibold mb-1">Description</Label>
                        <Input
                          id="metric-description"
                          placeholder="Describe what this metric measures"
                          value={metricForm.description}
                          onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Dashboard selector */}
                    <div className="rounded-lg border border-border bg-card p-6">
                      <h4 className="text-base font-semibold text-foreground mb-3">Show on Dashboards</h4>
                      {(() => {
                        const LEVEL_MAP = {
                          meta_spend: "group", meta_impressions: "group", meta_clicks: "group",
                          meta_reach: "group", meta_results: "group", meta_ctr: "group",
                          meta_cpc: "group", meta_cpm: "group", meta_leads: "group",
                          ghl_contacts: "group", ghl_revenue: "group", ghl_conversion: "group",
                          conversion_rate: "group", cost_per_lead: "group", engagement_rate: "group",
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
                              <p className="text-xs text-red-500 font-medium">Cannot mix group-level and campaign-level metrics in the same formula.</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {DASHBOARD_OPTIONS.map(d => {
                                const checked = metricForm.dashboards.includes(d.value)
                                const disabled = mixedLevels || (allowedDashboards && !allowedDashboards.has(d.value))
                                lastGroup = d.group
                                return (
                                  <label
                                    key={d.value}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                      disabled
                                        ? "opacity-40 cursor-not-allowed bg-muted border-border"
                                        : checked
                                          ? "bg-purple-50 border-purple-300 text-purple-700 cursor-pointer"
                                          : "bg-white border-border hover:border-purple-200 cursor-pointer"
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
                                      className="h-3.5 w-3.5"
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
                    <div className="rounded-lg border border-border bg-card p-6 flex-1">
                      <h4 className="text-base font-semibold text-foreground mb-3">Calculation Logic</h4>
                      <div className="min-h-[80px] rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 flex flex-wrap gap-2 items-center">
                        {metricForm.formulaParts.length === 0 || (metricForm.formulaParts.length === 1 && !metricForm.formulaParts[0].value) ? (
                          <span className="text-sm text-muted-foreground">Click &quot;Add Metric&quot; to start building your formula</span>
                        ) : (
                          metricForm.formulaParts.map((part, index) => {
                            if (part.type === "operator") {
                              return (
                                <span key={index} className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-semibold">
                                  {part.value === "*" ? "×" : part.value === "/" ? "÷" : part.value}
                                </span>
                              )
                            }
                            if (part.type === "number") {
                              return (
                                <span key={index} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-sm font-medium shadow-sm text-amber-700">
                                  {part.label ?? part.value}
                                  <button
                                    type="button"
                                    onClick={() => removeFormulaPart(index)}
                                    className="text-amber-400 hover:text-red-500 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              )
                            }
                            const metricLabel =
                              availableMetricsForFormulas.find(m => m.id === part.value)?.label
                              || customMetrics.find(cm => cm.id === part.value)?.name
                              || part.value
                            return (
                              <span key={index} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-sm font-medium shadow-sm">
                                {metricLabel}
                                <button
                                  type="button"
                                  onClick={() => removeFormulaPart(index)}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                  disabled={metricForm.formulaParts.length === 1}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            )
                          })
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-3 mt-4">
                        {/* Operator buttons */}
                        <div className="flex items-center gap-1.5">
                          {["+", "-", "×", "/"].map(op => {
                            const lastPart = metricForm.formulaParts[metricForm.formulaParts.length - 1]
                            const canAddOp = (lastPart?.type === "metric" && lastPart?.value) || lastPart?.type === "number"
                            return (
                              <button
                                key={op}
                                type="button"
                                disabled={!canAddOp}
                                onClick={() => {
                                  const opVal = op === "×" ? "*" : op === "÷" || op === "/" ? "/" : op
                                  setMetricForm(f => ({
                                    ...f,
                                    formulaParts: [...f.formulaParts, { type: "operator", value: opVal }],
                                  }))
                                }}
                                className="w-9 h-9 rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {op}
                              </button>
                            )
                          })}
                        </div>

                        {/* Add Metric */}
                        {(() => {
                          const lastPart = metricForm.formulaParts[metricForm.formulaParts.length - 1]
                          const isEmpty = metricForm.formulaParts.length === 0 || (metricForm.formulaParts.length === 1 && !metricForm.formulaParts[0].value)
                          const canAddMetric = isEmpty || lastPart?.type === "operator"
                          return (
                            <MetricPicker
                              metrics={formulaMetricOptions}
                              value=""
                              disabled={!canAddMetric}
                              placeholder="+ Add Metric"
                              triggerClassName="text-xs h-9 gap-1.5 w-auto"
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
                                  className="text-xs h-9 gap-1.5 w-auto disabled:opacity-30"
                                >
                                  + Add Number
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-3 bg-white">
                                <Input
                                  type="number"
                                  placeholder="e.g. 100"
                                  className="h-8 text-sm"
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
                                <p className="text-[10px] text-muted-foreground mt-1.5">Press Enter to add</p>
                              </PopoverContent>
                            </Popover>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Right column — Preview */}
                  <div className="w-full lg:w-1/3 flex-shrink-0 self-stretch">
                    <div className="rounded-lg border text-card-foreground shadow-sm bg-card h-full flex flex-col">
                      <div className="p-6 pt-6 flex-1 flex flex-col justify-between">
                        <div className="text-center p-4 flex-1 flex flex-col justify-center">
                          <div className="text-4xl font-bold">
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
                          <div className="text-[10px] text-muted-foreground/50 mt-1">sample preview</div>
                          <div className="text-sm text-muted-foreground mt-3">{metricForm.name || "Unnamed Metric"}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {metricForm.formulaParts.length > 0 && metricForm.formulaParts[0].value
                              ? buildFormulaString(metricForm.formulaParts)
                              : "No formula"}
                          </div>
                        </div>
                        <div className="border-t border-border pt-4 mt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <Select
                              value={metricForm.formatType}
                              onValueChange={v => setMetricForm(f => ({ ...f, formatType: v }))}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                <SelectItem value="integer">Integer</SelectItem>
                                <SelectItem value="currency">Currency</SelectItem>
                                <SelectItem value="percentage">Percentage</SelectItem>
                                <SelectItem value="decimal">Decimal</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={metricForm.aggregation}
                              onValueChange={v => setMetricForm(f => ({ ...f, aggregation: v }))}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
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
            )}

            {/* Footer — only shown in manual/edit/duplicate mode */}
            {(dialogMode === "manual" || editingMetric || duplicatingFrom) && (
            <div className="bg-white dark:bg-card px-6 py-4 border-t border-border rounded-b-lg flex-shrink-0">
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>
                <Button
                  onClick={handleCreateMetric}
                  disabled={saving || isNameDuplicate || !_trimmedFormName}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
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
    </SalesHubShell>
  )
}

export default MetricsHub