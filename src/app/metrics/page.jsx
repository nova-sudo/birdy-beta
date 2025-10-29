"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Plus,
  Filter,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Calculator,
  Webhook,
  BarChart3,
  Edit,
  Trash2,
  PieChart,
  X,
} from "lucide-react"

// Predefined standard metrics from GoHighLevel
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

// Predefined standard metrics from Meta Ads
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

// Predefined webhook metrics
// const webhookMetrics = [
//   {
//     id: "zapier-lead-count",
//     name: "Zapier Lead Count",
//     description: "Leads imported via Zapier integration",
//     source: "Webhook",
//     dashboard: "Clients",
//     formula: null,
//     category: "webhook",
//     enabled: true,
//   },
//   {
//     id: "make-webhook-conversions",
//     name: "Make.com Webhook Conversions",
//     description: "Conversions tracked via Make.com webhook",
//     source: "Webhook",
//     dashboard: "Campaign",
//     formula: null,
//     category: "webhook",
//     enabled: true,
//   },
// ]

// Available metrics for formula builder
const availableMetrics = [
  { id: "leads", name: "Leads" },
  { id: "bookings", name: "Bookings" },
  { id: "total-revenue", name: "Total Revenue" },
  { id: "upsell-revenue", name: "Upsell Revenue" },
  { id: "cpl", name: "CPL" },
  { id: "ad-spend", name: "Ad Spend" },
  { id: "clicks", name: "Clicks" },
  { id: "impressions", name: "Impressions" },
  { id: "conversions", name: "Conversions" },
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

  // Combine all metrics
  const allMetrics = [
    ...standardMetrics,
    ...metaMetrics,
    // ...webhookMetrics,
    ...customMetrics,
  ]

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
        customMetrics.map((m) => (m.id === editingMetric.id ? { ...newMetric, id: editingMetric.id } : m))
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
    setCustomMetrics(
      customMetrics.map((m) => (m.id === metricId ? { ...m, enabled: !m.enabled } : m))
    )
  }

  const addOperation = () => {
    setMetricForm({
      ...metricForm,
      formulaParts: [
        ...metricForm.formulaParts,
        { type: "operator", value: "+" },
        { type: "metric", value: "leads" },
      ],
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
    if (source === "Meta Ads") {
      return (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
          <TrendingUp className="w-3 h-3" />
          Meta Ads
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
    const colors = {
      Clients: "bg-green-100 text-green-800",
      Campaign: "bg-blue-100 text-blue-800",
      "Call Centre": "bg-orange-100 text-orange-800",
    }

    return (
      <Badge className={colors[dashboard] || "bg-gray-100 text-gray-800"}>
        {dashboard}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Metrics Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View, create and manage metrics to track important KPIs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search metrics..."
                className="w-[280px] pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingMetric(null)
                resetForm()
                setIsCreateDialogOpen(true)
              }}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Plus className="h-4 text-white w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allMetrics.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Standard Metrics</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{standardMetrics.length + metaMetrics.length}</div>
            </CardContent>
          </Card>
          <Card> 
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhook Metrics</CardTitle>
              <Webhook className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            {/* <CardContent>
              <div className="text-2xl font-bold">{webhookMetrics.length}</div>
            </CardContent> */}
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custom Formulas</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customMetrics.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1">
            <TabsTrigger value="all">All Metrics</TabsTrigger>
            <TabsTrigger value="standard">Standard Metrics</TabsTrigger>
            <TabsTrigger disabled className="disabled:opacity-50 disabled:pointer-events-none disabled:bg-gray-50 disabled:cursor-not-allowed" value="webhook">Webhook Metrics</TabsTrigger>
            <TabsTrigger value="custom">Custom Formulas</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Metrics Table */}
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                        Metric Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                        Source
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                        Dashboard
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                        Metric Controls
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMetrics.map((metric) => (
                      <tr key={metric.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-foreground">{metric.name}</div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {metric.description}
                            </div>
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
                                  className="h-9 px-3 bg-purple-600 disabled:bg-gray-700 text-white  hover:bg-purple-700"
                                  onClick={() => handleEditMetric(metric)}
                                  
                                >
                                  Edit Metric
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-destructive disabled:bg-gray-700 hover:bg-destructive/10"
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
                                className="h-9 px-3 bg-purple-600 text-white disabled:bg-gray-700 hover:bg-purple-700"
                                disabled
                                tooltip="Editing standard/webhook metrics is not allowed"
                              >
                                Edit Metric
                              </Button>
                            )}
                            <div
                            disabled
                              className={`relative disabled:bg-gray-700  inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                metric.enabled ? "bg-purple-600" : "bg-gray-200"
                              }`}
                              onClick={() => metric.category === "custom" && handleToggleMetric(metric.id)}
                            >
                              <span
                              disabled
                                className={`inline-block disabled:bg-gray-700 h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  metric.enabled ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredMetrics.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-12">
                <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No metrics found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  {searchQuery
                    ? "Try adjusting your search terms"
                    : "Create your first custom metric to get started"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Metric Dialog */}
      <Dialog  open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm()
        setIsCreateDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-[600px] bg-white overflow-auto max-h-dvh">
          <DialogHeader>
            <DialogTitle>{editingMetric ? "Edit Custom Metric" : "Create Custom Metric"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Metric Name */}
            <div className="space-y-2">
              <Label htmlFor="metric-name">Metric Name</Label>
              <Input
                id="metric-name"
                placeholder="e.g., Lead-to-Close Ratio"
                value={metricForm.name}
                onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="metric-description">Description (Optional)</Label>
              <Textarea
                id="metric-description"
                placeholder="Describe what this metric measures"
                value={metricForm.description}
                onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Group */}
            <div className="space-y-2 bg-white">
              <Label htmlFor="metric-group">
                Group <span className="text-red-500">*</span>
              </Label>
              <Select
                value={metricForm.group}
                onValueChange={(value) => setMetricForm({ ...metricForm, group: value })}
              >
                <SelectTrigger id="metric-group">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Clients">Clients</SelectItem>
                  <SelectItem value="Campaign">Campaign</SelectItem>
                  <SelectItem value="Call Centre">Call Centre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Formula Builder */}
            <div className="space-y-3 ">
              <Label>Formula Builder</Label>
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                {metricForm.formulaParts.map((part, index) => (
                  <div key={index}>
                    {part.type === "metric" ? (
                      <div className="flex items-center bg-white gap-2">
                        <Select
                          value={part.value}
                          onValueChange={(value) => updateFormulaPart(index, value)}
                        >
                          <SelectTrigger className="bg-purple-100 border-purple-200">
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
                        {metricForm.formulaParts.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => removeFormulaPart(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Select
                          value={part.value}
                          onValueChange={(value) => updateFormulaPart(index, value)}
                        >
                          <SelectTrigger className="w-32 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addOperation}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Operation
                </Button>
              </div>

              {/* Formula Preview */}
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-sm font-medium text-muted-foreground mb-1">Formula Preview:</div>
                <div className="font-mono text-sm">{buildFormulaString(metricForm.formulaParts)}</div>
              </div>
            </div>

            {/* Display on Dashboard */}
            {/* <div className="flex items-center space-x-2">
              <Checkbox
                id="display-dashboard"
                checked={metricForm.displayOnDashboard}
                onCheckedChange={(checked) =>
                  setMetricForm({ ...metricForm, displayOnDashboard: checked })
                }
              />
              <Label
                htmlFor="display-dashboard"
                className="text-sm font-normal cursor-pointer"
              >
                Display on dashboard
              </Label>
            </div> */}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateMetric}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              Save Metric
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MetricsHub