"use client"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useColumnViews } from "@/lib/useColumnViews"
import { usePageViews } from "@/lib/usePageViews"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import StyledTable from "@/components/ui/table-container"
import { PageTabPanel, PageTabs } from "@/components/portfolio"
import { presetToDateRange } from "@/lib/date-utils"
import { apiRequest } from "@/lib/api"
import { buildContactColumns } from "@/lib/contact-columns"
import { ContactStats } from "@/components/contacts/ContactStats"
import { ErrorBanner } from "@/components/ErrorBanner"
import { FilterPanel } from "@/components/ui/Filterpanel.jsx"
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

// Ties the pipeline tabs to the table they filter, for anyone navigating by role.
const LEADS_PANEL_ID = "lead-hub-table-panel"

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


  // ── Saved column views ─────────────────────────────────────────────────
  const applyColumnView = useCallback((s) => {
    if (Array.isArray(s.visibleColumns)) setVisibleColumns(s.visibleColumns)
  }, [])

  // Explicit save only — see ColumnsMenu. Toggling changes the table but is
  // not written until "Save to existing" or "Save New View".
  const saveDefaultColumns = useCallback(async (ids) => {
    await saveToDB(ids)
    return true
  }, [saveToDB])

  const pageViews = usePageViews("contacts", {
    onApply: applyColumnView,
    ready: viewsLoaded,
  })

  // Contact columns carry a `category`; map it onto the menu's source ids.
  const CATEGORY_TO_SOURCE = { meta: 'meta', ghl: 'ghl', tags: 'tags', custom: 'custom' }

  const columnCatalogue = useMemo(
    () => contactColumns.map(c => ({
      id: c.id,
      label: c.label ?? c.id,
      source:
        CATEGORY_TO_SOURCE[c.category] ??
        (c.id.startsWith('tag_') ? 'tags'
          : c.id.startsWith('ghl_') ? 'ghl'
          : c.id.startsWith('custom_') ? 'custom'
          : 'meta'),
    })),
    [contactColumns]
  )

  const defaultColumnIds = useMemo(
    () => baseContactColumns.filter(c => c.defaultVisible).map(c => c.id),
    []
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

  // Every filter on this page, in one control. Sources and Tags narrow to a
  // set; Types and Opportunities pick one, with "all" meaning unfiltered.
  const filterGroups = useMemo(() => [
    { id: "sources", label: "Sources", mode: "multi",
      items: sources, value: selectedSources, onChange: setSelectedSources },
    { id: "types", label: "Types", mode: "single",
      items: types, value: selectedType, onChange: setSelectedType },
    { id: "opportunities", label: "Opportunities", mode: "single",
      items: opportunityStatuses, value: selectedOpportunityStatus,
      onChange: setSelectedOpportunityStatus },
    { id: "tags", label: "Tags", mode: "multi",
      items: allTags, value: selectedTags, onChange: setSelectedTags },
  ], [sources, selectedSources, types, selectedType, opportunityStatuses,
      selectedOpportunityStatus, allTags, selectedTags])

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
    // PageTabs tints the badges (purple on the active tab, neutral elsewhere).
    return PIPELINE_TABS.map((tab) => ({
      key: tab.key,
      label: tab.label,
      badge: (stats[tab.stat] ?? 0).toLocaleString(),
    }))
  }, [metaData])

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        {showStatCards && <ContactStats metaStats={metaData?.stats} loading={loading} />}

        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <PageTabs
              label="Pipeline stage"
              panelId={LEADS_PANEL_ID}
              tabs={pipelineTabs}
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

              <FilterPanel groups={filterGroups} triggerClassName={TOOLBAR_CHIP} />


              {/* The dropdown above is this page's filter panel (Sources,
                  Types, Opportunities, Tags) as well as a column toggle, so it
                  stays; the Columns menu owns saved views. */}
              <ColumnsMenu
                columns={columnCatalogue}
                visibleColumns={visibleColumns}
                onChange={setVisibleColumns}
                defaultColumns={defaultColumnIds}
                views={pageViews}
                onSaveDefault={saveDefaultColumns}
              />

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-[38px]">
                  Clear
                </Button>
              )}
            </div>
          </div>

          <PageTabPanel id={LEADS_PANEL_ID} label="Leads" className="mt-4">
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
          </PageTabPanel>
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
