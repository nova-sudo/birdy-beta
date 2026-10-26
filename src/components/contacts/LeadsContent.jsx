"use client"
import { CheckIcon, XIcon } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useColumnViews } from "@/lib/useColumnViews"
import { usePageViews } from "@/lib/usePageViews"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import {
  Button,
  DataTable,
  DataTableFacetedFilter,
  EmptyState,
  ErrorState,
  Input,
  SegmentedTabs,
} from "@/components/ds"
import { presetToDateRange } from "@/lib/date-utils"
import { apiRequest } from "@/lib/api"
import { buildContactColumns, toTableColumns } from "@/lib/contact-columns"
import { ContactStats } from "@/components/contacts/ContactStats"
import { flaskIcon as Flask, ghlIcon as ghl } from "@/lib/icons"

// ─── Lead Hub table + pipeline tabs ─────────────────────────────────────────
// The lower half of the Lead Hub — everything the page's header, chart and
// Birdy's read (src/app/contacts/page.jsx) sit above. Shell/header/chart live
// entirely on the page; this component owns only the pipeline tabs, the table
// toolbar, and the table itself, the same split Sales-Hub's CallCentreContent
// draws against its own page.
//
// Also embedded read-only inside /clients/[id] (showStatCards defaults true
// there, and selectedClientGroup/onSelectClientGroup are left uncontrolled so
// this manages its own single-client scope) — see the client-group-selection
// comment below for how that split works.
//
// The list is paged on the server (15 a page); search, the Types facet and
// column sorting work on the page that is loaded, as they always have.

const baseContactColumns = buildContactColumns()

const PAGE_SIZE = 15

// The name column leads and stays put: it cannot be dragged, and nothing goes ahead of it.
const LOCKED_COLUMNS = ["contactName"]

// Any column order, with the locked columns first. Saved views from before the lock can have Name anywhere.
const lockedFirst = (ids) => [
  ...LOCKED_COLUMNS.filter((id) => ids.includes(id)),
  ...ids.filter((id) => !LOCKED_COLUMNS.includes(id)),
]

const PIPELINE_TABS = [
  { key: "all", label: "All Leads", stat: "lead_count" },
  { key: "open", label: "Open", stat: "open" },
  { key: "won", label: "Won", stat: "won" },
  { key: "abandoned", label: "Abandoned", stat: "abandoned" },
  { key: "lost", label: "Lost", stat: "lost" },
]

// Contact columns carry a `category`; map it onto the menu's source ids.
const CATEGORY_TO_SOURCE = { meta: "meta", ghl: "ghl", tags: "tags", custom: "custom" }

