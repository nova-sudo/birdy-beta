"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect, useMemo, useRef } from "react"
import { useColumnViews } from "@/lib/useColumnViews"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import StyledTable from "@/components/ui/table-container"
import { presetToDateRange } from "@/lib/date-utils"
import { apiRequest } from "@/lib/api"
import { buildContactColumns } from "@/lib/contact-columns"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ghlIcon as ghlIco, metaIcon as metaIco, flaskIcon as flaskIco } from "@/lib/icons"
import { ErrorBanner } from "@/components/ErrorBanner"
import { flaskIcon as Flask, ghlIcon as ghl } from "@/lib/icons"
import { FilterPanel } from "@/components/ui/Filterpanel.jsx"

// The Lead Hub is drawn on the design system in
// design_handoff_hubs/Birdy Style Guide.md, against
// design_handoff_hubs/Lead Hub.dc.html — Poppins for headings and numerals,
// Inter for body, on the --pd-* tokens in globals.css. The Portfolio Dashboard
// and the Marketing Hub came from the same bundle, so both are already
// implemented and this screen scopes them rather than restating them.
import { portfolioFontClass } from "@/app/dashboard/fonts"
import { ClientGroupPicker } from "@/components/campaigns/ClientGroupPicker"
import { useHeaderSlot } from "@/components/dashboard-controls"
import { CHART_LOADING, InsightCard, LoadingPulse, PdCard, PdSegmented, StatTile, TrendChart } from "@/components/portfolio"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeadHubData } from "@/components/contacts/useLeadHubData"
import { DATE_PRESETS } from "@/lib/constants"
import { Percent, Target, TrendingUp, UserCheck, Users, XCircle } from "lucide-react"

const baseContactColumns = buildContactColumns()

// Which icon and colour family each KPI tile wears, from the handoff's tile
// table — except for the conversion rate. The design draws a trending-down
// arrow there because its sample period happened to fall; an icon that states
// the direction misreads every period that rises, so the tile wears a percent
// sign and lets the delta pill carry the movement. The amber chip is the
// design's.
const LEAD_KPI_PRESENTATION = {
  leads: { icon: UserCheck, tone: "primary" },
  contacts: { icon: Users, tone: "info" },
  opportunities: { icon: Target, tone: "success" },
  open: { icon: TrendingUp, tone: "primary" },
  lost: { icon: XCircle, tone: "danger" },
  conversionRate: { icon: Percent, tone: "amber" },
}

