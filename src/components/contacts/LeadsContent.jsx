"use client"

import { ChevronLeft, ChevronRight, X, SlidersHorizontal, Check, Search, ChevronDown } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import StyledTable from "@/components/ui/table-container"
import { presetToDateRange } from "@/lib/date-utils"
import { apiRequest } from "@/lib/api"
import { buildContactColumns } from "@/lib/contact-columns"
import { ContactStats } from "@/components/contacts/ContactStats"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ghlIcon as ghlIco, metaIcon as metaIco, flaskIcon as flaskIco } from "@/lib/icons"
import { ErrorBanner } from "@/components/ErrorBanner"
import { flaskIcon as Flask, ghlIcon as ghl } from "@/lib/icons"

const baseContactColumns = buildContactColumns()

// ─── FilterPanel Component ───────────────────────────────────────────────────
function FilterPanel({
  sources = [],
  allTags = [],
  selectedSources = [],
  setSelectedSources,
  selectedTags = [],
  setSelectedTags,
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("sources")
  const [search, setSearch] = useState("")

  // Draft state — only committed to parent on "Apply"
  const [draftSources, setDraftSources] = useState(selectedSources)
  const [draftTags, setDraftTags] = useState(selectedTags)

  // Sync draft when parent resets from outside
  useEffect(() => { setDraftSources(selectedSources) }, [selectedSources])
  useEffect(() => { setDraftTags(selectedTags) }, [selectedTags])

  // Reset search on tab change
  useEffect(() => { setSearch("") }, [activeTab])

  // Counts (based on draft)
  const sourceCount = draftSources.length
  const tagCount = draftTags.length
  const totalActive = sourceCount + tagCount

  const tabs = [
    { id: "sources", label: "Sources", count: sourceCount },
    { id: "tags",    label: "Tags",    count: tagCount },
  ]

  const getItems = () => {
    switch (activeTab) {
      case "sources": return sources
      case "tags":    return allTags
      default:        return []
    }
  }

  const isChecked = (item) => {
    switch (activeTab) {
      case "sources": return draftSources.includes(item)
      case "tags":    return draftTags.includes(item)
      default:        return false
    }
  }

  const toggle = (item) => {
    switch (activeTab) {
      case "sources":
        setDraftSources((prev) =>
          prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
        )
        break
      case "tags":
        setDraftTags((prev) =>
          prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item]
        )
        break
    }
  }

  const handleClear = () => {
    switch (activeTab) {
      case "sources": setDraftSources([]); break
      case "tags":    setDraftTags([]);    break
    }
  }

  const handleApply = () => {
    setSelectedSources?.(draftSources)
    setSelectedTags?.(draftTags)
    setOpen(false) // Close panel after apply
  }

  const filteredItems = getItems().filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  )

  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Filters"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-4 hover:bg-purple-100 font-semibold bg-white h-9 text-sm rounded-lg border border-gray-200 transition-colors duration-150 cursor-pointer">
          <SlidersHorizontal size={14} />
          Filters
          {totalActive > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[11px] font-bold text-white bg-violet-700">
              {totalActive}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[340px] rounded-2xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden p-0 flex flex-col"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Tab bar */}
        <div className="flex gap-1.5 px-3 pt-2.5 pb-1 shrink-0">
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex-1 inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full",
                  "text-[12px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap",
                  active ? "bg-violet-700 text-white" : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={[
                    "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full px-1",
                    "text-[10px] font-bold text-white",
                    active ? "bg-white/25" : "bg-violet-700",
                  ].join(" ")}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div
          className="px-3 py-1.5 border-t border-gray-200 shrink-0"
          onFocusCapture={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Search ${activeTabLabel}…`}
              autoComplete="off"
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1">
          {filteredItems.length === 0 ? (
            <p className="text-center text-gray-400 text-[12px] py-5">No results</p>
          ) : (
            filteredItems.map((item) => {
              const checked = isChecked(item)
              return (
                <label
                  key={item}
                  onClick={() => toggle(item)}
                  className="flex items-center gap-2.5 px-1.5 py-[7px] rounded-lg cursor-pointer hover:bg-violet-50 transition-colors duration-100"
                >
                  <span
                    className={[
                      "shrink-0 w-[16px] h-[16px] rounded-[4px] flex items-center justify-center transition-all duration-150",
                      checked ? "bg-violet-700 border-0" : "bg-white border border-gray-300",
                    ].join(" ")}
                  >
                    {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                  </span>
                  <span className="text-[13px] text-gray-900 flex-1 select-none">
                    {item}
                  </span>
                </label>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 bg-white shrink-0">
          <button
            onClick={handleClear}
            className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="flex-1 h-8 rounded-lg border-0 bg-violet-700 text-white text-[12px] font-semibold hover:bg-violet-800 cursor-pointer transition-colors duration-150"
          >
            Apply filters
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Main LeadsContent Component ─────────────────────────────────────────────

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

  // Fetch custom metrics for leads dashboard
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
  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("contacts")

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
      id: m.id, header: m.name, label: m.name, defaultVisible: false,
      sortable: true, icons: Flask, category: "custom",
      cell: (row) => row?.[m.id] ?? "–",
    }))

    const tagCols = availableTags.map(tag => ({
      id: `tag_${tag.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`,
      header: tag, label: `Tag: ${tag}`, defaultVisible: false,
      sortable: true, icons: ghl, category: "tags", _tagName: tag,
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
  
  // ── Changed to multi-select array ──
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedType, setSelectedType] = useState("all")
  const [selectedOpportunityStatus, setSelectedOpportunityStatus] = useState("all")
  const [selectedTags, setSelectedTags] = useState([])
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")
  
  const [selectedClientGroup, setSelectedClientGroup] = useState(() => {
    if (!showGroupFilter && clientGroups.length === 1) return clientGroups[0].id
    return "all"
  })
  
  const [selectedCategory, setSelectedCategory] = useState("columns")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // ── Filter options fetched from server ──
  const [sources, setSources] = useState([])
  const [types, setTypes] = useState([])
  const [allTags, setAllTags] = useState([])
  const opportunityStatuses = ["open", "won", "lost", "abandoned"]

  useEffect(() => {
    if (ghlClientGroups.length === 0) return
    const groupsParam = selectedClientGroup !== "all" ? selectedClientGroup : ""
    const { start_date, end_date } = presetToDateRange(datePreset)

    let url = `/api/leads/filter-options?groups=${groupsParam}`
    if (start_date) url += `&start_date=${start_date}`
    if (end_date) url += `&end_date=${end_date}`

    apiRequest(url)
      .then(r => r.json())
      .then(data => {
        setSources(data.sources || [])
        setTypes(data.types || [])
        setAllTags(data.tags || [])
      })
      .catch(() => {})
  }, [selectedClientGroup, ghlClientGroups.length, datePreset])

  const columnVisibilityMap = useMemo(
    () => contactColumns.reduce(
      (acc, col) => ({ ...acc, [col.id]: visibleColumns.includes(col.id) }),
      {}
    ),
    [visibleColumns]
  )

  const fetchContacts = async (page = 1) => {
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

      let endpoint = `/api/leads/unified?groups=${groupsParam}&page=${page}&limit=15`

      if (start_date) endpoint += `&start_date=${start_date}`
      if (end_date) endpoint += `&end_date=${end_date}`

      // ── Server-side filters ──
      // FIX: Send each source as a separate param so backend receives an array
      if (selectedSources.length > 0) {
        const sourcesParam = selectedSources.join("|")  // use | as separator, not comma
        endpoint += `&source=${encodeURIComponent(sourcesParam)}`
      }
      if (selectedType !== "all") endpoint += `&contact_type=${encodeURIComponent(selectedType)}`
      if (selectedOpportunityStatus !== "all") endpoint += `&opportunity_status=${encodeURIComponent(selectedOpportunityStatus)}`
      if (selectedTags.length > 0) endpoint += `&tags=${selectedTags.map(encodeURIComponent).join(",")}`
      if (searchQuery) endpoint += `&search=${encodeURIComponent(searchQuery)}`

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

  // Auto-select single group if embedded
  useEffect(() => {
    if (!showGroupFilter && ghlClientGroups.length === 1 && selectedClientGroup === "all") {
      setSelectedClientGroup(ghlClientGroups[0].id)
    }
  }, [showGroupFilter, ghlClientGroups, selectedClientGroup])

  // Re-fetch whenever committed filters change
  useEffect(() => {
    if (ghlClientGroups.length > 0) {
      fetchContacts(1)
    }
  }, [
    selectedClientGroup, ghlClientGroups.length, datePreset,
    selectedSources, selectedType, selectedOpportunityStatus,
    selectedTags, searchQuery,
  ])

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

  // Client-side sort
  const filteredAndSortedContacts = useMemo(() => {
    let sorted = [...contacts]
    if (sortColumn) {
      sorted.sort((a, b) => {
        let aVal = a[sortColumn] ?? ""
        let bVal = b[sortColumn] ?? ""
        if (sortColumn === "dateAdded") {
          aVal = aVal ? new Date(aVal).getTime() : 0
          bVal = bVal ? new Date(bVal).getTime() : 0
        }
        if (sortColumn === "leadValue") { aVal = aVal || 0; bVal = bVal || 0 }
        if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase() }
        return (aVal < bVal ? -1 : 1) * (sortDirection === "asc" ? 1 : -1)
      })
    }
    return sorted
  }, [contacts, sortColumn, sortDirection])

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
  }, [selectedCategory, searchTerm, sources, types, opportunityStatuses, allTags, selectedSources, selectedType, selectedOpportunityStatus, selectedTags, contactColumns])

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
      case "sources": setSelectedSources([...sources]); break
      case "tags": setSelectedTags([...allTags]); break
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

  return (
    <div className="mx-auto w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)]">
      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        {showHeader && (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">Lead Hub</h1>
            </div>

            <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg
              py-1 px-1 flex-nowrap overflow-x-auto md:overflow-x-visible md:gap-1 md:py-1 md:px-1 w-fit mx-auto md:mx-0">
              <div className="flex items-center gap-1">
                <div className="flex gap-1 md:overflow-x-visible">
                  {setDatePreset && (
                    <DateRangeSelect value={datePreset} onChange={setDatePreset} />
                  )}
                  {showGroupFilter && (
                    <Select value={selectedClientGroup} onValueChange={setSelectedClientGroup}>
                      <SelectTrigger className="h-10 bg-white font-semibold">
                        <SelectValue placeholder="All Groups" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All Groups</SelectItem>
                        {ghlClientGroups.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <ContactStats metaStats={metaData?.stats} loading={loading} />

        <Tabs value={selectedOpportunityStatus} onValueChange={setSelectedOpportunityStatus} className="w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <TabsList className="flex-1 justify-start overflow-x-auto">
              <TabsTrigger value="all">All Leads</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="won">Won</TabsTrigger>
              <TabsTrigger value="abandoned">Abandoned</TabsTrigger>
              <TabsTrigger value="lost">Lost</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 w-fit shrink-0">
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-gray-900 bg-white h-10 w-fit md:w-55 text-sm font-medium"
              />
              
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
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-10">
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
            // visibleColumns IS the ordered list — feed it as the initial order
            // and let drags update the same array (saved on next "Save view").
            initialColumnOrder={visibleColumns}
            onColumnOrderChange={(newOrder) => {
              // Keep hidden columns out of the ordered list (only visible drag)
              setVisibleColumns(newOrder)
            }}
        />

        <div className="flex justify-center gap-4">
          <Button variant="ghost" onClick={handlePreviousPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />Previous
          </Button>
          <span className="text-sm font-medium py-2">
            Page {currentPage} of {metaData?.total_pages || 1}
          </span>
          <Button variant="ghost" onClick={handleNextPage} disabled={!metaData?.has_next}>
            Next<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}