const asOptions = (items) => items.map((value) => ({ value, label: value }))

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
      cell: (value) => (value == null || typeof value === "object" ? "–" : value),
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
      cell: (_, row) => row?.tags?.includes(tag)
        ? <><CheckIcon aria-hidden className="size-4 text-success-ink" /><span className="sr-only">Yes</span></>
        : "–",
    }))

    return [...baseContactColumns, ...custom, ...tagCols]
  }, [customMetrics, availableTags])

  const tableColumns = useMemo(() => toTableColumns(contactColumns), [contactColumns])

  const [visibleColumns, setVisibleColumnsRaw] = useState(
    lockedFirst(baseContactColumns.filter((col) => col.defaultVisible).map((col) => col.id))
  )
  const setVisibleColumns = useCallback((ids) => setVisibleColumnsRaw(lockedFirst(ids)), [])
  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setVisibleColumns(savedColumns)
  }, [viewsLoaded, savedColumns, setVisibleColumns])

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedType, setSelectedType] = useState("all")
  const [selectedOpportunityStatus, setSelectedOpportunityStatus] = useState("all")
  const [selectedTags, setSelectedTags] = useState([])
  const [sorting, setSorting] = useState([])

  // Client-group selection is controlled when the Lead Hub page passes
  // selectedClientGroup/onSelectClientGroup (it renders its own picker in the
  // page header) and internal otherwise — the same split
  // CallCentreContent's selectedClientGroup uses, for the same reason:
  // /clients/[id] is already scoped to one client and never moves it.
  const [uncontrolledClientGroup, setUncontrolledClientGroup] = useState("all")
  const selectedClientGroup = controlledClientGroup ?? uncontrolledClientGroup
  const setSelectedClientGroup = onSelectClientGroup ?? setUncontrolledClientGroup


  // ── Saved column views ─────────────────────────────────────────────────
  const applyColumnView = useCallback((s) => {
    if (Array.isArray(s.visibleColumns)) setVisibleColumns(s.visibleColumns)
  }, [setVisibleColumns])

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

  const columnCatalogue = useMemo(
    () => contactColumns.map(c => ({
      id: c.id,
      label: c.label ?? c.id,
      source:
        CATEGORY_TO_SOURCE[c.category] ??
        (c.id.startsWith("tag_") ? "tags"
          : c.id.startsWith("ghl_") ? "ghl"
          : c.id.startsWith("custom_") ? "custom"
          : "meta"),
    })),
    [contactColumns]
  )

  const defaultColumnIds = useMemo(
    () => lockedFirst(baseContactColumns.filter(c => c.defaultVisible).map(c => c.id)),
    []
  )

  const columnVisibilityMap = useMemo(
    () => contactColumns.reduce(
      (acc, col) => ({ ...acc, [col.id]: visibleColumns.includes(col.id) }),
      {}
    ),
    [contactColumns, visibleColumns]
  )

  // Dragging a header onto another moves it there. The order is the visible
  // list, so it is saved the way the old table saved a reorder (debounced).
  const reorderColumn = useCallback((fromId, toId) => {
    const from = visibleColumns.indexOf(fromId)
    const to = visibleColumns.indexOf(toId)
    if (from < 0 || to < 0 || LOCKED_COLUMNS.includes(fromId) || LOCKED_COLUMNS.includes(toId)) return
    const moved = visibleColumns.filter((id) => id !== fromId)
    moved.splice(moved.indexOf(toId) + (from < to ? 1 : 0), 0, fromId)
    const next = lockedFirst(moved)
    setVisibleColumns(next)
    saveViewDebounced(next)
  }, [visibleColumns, saveViewDebounced])

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
      .then(data => {
        if (data) setFilterOptions({ sources: data.sources ?? [], types: data.types ?? [], tags: data.tags ?? [] })
      })
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

  // Every filter on this page. Sources and Tags narrow to a set; Types and
  // Opportunities pick one, with "all" meaning unfiltered.
  const facets = [
    { id: "sources", title: "Sources", multiple: true, options: asOptions(sources),
      value: selectedSources, onChange: setSelectedSources },
    { id: "types", title: "Types", options: asOptions(types),
      value: selectedType === "all" ? [] : [selectedType], onChange: (v) => setSelectedType(v[0] ?? "all") },
    { id: "opportunities", title: "Opportunities", options: asOptions(opportunityStatuses),
      value: selectedOpportunityStatus === "all" ? [] : [selectedOpportunityStatus],
      onChange: (v) => setSelectedOpportunityStatus(v[0] ?? "all") },
    { id: "tags", title: "Tags", multiple: true, options: asOptions(allTags),
      value: selectedTags, onChange: setSelectedTags },
  ]

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

      let endpoint = `/api/leads/unified?groups=${groupsParam}&page=${page}&limit=${PAGE_SIZE}`
      if (start_date) endpoint += `&start_date=${start_date}`
      if (end_date) endpoint += `&end_date=${end_date}`
      selectedSources.forEach(s => { endpoint += `&source=${encodeURIComponent(s)}` })
      selectedTags.forEach(t => { endpoint += `&tag=${encodeURIComponent(t)}` })
      if (selectedOpportunityStatus && selectedOpportunityStatus !== "all") {
        endpoint += `&opportunity_status=${encodeURIComponent(selectedOpportunityStatus)}`
      }

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
  // owns this decision itself, via its own client group picker.
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
    } else if (!groupsLoading) {
      // Nothing to scope to: say so rather than leave the skeleton up.
      setLoading(false)
    }
  }, [selectedClientGroup, ghlClientGroups.length, datePreset, selectedSources, selectedTags, selectedOpportunityStatus])

  const visibleContacts = useMemo(() => {
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

    return filtered
  }, [contacts, searchQuery, selectedType])

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedSources([])
    setSelectedType("all")
    setSelectedOpportunityStatus("all")
    setSelectedClientGroup("all")
    setSelectedTags([])
    setSorting([])
  }

  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedSources.length > 0 ||
    selectedType !== "all" ||
    selectedOpportunityStatus !== "all" ||
    selectedClientGroup !== "all" ||
    selectedTags.length > 0
  )

  // Pipeline tabs, with the design's count badges — the same figures the
  // Lead Hub page's KPI tiles show, sourced here from this fetch's own
  // meta.stats rather than re-deriving them, since this table already pulls
  // them on every window/group change.
  const pipelineTabs = useMemo(() => {
    const stats = metaData?.stats ?? {}
    return PIPELINE_TABS.map((tab) => ({
      value: tab.key,
      label: tab.label,
      count: (stats[tab.stat] ?? 0).toLocaleString(),
    }))
  }, [metaData])

  // Page count comes from the server's own total_pages, as "Page X of Y" always has.
  const rowCount = (metaData?.total_pages ?? 1) * PAGE_SIZE

  const tableState = useMemo(
    () => ({
      sorting,
      columnVisibility: columnVisibilityMap,
      columnOrder: visibleColumns,
      pagination: { pageIndex: currentPage - 1, pageSize: PAGE_SIZE },
    }),
    [sorting, columnVisibilityMap, visibleColumns, currentPage]
  )

  const handleTableState = (next) => {
    setSorting(next.sorting)
    if (next.pagination.pageIndex !== currentPage - 1) fetchContacts(next.pagination.pageIndex + 1)
  }

  const toolbar = (
    <>
      <Input
        type="search"
        placeholder="Search leads…"
        aria-label="Search leads"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full sm:w-72"
      />

      {facets.map((facet) => (
        <DataTableFacetedFilter
          key={facet.id}
          title={facet.title}
          options={facet.options}
          multiple={facet.multiple}
          value={facet.value}
          onValueChange={facet.onChange}
        />
      ))}

      {hasActiveFilters && (
        <Button variant="ghost" onClick={clearAllFilters}>
          <XIcon aria-hidden />
          Clear
        </Button>
      )}

      {/* The facets above are this page's filters; the Columns menu owns the
          column set and the saved views. */}
      <ColumnsMenu
        columns={columnCatalogue}
        visibleColumns={visibleColumns}
        onChange={setVisibleColumns}
        defaultColumns={defaultColumnIds}
        views={pageViews}
        onSaveDefault={saveDefaultColumns}
        lockedColumnIds={LOCKED_COLUMNS}
        buttonClassName="ml-auto"
      />
    </>
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {showStatCards && <ContactStats metaStats={metaData?.stats} loading={loading} />}

      {error ? (
        <ErrorState
          title="Couldn't load your leads"
          description={`${error}. Your leads are fine — we just couldn't reach them.`}
          onRetry={() => fetchContacts(currentPage)}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 max-w-full">
            <SegmentedTabs
              ariaLabel="Pipeline stage"
              value={selectedOpportunityStatus}
              onValueChange={setSelectedOpportunityStatus}
              items={pipelineTabs}
            />
          </div>

          <DataTable
            columns={tableColumns}
            data={visibleContacts}
            loading={loading}
            toolbar={toolbar}
            state={tableState}
            onStateChange={handleTableState}
            onColumnReorder={reorderColumn}
            lockedColumnIds={LOCKED_COLUMNS}
            stickyFirstColumn
            manualPagination
            rowCount={rowCount}
            pageSize={PAGE_SIZE}
            pageSizeOptions={[PAGE_SIZE]}
            getRowId={(row, index) => row.id ?? `${currentPage}-${index}`}
            empty={
              hasActiveFilters ? (
                <EmptyState
                  title="No leads match"
                  description="Nothing on this page fits the current filters."
                  action={<Button size="sm" onClick={clearAllFilters}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  title="No leads yet"
                  description="Leads and contacts from your connected GoHighLevel accounts appear here."
                />
              )
            }
          />
        </div>
      )}
    </div>
  )
}
