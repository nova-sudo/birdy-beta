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
import { Plus, Filter, TrendingUp, Calculator, Webhook, BarChart3, Trash2, PieChart, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronDown } from "lucide-react"
import { 
  discoverAllMetrics, 
  getMetricsStatistics,
  getAvailableSources,
  getAvailableDashboards,
  searchMetrics,
  getAvailableMetricsForFormulas 
} from "@/lib/metrics-discovery"

const operators = [
  { value: "+", label: "Add (+)" },
  { value: "-", label: "Subtract (−)" },
  { value: "*", label: "Multiply (×)" },
  { value: "/", label: "Divide (÷)" },
]

const MetricSelector = ({ value, onChange, availableMetrics }) => {
  const [open, setOpen] = useState(false)

  // Group metrics by source
  const metricsBySource = availableMetrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = []
    }
    acc[metric.category].push(metric)
    return acc
  }, {})

  const currentName = availableMetrics.find((m) => m.id === value)?.label || "Select metric..."

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <Tabs defaultValue="all" className="w-fit">
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
          
          <TabsContent value="all" className="border-0 p-0">
            <Command>
              <CommandList>
                <CommandEmpty>No metric found.</CommandEmpty>
                {availableMetrics.map((metric) => (
                  <CommandItem
                    key={metric.id}
                    value={metric.label}
                    onSelect={() => {
                      onChange(metric.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={metric.id === value ? "mr-2 h-4 w-4" : "mr-2 h-4 w-4 opacity-0"} />
                    {metric.label}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </TabsContent>
          
          {Object.entries(metricsBySource).map(([source, metrics]) => (
            <TabsContent key={source} value={source.toLowerCase()} className="border-0 p-0">
              <Command>
                <CommandList>
                  <CommandEmpty>No metric found.</CommandEmpty>
                  {metrics.map((metric) => (
                    <CommandItem
                      key={metric.id}
                      value={metric.label}
                      onSelect={() => {
                        onChange(metric.id)
                        setOpen(false)
                      }}
                    >
                      <Check className={metric.id === value ? "mr-2 h-4 w-4" : "mr-2 h-4 w-4 opacity-0"} />
                      {metric.label}
                    </CommandItem>
                  ))}
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

  // Form state for creating/editing metrics
  const [metricForm, setMetricForm] = useState({
    name: "",
    description: "",
    group: "",
    formulaParts: [{ type: "metric", value: "" }],
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
      "GoHighLevel": { color: "bg-green-50 text-green-700 border-green-200", icon: BarChart3 },
      "Meta Ads": { color: "bg-blue-50 text-blue-700 border-blue-200", icon: TrendingUp },
      "Webhook": { color: "bg-red-50 text-red-700 border-red-200", icon: Webhook },
      "Custom Formula": { color: "bg-purple-50 text-purple-700 border-purple-200", icon: Calculator },
      "Calculated": { color: "bg-orange-50 text-orange-700 border-orange-200", icon: Calculator },
      "System": { color: "bg-gray-50 text-gray-700 border-gray-200", icon: BarChart3 },
      "HotProspector": { color: "bg-pink-50 text-pink-700 border-pink-200", icon: TrendingUp },
    }
    
    const badge = badges[source] || badges["System"]
    const Icon = badge.icon
    
    return (
      <Badge variant="outline" className={`gap-1 ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {source}
      </Badge>
    )
  }

  const getDashboardBadge = (dashboard) => {
    const colors = {
      Clients: "bg-green-100 text-green-800",
      Campaigns: "bg-blue-100 text-blue-800",
      Contacts: "bg-purple-100 text-purple-800",
    }

    return <Badge className={colors[dashboard] || "bg-gray-100 text-gray-800"}>{dashboard}</Badge>
  }

  return (
    <div className="min-h-screen bg-white w-[calc(100dvw-30px)] md:w-[calc(100dvw-80px)]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-3xl py-2 md:py-0 font-bold text-foreground text-center md:text-left whitespace-nowrap">
              Metrics Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center md:text-left">
              {statistics ? `${statistics.total} metrics discovered across all dashboards` : "Loading metrics..."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1">
            <Input
              type="search"
              placeholder="Search metrics..."
              className="bg-white rounded-lg h-10 px-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline" size="sm" className="gap-2 bg-white h-10 font-semibold">
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingMetric(null)
                resetForm()
                setIsCreateDialogOpen(true)
              }}
              className="h-10 bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Plus className="h-4 text-white w-4 border-2 rounded-xl" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
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
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-13 w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm overflow-x-auto md:overflow-x-hidden gap-2 md:gap-0">
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="all">
              All Metrics
            </TabsTrigger>
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="standard">
              Standard Metrics
            </TabsTrigger>
            <TabsTrigger className="text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700" value="custom">
              Custom Formulas
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="border bg-card overflow-hidden rounded-md shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Metric Name</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Source</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Dashboard</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMetrics.map((metric) => (
                      <tr key={metric.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground">{metric.name}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">{metric.description}</div>
                          {metric.isDynamic && (
                            <Badge variant="outline" className="mt-1 text-xs">Dynamic</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">{getSourceBadge(metric.source)}</td>
                        <td className="px-6 py-4">{getDashboardBadge(metric.dashboard)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {metric.category === "custom" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-3 bg-purple-600 text-white hover:bg-purple-700"
                                  onClick={() => handleEditMetric(metric)}
                                >
                                  Edit
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
              <DialogTitle>{editingMetric ? "Edit Metric" : "Create New Metric"}</DialogTitle>
              <DialogDescription>Build a custom metric by combining available metrics</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="metric-name" className="pb-2">Metric Name *</Label>
                <Input
                  id="metric-name"
                  placeholder="e.g., ROI, Cost per Conversion"
                  value={metricForm.name}
                  onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="metric-description" className="pb-2">Description</Label>
                <Textarea
                  id="metric-description"
                  placeholder="Optional description"
                  value={metricForm.description}
                  onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="metric-group" className="pb-2">Dashboard *</Label>
                <Select value={metricForm.group} onValueChange={(value) => setMetricForm({ ...metricForm, group: value })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select dashboard" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Clients">Clients</SelectItem>
                    <SelectItem value="Campaigns">Campaigns</SelectItem>
                    <SelectItem value="Contacts">Contacts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="pb-2">Formula Builder</Label>
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  {metricForm.formulaParts.map((part, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {part.type === "metric" ? (
                        <MetricSelector
                          value={part.value}
                          onChange={(newValue) => updateFormulaPart(index, newValue)}
                          availableMetrics={availableMetricsForFormulas}
                        />
                      ) : (
                        <Select value={part.value} onValueChange={(value) => updateFormulaPart(index, value)}>
                          <SelectTrigger className="w-fit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFormulaPart(index)}
                        disabled={metricForm.formulaParts.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOperation} className="w-full">
                    <Plus className="h-4 w-4 mr-2" /> Add Operation
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="display-dashboard"
                  checked={metricForm.displayOnDashboard}
                  onCheckedChange={(checked) => setMetricForm({ ...metricForm, displayOnDashboard: checked })}
                />
                <Label htmlFor="display-dashboard">Display on dashboard</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleCreateMetric} className="bg-purple-600 text-white hover:bg-purple-700">
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