export function LeadsContent({
  clientGroups,
  groupsLoading,
  datePreset,
  setDatePreset,
  showGroupFilter = true,
  showHeader = true,
}) {
  const [contacts, setContacts] = useState([])
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(13)
  const [customMetrics, setCustomMetrics] = useState([])
  const [gridOpen, setGridOpen] = useState(false)
  const [groupSearch, setGroupSearch] = useState("")
  const gridRef = useRef(null)

  const [filterOptions, setFilterOptions] = useState({ sources: [], types: [], tags: [] })

  // Close grid on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gridRef.current && !gridRef.current.contains(e.target)) {
        setGridOpen(false)
        setGroupSearch("")
      }
    }
    if (gridOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [gridOpen])

  useEffect(() => {
    apiRequest("/api/custom-metrics").then(async res => {
      if (!res.ok) return
      const data = await res.json()
      setCustomMetrics((data.custom_metrics || []).filter(m =>
        (m.dashboards || []).includes("leads")
      ).map(m => ({
        id: m.id, name: m.name, description: m.description || "",
        source: "Custom Formula", dashboard: "leads",
        dashboards: m.dashboards || [], formula: m.formula_display || "",
        formulaParts: m.formula_parts || [], formatType: m.format_type || "integer",
        displayOnDashboard: true, category: "custom", enabled: true,
      })))
    }).catch(() => {})
  }, [])

  const [currentPage, setCurrentPage] = useState(1)
  const { savedColumns, saveView: saveToDB, saveViewDebounced, viewsLoaded } = useColumnViews("contacts")

  // Filter to GHL groups only
  const ghlClientGroups = useMemo(
    () => clientGroups.filter(g => g.ghl_location_id),
    [clientGroups]
  )

  // Extract unique tags from client groups for individual tag columns
  const availableTags = useMemo(() => {
    const tagSet = new Set()
    for (const g of clientGroups) {
      const breakdown = g.gohighlevel?.metrics?.tag_breakdown || g.gohighlevel_cache?.metrics?.tag_breakdown || {}
      for (const tag of Object.keys(breakdown)) tagSet.add(tag)
    }
    return [...tagSet].sort()
  }, [clientGroups])

  const contactColumns = useMemo(() => {
    const custom = customMetrics.map(m => ({
      id: m.id,
      header: m.name,
      label: m.name,
      defaultVisible: false,
      sortable: true,
      icons: Flask,
      category: "custom",
      cell: (row) => row?.[m.id] ?? "–",
    }))

    const tagCols = availableTags.map(tag => ({
      id: `tag_${tag.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`,
      header: tag,
      label: `Tag: ${tag}`,
      defaultVisible: false,
      sortable: true,
      icons: ghl,
      category: "tags",
      _tagName: tag,
      cell: (_, row) => row?.tags?.includes(tag) ? "✅" : "–",
    }))

    return [...baseContactColumns, ...custom, ...tagCols]
  }, [customMetrics, availableTags])

  const [visibleColumns, setVisibleColumns] = useState(
    baseContactColumns.filter((col) => col.defaultVisible).map((col) => col.id)
  )
  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setVisibleColumns(savedColumns)
  }, [viewsLoaded, savedColumns])

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedType, setSelectedType] = useState("all")
  const [selectedOpportunityStatus, setSelectedOpportunityStatus] = useState("all")
  const [selectedTags, setSelectedTags] = useState([])
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")
  const [selectedClientGroup, setSelectedClientGroup] = useState(() => {
    if (!showGroupFilter && clientGroups.length === 1) {
      return clientGroups[0].id
    }
    return "all"
  })
  const [selectedCategory, setSelectedCategory] = useState("columns")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const [chartMetric, setChartMetric] = useState("leads")

  const dateRangeLabel = useMemo(
    () => DATE_PRESETS.find(p => p.value === datePreset)?.label ?? datePreset,
    [datePreset]
  )

  // The headline figures for the window, the window before it, and the rows the
  // four curves are bucketed from. Separate from the table's own query on
  // purpose — see useLeadHubData.
  const { kpis, insight, chartMetrics, chartFor, statsLoading, seriesLoading } = useLeadHubData({
    datePreset,
    selectedClientGroup,
    dateRangeLabel,
    ready: !groupsLoading && ghlClientGroups.length > 0,
  })

  const chart = useMemo(() => chartFor(chartMetric), [chartFor, chartMetric])

  const chartTabs = useMemo(
    () => Object.entries(chartMetrics).map(([key, m]) => ({ key, tab: m.tab })),
    [chartMetrics]
  )

  const kpiTiles = useMemo(
    () => kpis.map(k => ({ ...k, ...(LEAD_KPI_PRESENTATION[k.key] ?? {}) })),
    [kpis]
  )

  const columnVisibilityMap = useMemo(
    () => contactColumns.reduce(
      (acc, col) => ({ ...acc, [col.id]: visibleColumns.includes(col.id) }),
      {}
    ),
    [visibleColumns]
  )

  // ── Fetch filter options from backend ──────────────────────────────────────
  useEffect(() => {
    if (ghlClientGroups.length === 0) return

    const groupsParam =
      selectedClientGroup !== "all"
        ? selectedClientGroup
        : ghlClientGroups.map(g => g.id).join(",")

    const { start_date, end_date } = presetToDateRange(datePreset)

    let url = `/api/leads/filter-options?groups=${groupsParam}`
    if (start_date) url += `&start_date=${start_date}`
    if (end_date) url += `&end_date=${end_date}`

    apiRequest(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFilterOptions(data) })
      .catch(() => {})
  }, [selectedClientGroup, ghlClientGroups.length, datePreset])

  // Derived filter options — sources & tags come from the backend endpoint;
  // types & opportunityStatuses are still derived from loaded contacts.
  const sources = filterOptions.sources
  const allTags = filterOptions.tags
  const types = useMemo(
    () => [...new Set(contacts.map(c => c.contactType || c.type).filter(Boolean))].sort(),
    [contacts]
  )
  const opportunityStatuses = useMemo(
    () => [...new Set(contacts.map(c => c.opportunityStatus).filter(Boolean))].sort(),
    [contacts]
  )

  const fetchContacts = async (page = 1, overrides = {}) => {
    setLoading(true)
    setError(null)
    try {
      if (ghlClientGroups.length === 0) {
        setContacts([])
        setMetaData({ total_contacts: 0, has_next: false, has_prev: false })
        setLoading(false)
        return
      }

      const groupsParam = selectedClientGroup !== "all" ? selectedClientGroup : ""
      const { start_date, end_date } = presetToDateRange(datePreset)

      const activeSources = overrides.sources ?? selectedSources
      const activeTags = overrides.tags ?? selectedTags
      const activeStatus = overrides.opportunityStatus ?? selectedOpportunityStatus

      let endpoint = `/api/leads/unified?groups=${groupsParam}&page=${page}&limit=15`
      if (start_date) endpoint += `&start_date=${start_date}`
      if (end_date) endpoint += `&end_date=${end_date}`
      activeSources.forEach(s => { endpoint += `&source=${encodeURIComponent(s)}` })
      activeTags.forEach(t => { endpoint += `&tag=${encodeURIComponent(t)}` })
      if (activeStatus && activeStatus !== "all") endpoint += `&opportunity_status=${encodeURIComponent(activeStatus)}`

      const response = await apiRequest(endpoint)
      if (!response.ok) throw new Error(`Failed: ${response.status}`)

      const data = await response.json()
      setContacts(data.contacts || [])
      setMetaData(data.meta || { total_contacts: 0, has_next: false, has_prev: false })
      setCurrentPage(page)

    } catch (err) {
      setError(err.message)
      setContacts([])
      setMetaData(null)
    } finally {
      setLoading(false)
    }
  }

  // When embedded for a single group, auto-select it once groups load
  useEffect(() => {
    if (!showGroupFilter && ghlClientGroups.length === 1 && selectedClientGroup === "all") {
      setSelectedClientGroup(ghlClientGroups[0].id)
    }
  }, [showGroupFilter, ghlClientGroups, selectedClientGroup])

  // Re-fetch whenever the preset, group filter, or group list changes
  useEffect(() => {
    if (ghlClientGroups.length > 0) {
      fetchContacts(1)
    }
  }, [selectedClientGroup, ghlClientGroups.length, datePreset, selectedSources, selectedTags, selectedOpportunityStatus])

  useEffect(() => {
    const intervals = [33, 50, 66, 80, 90]
    let step = 0
    const timer = setInterval(() => {
      setProgress(intervals[step])
      step++
      if (step >= intervals.length) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredAndSortedContacts = useMemo(() => {
    let filtered = [...contacts]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.contactName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.website?.toLowerCase().includes(q) ||
        c.address1?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.groupName?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedType !== "all") {
      filtered = filtered.filter(c => (c.contactType || c.type) === selectedType)
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal = a[sortColumn] ?? ""
        let bVal = b[sortColumn] ?? ""
        if (sortColumn === "dateAdded") {
          aVal = aVal ? new Date(aVal).getTime() : 0
          bVal = bVal ? new Date(bVal).getTime() : 0
        }
        if (sortColumn === "leadValue") {
          aVal = aVal || 0
          bVal = bVal || 0
        }
        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }
        return (aVal < bVal ? -1 : 1) * (sortDirection === "asc" ? 1 : -1)
      })
    }

    return filtered
  }, [contacts, searchQuery, selectedType, selectedOpportunityStatus, sortColumn, sortDirection])

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedSources([])
    setSelectedType("all")
    setSelectedOpportunityStatus("all")
    if (setDatePreset) setDatePreset("last_7d")
    setSelectedClientGroup("all")
    setSelectedTags([])
    setSortColumn("")
    setSortDirection("asc")
  }

  const hasActiveFilters =
    searchQuery ||
    selectedSources.length > 0 ||
    selectedType !== "all" ||
    selectedOpportunityStatus !== "all" ||
    selectedClientGroup !== "all" ||
    selectedTags.length > 0 ||
    datePreset !== "last_7d"

  const categories = [
    { id: "columns", label: "Columns" },
    { id: "sources", label: "Sources" },
    { id: "types", label: "Types" },
    { id: "opportunities", label: "Opportunities" },
    { id: "tags", label: "Tags" },
  ]

  const filteredColumns = useMemo(() => {
    switch (selectedCategory) {
      case "columns":
        return contactColumns.filter(col =>
          col.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      case "sources":
        return sources
          .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(s => ({ id: s, label: s, visible: selectedSources.includes(s) }))
      case "types":
        return types
          .filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(t => ({ id: t, label: t, visible: selectedType === t }))
      case "opportunities":
        return opportunityStatuses
          .filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(o => ({ id: o, label: o, visible: selectedOpportunityStatus === o }))
      case "tags":
        return allTags
          .filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(t => ({ id: t, label: t, visible: selectedTags.includes(t) }))
      default:
        return []
    }
  }, [selectedCategory, searchTerm, sources, types, opportunityStatuses, allTags, selectedSources, selectedType, selectedOpportunityStatus, selectedTags])

  const toggleColumnVisibility = (id) => {
    switch (selectedCategory) {
      case "columns":
        setVisibleColumns(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        break
      case "sources":
        setSelectedSources(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        break
      case "types":
        setSelectedType(prev => prev === id ? "all" : id)
        break
      case "opportunities":
        setSelectedOpportunityStatus(prev => prev === id ? "all" : id)
        break
      case "tags":
        setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        break
    }
  }

  const selectAll = () => {
    switch (selectedCategory) {
      case "columns": setVisibleColumns(contactColumns.map(c => c.id)); break
      case "tags": setSelectedTags(allTags); break
      default: break
    }
  }

  const clearAll = () => {
    switch (selectedCategory) {
      case "columns": setVisibleColumns([]); break
      case "sources": setSelectedSources([]); break
      case "types": setSelectedType("all"); break
      case "opportunities": setSelectedOpportunityStatus("all"); break
      case "tags": setSelectedTags([]); break
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) fetchContacts(currentPage - 1)
  }
  const handleNextPage = () => {
    if (metaData?.has_next) fetchContacts(currentPage + 1)
  }

  const gridItems = useMemo(() => [
    { id: "all", name: "All Groups" },
    ...ghlClientGroups.slice(0, 49),
  ], [ghlClientGroups])

  const selectedGroupLabel = useMemo(() => {
    if (selectedClientGroup === "all" || !selectedClientGroup) return "All Groups"
    return ghlClientGroups.find(g => g.id === selectedClientGroup)?.name ?? "All Groups"
  }, [selectedClientGroup, ghlClientGroups])

  const filteredGridItems = useMemo(() =>
    gridItems.filter(item =>
      item.name.toLowerCase().includes(groupSearch.toLowerCase())
    ),
    [gridItems, groupSearch]
  )

  // ── Top-bar slots ─────────────────────────────────────────────────────────
  // The handoff puts the title and both filters in the 64px header bar rather
  // than on the page. That bar is src/app/layout.jsx's, rendered above this
  // component in the tree, so the two are joined through the context in
  // dashboard-controls instead of by markup.
  //
  // `showHeader` is false where LeadsContent is embedded in the client detail
  // page; that copy must not claim the top bar from the route that owns it.
  const headerControls = useMemo(() => {
    if (!showHeader) return null

    return (
      <div className="flex items-center gap-[10px]">
        {setDatePreset && <DateRangeSelect value={datePreset} onChange={setDatePreset} />}
        {showGroupFilter && ghlClientGroups.length > 0 && (
          <ClientGroupPicker
            gridRef={gridRef}
            open={gridOpen}
            setOpen={setGridOpen}
            label={selectedGroupLabel}
            search={groupSearch}
            setSearch={setGroupSearch}
            items={filteredGridItems}
            selectedId={selectedClientGroup}
            onSelect={setSelectedClientGroup}
          />
        )}
      </div>
    )
    // Every value read here is either primitive or already memoised, so this
    // node is stable between renders that don't change a control — which it
    // has to be, since useHeaderSlot holds it in state.
  }, [
    showHeader, setDatePreset, datePreset, showGroupFilter, ghlClientGroups.length,
    gridOpen, selectedGroupLabel, groupSearch, filteredGridItems, selectedClientGroup,
  ])

  useHeaderSlot({
    title: showHeader ? "Lead Hub" : undefined,
    subtitle: showHeader ? "Every lead and contact across all client groups" : undefined,
    controls: headerControls,
  })

  return (
    <div className={`${portfolioFontClass} mx-auto w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)]`}>
      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        {/* The title block and the date/group filters sit in the global top bar
            beside the bell and the profile menu — published by useHeaderSlot
            above. The handoff puts both in the header, so the page starts
            straight at its content. */}

        {/* ── Hero row: trend chart (1.65) · KPI tiles (0.85) ────────────────
            The handoff's "chart + insights row". Six tiles sit in a 1fr 1fr
            grid beside the chart so the column's height matches it.

            The tiles describe the whole period rather than the open pipeline
            tab, and a metric with no comparable previous period renders without
            a pill rather than with a zero — an unknown delta is not a flat one.

            LH4 puts the Birdy Insights card above the tiles, where the design
            has it. */}
        <div className="flex flex-col gap-[18px] lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-col lg:flex-[1.65]">
            {groupsLoading || seriesLoading || statsLoading ? (
              <LoadingPulse className="h-[340px] flex-1" statements={CHART_LOADING} />
            ) : chart ? (
              <TrendChart
                className="flex-1"
                chart={chart}
                metrics={chartTabs}
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                redrawKey={`${chartMetric}-${datePreset}-${selectedClientGroup ?? "all"}`}
              />
            ) : (
              <PdCard
                className="flex-1"
                title={chartMetrics[chartMetric]?.title ?? "Trend"}
                // The metric tabs live inside TrendChart, so without them here
                // a metric with no series would be a dead end — you could
                // select it and have no way back to one that plots.
                action={
                  <PdSegmented
                    label="Chart metric"
                    className="shrink-0"
                    itemClassName="px-[13px] py-[7px]"
                    options={chartTabs.map(m => ({ key: m.key, label: m.tab }))}
                    value={chartMetric}
                    onChange={setChartMetric}
                  />
                }
              >
                <p className="py-8 text-center text-[12px] text-pd-faint">
                  No leads or contacts were added in this window, so there is
                  nothing dated to plot.
                </p>
              </PdCard>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-[14px] lg:flex-[0.85]">
            {/* Birdy's own voice, and the only saturated surface the style
                guide allows on a screen. Copy is generated per period from the
                rows below it — the headline movement, then the single client
                group worth acting on. */}
            {groupsLoading || seriesLoading || statsLoading ? (
              <Skeleton className="h-[128px] rounded-2xl" />
            ) : insight ? (
              <InsightCard segments={insight.segments} />
            ) : (
              <PdCard title="Birdy Insights">
                <p className="text-[12.5px] leading-[1.5] text-pd-body">
                  Once this window has leads and contacts in it, Birdy reads the
                  movement and names what to act on.
                </p>
              </PdCard>
            )}

            <div className="grid grid-cols-2 gap-[10px]">
              {groupsLoading || statsLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[52px] rounded-xl" />
                  ))
                : kpiTiles.map(tile => (
                    <StatTile
                      key={tile.key}
                      layout="compact"
                      icon={tile.icon}
                      tone={tile.tone}
                      value={tile.value}
                      label={tile.label}
                      direction={tile.direction}
                      delta={tile.delta}
                      polarity={tile.polarity}
                    />
                  ))}
            </div>
          </div>
        </div>

        {/* Opportunity Status Filter Tabs */}
        <Tabs value={selectedOpportunityStatus} onValueChange={setSelectedOpportunityStatus} className="w-full">
          {/* Pipeline tabs on the handoff's segmented-control spec: the track is
              the divider tint, the selected stage lifts onto white with the
              purple-tinted shadow. Radix Tabs still drives the behaviour — only
              the skin changes. The count badges arrive in LH5, once the stage
              counts come off the same query the table runs. */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <TabsList className="h-auto justify-start gap-[5px] overflow-x-auto rounded-[10px] border border-pd-border bg-pd-divider p-1">
              {[
                { value: "all", label: "All Leads" },
                { value: "open", label: "Open" },
                { value: "won", label: "Won" },
                { value: "abandoned", label: "Abandoned" },
                { value: "lost", label: "Lost" },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-[7px] rounded-lg px-[15px] py-[7px] font-pd-display text-[13px] font-semibold text-pd-muted data-[state=active]:bg-pd-surface data-[state=active]:text-pd-ink data-[state=active]:shadow-pd-segment"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Search, Filters and Columns as the handoff's 38px controls,
                sitting together at the right end of the tab row. */}
            <div className="ml-auto flex w-fit shrink-0 items-center gap-[10px]">
              <Input
                type="search"
                placeholder="Search leads…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-[38px] w-fit rounded-[10px] border-pd-border bg-pd-surface text-[13px] md:w-[200px]"
              />

              {/* ── FilterPanel: between search and columns ── */}
              <FilterPanel
                sources={sources}
                allTags={allTags}
                selectedSources={selectedSources}
                setSelectedSources={setSelectedSources}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
              />

              <ColumnVisibilityDropdown
                isOpen={isDropdownOpen}
                setIsOpen={setIsDropdownOpen}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                categoryCounts={{
                  columns: contactColumns.length,
                  sources: sources.length,
                  types: types.length,
                  opportunities: opportunityStatuses.length,
                  tags: allTags.length,
                }}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filteredColumns={filteredColumns}
                columnVisibility={contactColumns.reduce((acc, c) => ({ ...acc, [c.id]: visibleColumns.includes(c.id) }), {})}
                toggleColumnVisibility={toggleColumnVisibility}
                selectAll={selectAll}
                clearAll={clearAll}
                getIcon={(col) => {
                  const META_COLS = ["ad_name", "adset_name", "campaign_name", "platform", "created_time", "metaCampaign", "metaAdName", "metaAdsetName"]
                  if (META_COLS.includes(col.id)) return metaIco
                  if (col.id.startsWith("ghl_") || col.id.startsWith("tag_")) return ghlIco
                  if (selectedCategory === "tags") return ghlIco
                  if (col.id?.startsWith("custom_")) return flaskIco
                  return null
                }}
                save={async () => {
                  await saveToDB(visibleColumns)
                  setIsDropdownOpen(false)
                }}
              />

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-[38px] rounded-[10px] text-[13px] font-semibold text-pd-body"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Tabs>

        <StyledTable
          columns={contactColumns}
          data={filteredAndSortedContacts}
          columnVisibility={columnVisibilityMap}
          searchQuery=""
          clickableFirstColumn={false}
          isLoading={loading}
          initialColumnOrder={visibleColumns}
          onColumnOrderChange={(newOrder) => {
            setVisibleColumns(newOrder)
            // Auto-persist on drag-reorder (debounced inside the hook).
            saveViewDebounced(newOrder)
          }}
        />

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="h-[38px] rounded-[10px] text-[13px] font-semibold text-pd-body"
          >
            <ChevronLeft className="size-4" />Previous
          </Button>
          <span className="text-[12px] text-pd-faint">
            Page {currentPage} of {metaData?.total_pages || 1}
          </span>
          <Button
            variant="ghost"
            onClick={handleNextPage}
            disabled={!metaData?.has_next}
            className="h-[38px] rounded-[10px] text-[13px] font-semibold text-pd-body"
          >
            Next<ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}