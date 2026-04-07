"use client"
import { useState, useEffect } from "react"
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
import { Plus, Filter, TrendingUp, Calculator, Webhook, BarChart3, Trash2, PieChart, X, CalculatorIcon } from "lucide-react"
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
import { ghlIcon as ghl, metaIcon as metaa, hpIcon as HP, flaskIcon as Flask } from "@/lib/icons"
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
import { RotateCcw, PlusSquare } from "lucide-react"

const operators = [
  { value: "+", label: "+" },
  { value: "-", label: "−" },
  { value: "*", label: "×" },
  { value: "/", label: "/" },
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
          <TabsList className="text-center w-fit h-fit grid-cols-4 bg-muted/50 border-b px-1 py-2">
            <TabsTrigger value="all" className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-purple-100/50 data-[state=active]:text-foreground data-[state=active]:border-b-3 data-[state=active]:border-b-purple-700 h-full">
              All {availableMetrics.length}
            </TabsTrigger>
            {Object.keys(metricsBySource).map(source => (
              <TabsTrigger
                key={source}
                value={source.toLowerCase()}
                className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-purple-100/50 data-[state=active]:text-foreground data-[state=active]:border-b-3 data-[state=active]:border-b-purple-700 h-full"
              >
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

  // Form state for creating/editing metrics
  const [metricForm, setMetricForm] = useState({
    name: "",
    description: "",
    group: "",
    formulaParts: [{ type: "metric", value: " " }],
    displayOnDashboard: false,
  })

  // Fetch client groups on mount
  useEffect(() => {
    const fetchClientGroups = async () => {
      try {
        const response = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          setClientGroups(data.client_groups || [])
        }
      } catch (error) {
        console.error("Error fetching client groups:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchClientGroups()
  }, [])

  // Discover metrics when client groups are loaded
  useEffect(() => {
    if (clientGroups.length > 0) {
      console.log("🔍 Discovering metrics with", clientGroups.length, "client groups")

      const metrics = discoverAllMetrics(clientGroups)
      setDiscoveredMetrics(metrics)

      const formulaMetrics = getAvailableMetricsForFormulas(clientGroups)
      setAvailableMetricsForFormulas(formulaMetrics)

      const stats = getMetricsStatistics(clientGroups)
      setStatistics(stats)

      console.log("✅ Metrics discovery complete:", stats)
    }
  }, [clientGroups])

  // Load custom metrics from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("customMetrics")
    if (stored) {
      try {
        setCustomMetrics(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to load custom metrics:", e)
      }
    }
  }, [])

  // Save custom metrics to localStorage whenever they change
  useEffect(() => {
    if (customMetrics.length > 0) {
      localStorage.setItem("customMetrics", JSON.stringify(customMetrics))
    }
  }, [customMetrics])

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
      metric.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      metric.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      metric.source.toLowerCase().includes(searchQuery.toLowerCase())

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

  const handleCreateMetric = () => {
    if (!metricForm.name || !metricForm.group) {
      alert("Please fill in all required fields")
      return
    }

    const formulaString = buildFormulaString(metricForm.formulaParts)

    const newMetric = {
      id: `custom-${Date.now()}`,
      name: metricForm.name,
      description: metricForm.description || `Custom metric: ${metricForm.name}`,
      source: "Custom Formula",
      dashboard: metricForm.group,
      formula: formulaString,
      formulaParts: metricForm.formulaParts,
      displayOnDashboard: metricForm.displayOnDashboard,
      category: "custom",
      enabled: true,
    }

    if (editingMetric) {
      setCustomMetrics(
        customMetrics.map((m) => (m.id === editingMetric.id ? { ...newMetric, id: editingMetric.id } : m)),
      )
    } else {
      setCustomMetrics([...customMetrics, newMetric])
    }

    resetForm()
  }

  const resetForm = () => {
    setMetricForm({
      name: "",
      description: "",
      group: "",
      formulaParts: [{ type: "metric", value: availableMetricsForFormulas[0]?.id || "" }],
      displayOnDashboard: false,
    })
    setIsCreateDialogOpen(false)
    setEditingMetric(null)
  }

  const handleEditMetric = (metric) => {
    if (metric.category !== "custom") return

    setEditingMetric(metric)
    setMetricForm({
      name: metric.name,
      description: metric.description,
      group: metric.dashboard,
      formulaParts: metric.formulaParts || [{ type: "metric", value: availableMetricsForFormulas[0]?.id || "" }],
      displayOnDashboard: metric.displayOnDashboard || false,
    })
    setIsCreateDialogOpen(true)
  }

  const handleDeleteMetric = (metricId) => {
    if (confirm("Are you sure you want to delete this metric?")) {
      setCustomMetrics(customMetrics.filter((m) => m.id !== metricId))
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
    <div className="min-h-screen bg-[#f6f8fa] w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto">
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
          <TabsList className="inline-flex h-13 w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm overflow-x-auto md:overflow-x-hidden gap-2 md:gap-0">
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="all">
              All Metrics
            </TabsTrigger>
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="standard">
              Standard Metrics
            </TabsTrigger>
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="webhook">
              Webhook Metrics
            </TabsTrigger>
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="custom">
              Custom Formulas
            </TabsTrigger>
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
          <DialogContent className="sm:max-w-[900px] w-full p-0 gap-0 bg-background overflow-hidden rounded-2xl border border-border/60">

            {/* Header */}
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 bg-white">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {editingMetric ? "Edit Metric" : "Create Metric"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Build a formula by combining metrics and operations.
              </DialogDescription>
            </DialogHeader>

            
              <div className="px-6 pb-4 flex justify-center">
                <div className="bg-white h-25 border border-border/60 rounded-xl p-4 my-4 w-full flex items-center justify-center">
                  <p className="text-sm font-semibold">Your AI assist is coming soon</p>
                </div>
              </div>

              {/* Two-column body */}
            <div className="px-6 pb-6 flex gap-4 items-start">

              {/* Left column */}
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[55vh]">

                {/* Name + Description card */}
                <div className="bg-white border border-border/60 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="metric-name" className="text-base font-semibold text-black mb-0">
                        Metric Name *
                      </Label>
                      <Input
                        id="metric-name"
                        placeholder="e.g., ROI, Cost per Conversion"
                        value={metricForm.name}
                        onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })}
                        className="text-sm bg-[#F9F8FC] border-border/60 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="metric-description" className="text-base font-semibold text-black mb-0">
                        Description
                      </Label>
                      <Input
                        id="metric-description"
                        placeholder="Optional description"
                        value={metricForm.description}
                        onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })}
                        className="text-sm bg-[#F9F8FC] border-border/60 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

               {/* Calculation Logic card */}
                <div className="bg-white border border-border/60 rounded-xl p-4 flex flex-col gap-3">
                  
                  {/* Header with Reset */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Calculation Logic</p>
                    {metricForm.formulaParts.length > 0 && (
                      <button
                        onClick={() => setMetricForm({ ...metricForm, formulaParts: [] })}
                        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Formula chip area */}
                  <div className="bg-background border border-dashed border-border/60 rounded-lg p-3 flex flex-wrap gap-2 items-center min-h-[60px]">
                    {metricForm.formulaParts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Click "Add Metric" to start building your formula
                      </p>
                    ) : (
                      <>
                        {metricForm.formulaParts.map((part, index) =>
                          part.type === "metric" ? (
                            <div key={index} className="flex items-center gap-1">
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-border/60 text-foreground">
                                <MetricSelector
                                  value={part.value}
                                  onChange={(newValue) => updateFormulaPart(index, newValue)}
                                  availableMetrics={availableMetricsForFormulas}
                                />
                                <button
                                  onClick={() => removeFormulaPart(index)}
                                  className="ml-1 hover:opacity-70 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {index < metricForm.formulaParts.length - 1 &&
                                metricForm.formulaParts[index + 1]?.type === "metric" && (
                                  <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 text-purple-600 text-sm font-semibold flex items-center justify-center mx-1">
                                    +
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div
                              key={index}
                              onClick={() => removeFormulaPart(index)}
                              className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 text-purple-600 text-sm font-semibold flex items-center justify-center mx-1 cursor-pointer hover:bg-red-100 hover:border-red-200 hover:text-red-500"
                            >
                              {part.value}
                            </div>
                          )
                        )}

                        {/* Dashed + at the end */}
                        <button
                          onClick={() => {
                            const firstId = availableMetricsForFormulas[0]?.id || ""
                            const newParts =
                              metricForm.formulaParts.length > 0 &&
                              metricForm.formulaParts[metricForm.formulaParts.length - 1].type === "metric"
                                ? [...metricForm.formulaParts, { type: "operator", value: "+" }, { type: "metric", value: firstId }]
                                : [...metricForm.formulaParts, { type: "metric", value: firstId }]
                            setMetricForm({ ...metricForm, formulaParts: newParts })
                          }}
                          className="w-8 h-8 rounded-lg border-2 border-dashed border-border/60 text-muted-foreground hover:border-purple-400 hover:text-purple-500 flex items-center justify-center"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Bottom operator buttons + Add Metric */}
                  <div className="flex items-center gap-2 justify-center flex-wrap pt-1">
                    {operators.map((op) => (
                      <button
                        key={op.value}
                        onClick={() => {
                          if (
                            metricForm.formulaParts.length === 0 ||
                            metricForm.formulaParts[metricForm.formulaParts.length - 1].type === "operator"
                          ) return
                          setMetricForm({
                            ...metricForm,
                            formulaParts: [...metricForm.formulaParts, { type: "operator", value: op.value }],
                          })
                        }}
                        className="w-9 h-9 rounded-full bg-[#713CDD1A] border border-purple-200 text-[#713CDD] text-sm font-semibold hover:bg-purple-200 flex items-center justify-center"
                      >
                        {op.label}
                      </button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const firstId = availableMetricsForFormulas[0]?.id || ""
                        const newParts =
                          metricForm.formulaParts.length > 0 &&
                          metricForm.formulaParts[metricForm.formulaParts.length - 1].type === "metric"
                            ? [...metricForm.formulaParts, { type: "operator", value: "+" }, { type: "metric", value: firstId }]
                            : [...metricForm.formulaParts, { type: "metric", value: firstId }]
                        setMetricForm({ ...metricForm, formulaParts: newParts })
                      }}
                      className="text-xs gap-1.5 rounded-lg border-border/60"
                    >
                      <PlusSquare className="h-3.5 w-3.5" /> Add Metric
                    </Button>
                  </div>

                </div>
              </div>

              {/* Right: preview card */}
              <div className="w-[280px] shrink-0 bg-white border border-border/60 rounded-xl p-5 flex flex-col items-center gap-4 self-stretch">
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 w-full">
                  <p className="text-4xl font-semibold text-foreground">
                    {metricForm.formulaParts.some((p) => p.type === "metric") ? "0" : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {metricForm.name.trim() || "Unnamed Metric"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 break-all mt-0.5">
                    {metricForm.formulaParts.length > 0
                      ? metricForm.formulaParts
                          .map((p) => {
                            if (p.type === "metric") {
                              return availableMetricsForFormulas.find((m) => m.id === p.value)?.label?.replace(/\s/g, "_") || "metric"
                            }
                            return p.value
                          })
                          .join(" ")
                      : "No formula"}
                  </p>
                </div>
                <div className="flex gap-2 w-full">
                  <Select defaultValue="Integer">
                    <SelectTrigger className="flex-1 text-xs bg-white h-8 border-border/60 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Integer">Integer</SelectItem>
                      <SelectItem value="Decimal">Decimal</SelectItem>
                      <SelectItem value="Percentage">Percentage</SelectItem>
                      <SelectItem value="Currency">Currency</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="Total">
                    <SelectTrigger className="flex-1 text-xs bg-white h-8 border-border/60 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Total">Total</SelectItem>
                      <SelectItem value="Average">Average</SelectItem>
                      <SelectItem value="Count">Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t border-border/60 bg-white">
              <Button variant="outline" onClick={resetForm} className="rounded-lg">
                Cancel
              </Button>
              <Button
                onClick={handleCreateMetric}
                className="bg-purple-600 text-white hover:bg-purple-700 rounded-lg"
              >
                {editingMetric ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default MetricsHub