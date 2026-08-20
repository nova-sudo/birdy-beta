"use client"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useColumnViews } from "@/lib/useColumnViews"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import StyledTable from "@/components/ui/table-container"
import { PdSegmented } from "@/components/portfolio"
import { presetToDateRange } from "@/lib/date-utils"
import { apiRequest } from "@/lib/api"
import { buildContactColumns } from "@/lib/contact-columns"
import { ContactStats } from "@/components/contacts/ContactStats"
import { ErrorBanner } from "@/components/ErrorBanner"
import { FilterPanel } from "@/components/ui/Filterpanel.jsx"
import { ghlIcon as ghlIco, metaIcon as metaIco, flaskIcon as flaskIco } from "@/lib/icons"
import { flaskIcon as Flask, ghlIcon as ghl } from "@/lib/icons"

// ─── Lead Hub table + pipeline tabs ─────────────────────────────────────────
// The lower half of the Lead Hub — everything the page's shell, chart, insight
// card and KPI tiles (src/app/contacts/page.jsx) sit above. Shell/header/chart
// live entirely on the page; this component owns only the pipeline tabs, the
// table toolbar, and the table itself, the same split Sales-Hub's
// CallCentreContent draws against its own page.
//
// Also embedded read-only inside /clients/[id] (showStatCards defaults true
// there, and selectedClientGroup/onSelectClientGroup are left uncontrolled so
// this manages its own single-client scope) — see the client-group-selection
// comment below for how that split works.

const baseContactColumns = buildContactColumns()

// Every control in the toolbar row wears the design's dropdown trigger: 38px
// tall, white, hairline border, 10px radius, Inter 600 13px — matches
// Sales-Hub's CallCentreContent.
const TOOLBAR_CHIP =
  "flex h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border border-pd-border bg-pd-surface px-[13px] text-[13px] font-semibold text-pd-body hover:bg-pd-divider"

const PIPELINE_TABS = [
  { key: "all", label: "All Leads", stat: "lead_count" },
  { key: "open", label: "Open", stat: "open" },
  { key: "won", label: "Won", stat: "won" },
  { key: "abandoned", label: "Abandoned", stat: "abandoned" },
  { key: "lost", label: "Lost", stat: "lost" },
]

export function LeadsContent({
  clientGroups,
  groupsLoading,
  datePreset,
  showStatCards = true,
  selectedClientGroup: controlledClientGroup,
  onSelectClientGroup,
}) {
  const [contacts, setContacts] = useState([])
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customMetrics, setCustomMetrics] = useState([])
  const [selectedRows, setSelectedRows] = useState(new Set())

  const [filterOptions, setFilterOptions] = useState({ sources: [], types: [], tags: [] })

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

  // Client-group selection is controlled when the Lead Hub page passes
  // selectedClientGroup/onSelectClientGroup (it renders its own picker in the
  // global header) and internal otherwise — the same split
  // CallCentreContent's selectedClientGroup uses, for the same reason:
  // /clients/[id] is already scoped to one client and never moves it.
  const [uncontrolledClientGroup, setUncontrolledClientGroup] = useState("all")
  const selectedClientGroup = controlledClientGroup ?? uncontrolledClientGroup
  const setSelectedClientGroup = onSelectClientGroup ?? setUncontrolledClientGroup

  const [selectedCategory, setSelectedCategory] = useState("columns")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

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

  // When embedded for a single group under internal (uncontrolled) selection,
  // auto-select it once groups load. Controlled usage (the Lead Hub page)
  // owns this decision itself, via its own ClientGroupPicker.
  useEffect(() => {
    if (controlledClientGroup !== undefined) return
    if (ghlClientGroups.length === 1 && uncontrolledClientGroup === "all") {
      setUncontrolledClientGroup(ghlClientGroups[0].id)
    }
  }, [controlledClientGroup, ghlClientGroups, uncontrolledClientGroup])

  // Re-fetch whenever the preset, group filter, or group list changes
  useEffect(() => {
    if (ghlClientGroups.length > 0) {
      fetchContacts(1)
    }
  }, [selectedClientGroup, ghlClientGroups.length, datePreset, selectedSources, selectedTags, selectedOpportunityStatus])

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
    selectedTags.length > 0

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

  // Pipeline tabs, with the design's count badges — the same figures the
  // Lead Hub page's KPI tiles show, sourced here from this fetch's own
  // meta.stats rather than re-deriving them, since this table already pulls
  // them on every window/group change.
  const pipelineTabs = useMemo(() => {
    const stats = metaData?.stats ?? {}
    return PIPELINE_TABS.map((tab) => ({
      key: tab.key,
      label: tab.label,
      badge: (stats[tab.stat] ?? 0).toLocaleString(),
      badgeClassName:
        tab.key === selectedOpportunityStatus
          ? "bg-pd-primary-tint text-pd-primary"
          : "bg-pd-neutral-badge text-pd-subtle",
    }))
  }, [metaData, selectedOpportunityStatus])

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        {showStatCards && <ContactStats metaStats={metaData?.stats} loading={loading} />}

        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <PdSegmented
              label="Pipeline stage"
              className="shrink-0 self-start"
              itemClassName="px-[15px] py-[7px] text-[13px]"
              options={pipelineTabs}
              value={selectedOpportunityStatus}
              onChange={setSelectedOpportunityStatus}
            />

            <div className="flex items-center gap-2.5 md:ml-auto">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-[13px] size-[15px] -translate-y-1/2 text-pd-faint"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search leads…"
                  aria-label="Search leads"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-[38px] w-full rounded-[10px] border-pd-border bg-pd-surface pl-9 text-[13px] text-pd-body placeholder:text-pd-faint md:w-[200px]"
                />
              </div>

              <FilterPanel
                sources={sources}
                allTags={allTags}
                selectedSources={selectedSources}
                setSelectedSources={setSelectedSources}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                triggerClassName={TOOLBAR_CHIP}
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
                triggerClassName={TOOLBAR_CHIP}
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
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-[38px]">
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4">
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
              enableSelection
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
            />
          </div>
        </div>

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
