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

// Predefined standard metrics from GoHighLevel (Clients page)
const standardMetrics = [
  {
    id: "leads",
    name: "Leads",
    description: "Total number of leads generated for the client",
    source: "GoHighLevel",
    dashboard: "Clients",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "bookings",
    name: "Bookings",
    description: "Total number of bookings made by leads",
    source: "GoHighLevel",
    dashboard: "Clients",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "total-revenue",
    name: "Total Revenue",
    description: "Total revenue generated",
    source: "GoHighLevel",
    dashboard: "Clients",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "upsell-revenue",
    name: "Upsell Revenue",
    description: "Revenue from upsell products/services",
    source: "GoHighLevel",
    dashboard: "Clients",
    formula: null,
    category: "standard",
    enabled: true,
  },
]

// Predefined standard metrics from Meta Ads (Clients page)
const metaMetrics = [
  {
    id: "cpl",
    name: "CPL",
    description: "Cost per lead",
    source: "Meta Ads",
    dashboard: "Clients",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "ad-spend",
    name: "Ad Spend",
    description: "Total advertising spend",
    source: "Meta Ads",
    dashboard: "Clients",
    formula: null,
    category: "standard",
    enabled: true,
  },
]

const campaignsMetrics = [
  {
    id: "spend",
    name: "Spend",
    description: "Campaign advertising spend",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "impressions",
    name: "Impressions",
    description: "Number of impressions",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "clicks",
    name: "Clicks",
    description: "Number of clicks",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "cpc",
    name: "CPC",
    description: "Cost per click",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "reach",
    name: "Reach",
    description: "Total reach of campaign",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "ctr",
    name: "CTR",
    description: "Click-through rate",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "frequency",
    name: "Frequency",
    description: "Average frequency per user",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "cpm",
    name: "CPM",
    description: "Cost per thousand impressions",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "campaign-results",
    name: "Results",
    description: "Campaign results/conversions",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
  {
    id: "campaign-leads",
    name: "Campaign Leads",
    description: "Leads from campaign",
    source: "Facebook Ads",
    dashboard: "Campaigns",
    formula: null,
    category: "standard",
    enabled: true,
  },
]

const contactsMetrics = [
  {
    id: "lead-value",
    name: "Lead Value",
    description: "Value of individual leads",
    source: "GoHighLevel",
    dashboard: "Contacts",
    formula: null,
    category: "standard",
    enabled: true,
  },
]

const availableMetrics = [
  // Clients page
  { id: "leads", name: "Leads", dashboard: "Clients" },
  { id: "bookings", name: "Bookings", dashboard: "Clients" },
  { id: "total-revenue", name: "Total Revenue", dashboard: "Clients" },
  { id: "upsell-revenue", name: "Upsell Revenue", dashboard: "Clients" },
  { id: "cpl", name: "CPL", dashboard: "Clients" },
  { id: "ad-spend", name: "Ad Spend", dashboard: "Clients" },
  // Campaigns page
  { id: "spend", name: "Spend", dashboard: "Campaigns" },
  { id: "impressions", name: "Impressions", dashboard: "Campaigns" },
  { id: "clicks", name: "Clicks", dashboard: "Campaigns" },
  { id: "cpc", name: "CPC", dashboard: "Campaigns" },
  { id: "reach", name: "Reach", dashboard: "Campaigns" },
  { id: "ctr", name: "CTR", dashboard: "Campaigns" },
  { id: "frequency", name: "Frequency", dashboard: "Campaigns" },
  { id: "cpm", name: "CPM", dashboard: "Campaigns" },
  { id: "campaign-results", name: "Results", dashboard: "Campaigns" },
  { id: "campaign-leads", name: "Campaign Leads", dashboard: "Campaigns" },
  // Contacts page
  { id: "lead-value", name: "Lead Value", dashboard: "Contacts" },
]

const operators = [
  { value: "+", label: "Add (+)" },
  { value: "-", label: "Subtract (−)" },
  { value: "*", label: "Multiply (×)" },
  { value: "/", label: "Divide (÷)" },
]

const MetricsHub = () => {
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [customMetrics, setCustomMetrics] = useState([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState(null)

  // Form state for creating/editing metrics
  const [metricForm, setMetricForm] = useState({
    name: "",
    description: "",
    group: "",
    formulaParts: [{ type: "metric", value: "leads" }],
    displayOnDashboard: false,
  })

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

  const allMetrics = [...standardMetrics, ...metaMetrics, ...campaignsMetrics, ...contactsMetrics, ...customMetrics]

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
      metric.description.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesTab && matchesSearch
  })

  const buildFormulaString = (parts) => {
    return parts
      .map((part) => {
        if (part.type === "metric") {
          const metric = availableMetrics.find((m) => m.id === part.value)
          return metric ? metric.name : part.value
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

    // Reset form
    resetForm()
  }

  const resetForm = () => {
    setMetricForm({
      name: "",
      description: "",
      group: "",
      formulaParts: [{ type: "metric", value: "leads" }],
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
      formulaParts: metric.formulaParts || [{ type: "metric", value: "leads" }],
      displayOnDashboard: metric.displayOnDashboard || false,
    })
    setIsCreateDialogOpen(true)
  }

  const handleDeleteMetric = (metricId) => {
    if (confirm("Are you sure you want to delete this metric?")) {
      setCustomMetrics(customMetrics.filter((m) => m.id !== metricId))
    }
  }

  const handleToggleMetric = (metricId) => {
    setCustomMetrics(customMetrics.map((m) => (m.id === metricId ? { ...m, enabled: !m.enabled } : m)))
  }

  const addOperation = () => {
    setMetricForm({
      ...metricForm,
      formulaParts: [...metricForm.formulaParts, { type: "operator", value: "+" }, { type: "metric", value: "leads" }],
    })
  }

  const removeFormulaPart = (index) => {
    if (metricForm.formulaParts.length <= 1) return

    const newParts = [...metricForm.formulaParts]
    // Remove the part and adjacent operator if exists
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
    if (source === "GoHighLevel") {
      return (
        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
          <BarChart3 className="w-3 h-3" />
          GoHighLevel
        </Badge>
      )
    }
    if (source === "Meta Ads" || source === "Facebook Ads") {
      return (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
          <TrendingUp className="w-3 h-3" />
          {source}
        </Badge>
      )
    }
    if (source === "Webhook") {
      return (
        <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
          <Webhook className="w-3 h-3" />
          Webhook
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
        <Calculator className="w-3 h-3" />
        Custom Formula
      </Badge>
    )
  }

  const getDashboardBadge = (dashboard) => {
    const normalizedDashboard = dashboard === "Campaign" ? "Campaigns" : dashboard
    const colors = {
      Clients: "bg-green-100 text-green-800",
      Campaigns: "bg-blue-100 text-blue-800",
      Contacts: "bg-purple-100 text-purple-800",
      "Call Centre": "bg-orange-100 text-orange-800",
    }

    return <Badge className={colors[normalizedDashboard] || "bg-gray-100 text-gray-800"}>{normalizedDashboard}</Badge>
  }

  return (
    <div className="min-h-screen bg-white w-[calc(100dvw-30px)] md:w-[calc(100dvw-100px)]">
      <div className="flex flex-col gap-8 ">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex  gap-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-3xl py-2 md:py-0 font-bold text-foreground text-center md:text-left whitespace-nowrap">
                Metrics Hub
              </h1>
              <p className="text-sm text-muted-foreground mt-1 text-center md:text-left">
                View, create and manage metrics from all dashboards - Clients, Campaigns, and Contacts
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 flex-nowrap overflow-x-auto md:gap-1 md:py-1 md:px-1">
            <Input
              type="search"
              placeholder="Search metrics..."
              className="bg-white rounded-lg h-10 px-2 placeholder:text-left placeholder:text-muted-foreground flex items-center 
                  flex-1 min-w-[150px] md:max-w-[120px] md:text-sm"
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
              className=" h-10 bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Plus className="h-4 text-white w-4 border-2 rounded-xl " />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <PieChart className="h-4 w-4 text-muted-foreground text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allMetrics.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Standard Metrics</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-muted-foreground text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {standardMetrics.length + metaMetrics.length + campaignsMetrics.length + contactsMetrics.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Webhook Metrics</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <Webhook className="h-4 w-4 text-muted-foreground text-purple-500" />
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Custom Formulas</CardTitle>
              <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <Calculator className="h-4 w-4 text-muted-foreground text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customMetrics.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full over">
          <TabsList
            className="inline-flex h-13 item-center w-full justify-start  p-1 bg-[#F3F1F999] border border-border/60 shadow-sm 
          overflow-x-auto md:overflow-x-hidden gap-2 md:gap-0"
          >
            <TabsTrigger
              className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
            data-[state=active]:bg-white
            data-[state=active]:text-foreground
            data-[state=active]:shadow-sm
            data-[state=active]:border-r-0
            data-[state=active]:rounded-md
            data-[state=active]:border-b-2
            data-[state=active]:border-b-purple-700"
              value="all"
            >
              All Metrics
            </TabsTrigger>
            <TabsTrigger
              className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
            data-[state=active]:bg-white
            data-[state=active]:text-foreground
            data-[state=active]:shadow-sm
            data-[state=active]:border-r-0
            data-[state=active]:rounded-md
            data-[state=active]:border-b-2
            data-[state=active]:border-b-purple-700"
              value="standard"
            >
              Standard Metrics
            </TabsTrigger>
            <TabsTrigger
              className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
            data-[state=active]:bg-white
            data-[state=active]:text-foreground
            data-[state=active]:shadow-sm
            data-[state=active]:border-r-0
            data-[state=active]:rounded-md
            data-[state=active]:border-b-2
            data-[state=active]:border-b-purple-700"
              value="webhook"
            >
              Webhook Metrics
            </TabsTrigger>
            <TabsTrigger
              className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
            data-[state=active]:bg-white
            data-[state=active]:text-foreground
            data-[state=active]:shadow-sm
            data-[state=active]:border-r-0
            data-[state=active]:rounded-md
            data-[state=active]:border-b-2
            data-[state=active]:border-b-purple-700"
              value="custom"
            >
              Custom Formulas
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Metrics Table */}
            <div className=" border bg-card overflow-hidden rounded-md shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground whitespace-nowrap">
                        Metric Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground whitespace-nowrap">
                        Source
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground whitespace-nowrap">
                        Dashboard
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground whitespace-nowrap">
                        Metric Controls
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMetrics.map((metric) => (
                      <tr key={metric.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-foreground whitespace-nowrap">{metric.name}</div>
                            <div className="text-sm text-muted-foreground mt-0.5">{metric.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getSourceBadge(metric.source)}</td>
                        <td className="px-6 py-4">{getDashboardBadge(metric.dashboard)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {metric.category === "custom" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-3 bg-purple-600 disabled:bg-purple-600/50 text-white  hover:bg-purple-700"
                                  onClick={() => handleEditMetric(metric)}
                                >
                                  Edit Metric
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-destructive disabled:bg-purple-600/50 hover:bg-destructive/10"
                                  onClick={() => handleDeleteMetric(metric.id)}
                                  tooltip="Delete Metric"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {metric.category !== "custom" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 px-3 bg-gray-100 hover:bg-gray-200"
                                disabled
                              >
                                {metric.enabled ? "Enabled" : "Disabled"}
                              </Button>
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

        {/* Create/Edit Metric Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
              <DialogTitle>{editingMetric ? "Edit Metric" : "Create New Metric"}</DialogTitle>
              <DialogDescription>Build a custom metric by combining available metrics with operators</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="metric-name" className="py-3">Metric Name *</Label>
                <Input
                  id="metric-name"
                  placeholder="e.g., ROI, Cost per Conversion"
                  value={metricForm.name}
                  onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="metric-description" className="py-3">Description</Label>
                <Textarea
                  id="metric-description"
                  placeholder="Optional description of what this metric calculates"
                  value={metricForm.description}
                  onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="metric-group" className="py-3">Dashboard *</Label>
                <Select
                  value={metricForm.group}
                  onValueChange={(value) => setMetricForm((prev) => ({ ...prev, group: value }))}
                >
                  <SelectTrigger className="w-full bg-white">
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
                <Label className="py-3">Formula Builder</Label>
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  {metricForm.formulaParts.map((part, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {part.type === "metric" ? (
                        <Select value={part.value} onValueChange={(value) => updateFormulaPart(index, value)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {availableMetrics.map((metric) => (
                              <SelectItem key={metric.id} value={metric.id}>
                                {metric.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={part.value} onValueChange={(value) => updateFormulaPart(index, value)}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
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
                  <Button variant="outline" size="sm" onClick={addOperation} className="w-full bg-transparent">
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
                <Label htmlFor="display-dashboard" className="font-normal">
                  Display on dashboard
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleCreateMetric} className="bg-purple-600 hover:bg-purple-700">
                {editingMetric ? "Update Metric" : "Create Metric"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default MetricsHub
