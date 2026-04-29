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
import { Plus, Filter, TrendingUp, Calculator, Webhook, BarChart3, Trash2, PieChart, X, CalculatorIcon, Zap, SquarePlus } from "lucide-react"
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton"
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
  const [editingMetric, setEditingMetric] = useState(null)
  const [clientGroups, setClientGroups] = useState([])
  const [discoveredMetrics, setDiscoveredMetrics] = useState([])
  const [availableMetricsForFormulas, setAvailableMetricsForFormulas] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true)
  const itemsPerPage = 15; // Adjust as needed

  const [saving, setSaving] = useState(false)

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
        const [fieldsRes, metricsRes] = await Promise.all([
          apiRequest("/api/custom-metrics/available-fields"),
          apiRequest("/api/custom-metrics"),
        ])
        if (fieldsRes.ok) {
          const data = await fieldsRes.json()
          // Build availableMetricsForFormulas from the lightweight response
          const metrics = (data.base_metrics || []).map(m => ({
            id: m.id,
            label: m.label,
            category: m.category,
          }))
          // Add tags
          for (const tag of (data.tags || [])) {
            const tagId = `tag_${tag.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
            metrics.push({ id: tagId, label: `Tag: ${tag}`, category: "Tags" })
          }
          setAvailableMetricsForFormulas(metrics)
          // Build discovered metrics for the table display (map to expected field names)
          setDiscoveredMetrics(metrics.map(m => ({
            id: m.id,
            name: m.label,
            label: m.label,
            source: m.category,
            dashboard: m.category === "Campaigns" ? "Marketing Hub" : m.category === "Tags" ? "Clients" : "All",
            description: "",
            category: m.category === "custom" ? "custom" : "standard",
            enabled: true,
          })))
          setStatistics({ total: metrics.length })
        }
        if (metricsRes.ok) {
          const data = await metricsRes.json()
          const dbMetrics = (data.custom_metrics || []).map(m => ({
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
    const { setCustomMetricsCache } = require("@/lib/metrics")
    setCustomMetricsCache(customMetrics)
  }, [customMetrics])

  // Enrich formula metrics with icons for MetricPicker, and merge user's
  // existing custom metrics so they can be referenced inside another formula.
  // (E.g. create CPA = Meta Spend / Won Opps, then use CPA in another metric.)
  // The metric currently being edited is excluded so users can't directly
  // reference themselves; deeper cycles are caught server-side on save.
  const ICON_MAP = { "Meta Ads": metaIcon, "GoHighLevel": ghlIcon, "Tags": ghlIcon, "Campaigns": metaIcon, "Calculated": Flask, "Custom": Flask }
  const formulaMetricOptions = useMemo(() => {
    const baseOptions = availableMetricsForFormulas.map(m => ({
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
  }, [availableMetricsForFormulas, customMetrics, editingMetric])

  // Combine discovered and custom metrics
  const allMetrics = [...discoveredMetrics, ...customMetrics]

  // Filter metrics based on active tab and search
  const filteredMetrics = allMetrics.filter((metric) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "standard" && metric.category === "standard") ||
      (activeTab === "webhook" && metric.category === "webhook") ||
      (activeTab === "custom" && metric.category === "custom")

    const matchesSearch =
      searchQuery === "" ||
      (metric.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (metric.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (metric.source || "").toLowerCase().includes(searchQuery.toLowerCase())

    return matchesTab && matchesSearch
  })

  const totalPages = Math.ceil(filteredMetrics.length / itemsPerPage);
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

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
    if (!metricForm.name || metricForm.dashboards.length === 0) {
      alert("Please fill in a name and select at least one dashboard")
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
  }

  const handleEditMetric = (metric) => {
    if (metric.category !== "custom") return

    setEditingMetric(metric)
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

  const getSourceBadge = (source) => {
    const badges = {
      "GoHighLevel": {
        color: "text-[#16A34A] bg-[#F0FDF4] font-semibold border-green-200 rounded-full",
        image: ghl
      },
      "Meta Ads": {
        color: "text-[#2563EB] bg-[#EFF6FF] font-semibold border-blue-200 rounded-full",
        image: metaa
      },
      "Webhook": {
        color: "text-[#E11D48] bg-[#FFF1F2] font-semibold border-red-200 rounded-full",
        image: null
      },
      "Custom Formula": {
        color: "text-[#7854EA] bg-[#F5F3FF] font-semibold border-purple-200 rounded-full",
        image: Flask
      },
      "Calculated": {
        color: "text-[#EA580C] bg-[#FFF7ED] font-semibold border-orange-200 rounded-full",
        image: null
      },
      "System": {
        color: "text-[#4B5563] bg-[#F9FAFB] font-semibold border-gray-200 rounded-full",
        image: null
      },
      "HotProspector": {
        color: "text-[#EC4899] bg-[#FCEBF8] font-semibold border-pink-200 rounded-full",
        image: HP
      },
    }

    const badge = badges[source] || badges["System"]

    return (
      <Badge variant="outline" className={`w-fit h-7 ${badge.color}`}>
        {badge.image ? (
          <img
            src={badge.image.src}
            alt={`${source} icon`}
            className="w-4 h-4"
          />
        ) : null}
        {source}
      </Badge>
    )
  }

  const getDashboardBadge = (dashboard) => {
    const colors = {
      Clients: "bg-green-100 text-green-800 rounded-full",
      Campaigns: "bg-blue-100 text-blue-800 rounded-full",
      Contacts: "bg-purple-100 text-purple-800 rounded-full",
    }

    return <Badge className={colors[dashboard] || "bg-gray-100 text-gray-800"}>{dashboard}</Badge>
  }

  // Function to generate pagination items with ellipsis logic
  const renderPaginationItems = () => {
    const items = [];
    const ellipsis = <PaginationItem key="ellipsis"><PaginationEllipsis /></PaginationItem>;

    if (totalPages <= 5) {
      // Show all pages if 5 or fewer
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              isActive={currentPage === i}
              onClick={(e) => { e.preventDefault(); handlePageChange(i); }}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show first 2, last 2, and current with ellipsis
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            href="#"
            isActive={currentPage === 1}
            onClick={(e) => { e.preventDefault(); handlePageChange(1); }}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      if (currentPage > 3) {
        items.push(ellipsis);
      } else {
        items.push(
          <PaginationItem key={2}>
            <PaginationLink
              href="#"
              isActive={currentPage === 2}
              onClick={(e) => { e.preventDefault(); handlePageChange(2); }}
            >
              2
            </PaginationLink>
          </PaginationItem>
        );
      }

      if (currentPage > 2 && currentPage < totalPages - 1) {
        items.push(
          <PaginationItem key={currentPage}>
            <PaginationLink
              href="#"
              isActive={true}
              onClick={(e) => { e.preventDefault(); handlePageChange(currentPage); }}
            >
              {currentPage}
            </PaginationLink>
          </PaginationItem>
        );
      }

      if (currentPage < totalPages - 2) {
        items.push(ellipsis);
      } else {
        items.push(
          <PaginationItem key={totalPages - 1}>
            <PaginationLink
              href="#"
              isActive={currentPage === totalPages - 1}
              onClick={(e) => { e.preventDefault(); handlePageChange(totalPages - 1); }}
            >
              {totalPages - 1}
            </PaginationLink>
          </PaginationItem>
        );
      }

      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            href="#"
            isActive={currentPage === totalPages}
            onClick={(e) => { e.preventDefault(); handlePageChange(totalPages); }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="min-h-screen  w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">
              Metrics Hub
            </h1>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 
          border rounded-lg py-1 px-1">
            <div className="relative">
              <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search metrics..."
                className="bg-white rounded-lg w-fit md:w-55 h-10 px-2 pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className=" bg-white h-10 font-semibold">
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingMetric(null)
                resetForm()
                setIsCreateDialogOpen(true)
              }}
              className="h-10 bg-purple-600 hover:bg-purple-700 "
            >
              <Plus className="h-4 text-white w-4 border-2 rounded-xl" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {/* <div className="grid gap-4 mb-0 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                <PieChart className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {statistics?.dynamicCount || 0} dynamic tags
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Standard Metrics</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.standardCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">By Dashboard</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1 py-2">
                {statistics?.byDashboard && Object.entries(statistics.byDashboard).map(([dash, count]) => (
                  <div key={dash} className="flex justify-between">
                    <span>{dash}:</span>
                    <span className="font-semibold w-6 text-center">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Custom Formulas</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                <Calculator className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customMetrics.length}</div>
            </CardContent>
          </Card>
        </div> */}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-0">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All Metrics</TabsTrigger>
            <TabsTrigger value="standard">Standard Metrics</TabsTrigger>
            <TabsTrigger value="webhook">Webhook Metrics</TabsTrigger>
            <TabsTrigger value="custom">Custom Formulas</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="border bg-card overflow-hidden rounded-md shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="bg-white sticky top-0 z-20 border-b border-border">
                    <tr className="border-b-2 border-[#e4e4e7]">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#71658B]">Metric Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#71658B]">Source</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#71658B]">Dashboard</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#71658B]">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <tr key={`skeleton-${idx}`} className="border-b bg-white">
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-40 mb-2" />
                            <Skeleton className="h-3 w-64" />
                          </td>
                          <td className="px-4 py-3"><Skeleton className="h-6 w-28 rounded-full" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-6 w-20 rounded-full" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-8 w-24 rounded-md" /></td>
                        </tr>
                      ))
                    ) : filteredMetrics.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                              <InboxIcon className="h-6 w-6 text-muted-foreground/60" />
                            </div>
                            <p className="text-sm font-medium">No {activeTab} metrics found</p>
                            <p className="text-xs text-muted-foreground/70">
                              {activeTab === "custom"
                                ? "Create your first custom metric using the + button above."
                                : "No metrics are available for this category yet."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentMetrics.map((metric, idx) => (
                        <tr key={metric.id} className={`hover:bg-muted/50 bg-white`}>
                          <td className="px-4 py-2">
                            <div className="font-semibold text-foreground">{metric.name}</div>
                            <div className="text-sm text-[#71658B] pr-4 truncate">{metric.description}</div>
                            {metric.isDynamic && (
                              <Badge variant="outline" className="mt-1 text-xs">Dynamic</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">{getSourceBadge(metric.source)}</td>
                          <td className="px-4 py-2">{getDashboardBadge(metric.dashboard)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {metric.category === "custom" ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-3 bg-purple-600 text-white hover:bg-purple-700"
                                    onClick={() => handleEditMetric(metric)}
                                  >
                                    Edit Metric
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteMetric(metric.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="outline">Standard</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {!isLoading && totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) handlePageChange(currentPage - 1);
                      }}
                    />
                  </PaginationItem>
                  {renderPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) handlePageChange(currentPage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent
            className="w-[90vw] max-w-none overflow-y-auto max-h-[90vh] p-0 gap-0 bg-background sm:!max-w-none !max-w-none"
            showCloseButton={false}
          >
            {/* Header */}
            <div className="bg-white dark:bg-card px-6 py-4 border-b border-border rounded-t-lg">
              <div className="flex flex-col text-center sm:text-left space-y-1">
                <DialogTitle>{editingMetric ? "Edit Metric" : "Create Metric"}</DialogTitle>
                <DialogDescription>Build a formula by combining metrics and operations.</DialogDescription>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="flex flex-col gap-6">
                {/* Ask Birdy — Coming Soon */}
                <div className="rounded-lg border border-border bg-card p-6 shadow-sm relative overflow-hidden">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">Need help? Ask Birdy to build it for you!</h3>
                      <Badge className="bg-purple-100 text-purple-700 border-0 text-xs font-medium">Coming Soon</Badge>
                    </div>
                    <div className="flex gap-2 mt-3 opacity-50 pointer-events-none">
                      <Input className="flex-1 h-11 rounded-lg" placeholder="e.g. 'Calculate my cost per booking'" disabled />
                      <Button className="h-11 w-11 rounded-lg bg-primary text-primary-foreground shrink-0" disabled>
                        <Zap className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

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
                        />
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

            {/* Footer */}
            <div className="bg-white dark:bg-card px-6 py-4 border-t border-border rounded-b-lg">
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>
                <Button onClick={handleCreateMetric} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {saving ? "Saving..." : (editingMetric ? "Update Metric" : "Save Metric")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default MetricsHub