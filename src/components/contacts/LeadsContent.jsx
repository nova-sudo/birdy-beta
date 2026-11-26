"use client"
import { Search, X } from "lucide-react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useColumnViews } from "@/lib/useColumnViews"
import { usePageViews } from "@/lib/usePageViews"
import { useRememberViewCatalogue } from "@/lib/view-catalogues"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import StyledTable from "@/components/ui/table-container"
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination"
import { pageNumbers } from "@/lib/page-numbers"
import { PageTabPanel, PageTabs } from "@/components/portfolio"
import { Stagger, StaggerItem } from "@/components/motion"
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
//
// Agency Ops' Dashboard tab, inside one client, mounts it with `stages="lead"`:
// the tabs are the lead's own stages (All, Meta lead, In CRM, Called, Closed,
// Lost, counted by the backend's meta.lead_stages), the CRM's pipeline and its
// stages are a Pipeline and a Stage group in Filters, and the tab, filters and
// page live in the address (`query` / `onQuery`) so Back from a lead returns
// to the same place.

const baseContactColumns = buildContactColumns()

// Every control in the toolbar row wears the design's dropdown trigger: 38px
// tall, white, hairline border, pill radius, Inter 600 13px — matches
// Sales-Hub's CallCentreContent.
const TOOLBAR_CHIP =
  "flex h-[38px] cursor-pointer items-center gap-2 rounded-full border border-pd-border bg-pd-surface px-[13px] text-[13px] font-semibold text-pd-body hover:bg-pd-divider"

// Ties the pipeline tabs to the table they filter, for anyone navigating by role.
const LEADS_PANEL_ID = "lead-hub-table-panel"

const PIPELINE_TABS = [
  { key: "all", label: "All Leads", stat: "lead_count" },
  { key: "open", label: "Open", stat: "open" },
  { key: "won", label: "Won", stat: "won" },
  { key: "abandoned", label: "Abandoned", stat: "abandoned" },
  { key: "lost", label: "Lost", stat: "lost" },
]

// The lead's own stages, for one client (`stages="lead"`). Each key is the
// backend's `lead_stage` value and its count in `meta.lead_stages`; Meta lead
// overlaps the others, which between them add up to All.
export const LEAD_STAGE_TABS = [
  { key: "all", label: "All" },
  { key: "meta", label: "Meta lead" },
  { key: "crm", label: "In CRM" },
  { key: "called", label: "Called" },
  { key: "closed", label: "Closed" },
  { key: "lost", label: "Lost" },
]

// With the lead tabs, Opportunities is a filter rather than the tabs, so it
// lists every status the CRM has, not only those on the page in view.
const OPPORTUNITY_STATUSES = [
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "abandoned", label: "Abandoned" },
]

const NONE = []

/**
 * The client's CRM pipelines from `meta.pipelines`, in the CRM's order, each
 * stage with its count; `total` is the pipeline's leads.
 */
export function pipelinesOf(meta) {
  const list = Array.isArray(meta?.pipelines) ? meta.pipelines : []
  return list
    .map((p) => {
      const stages = (Array.isArray(p?.stages) ? p.stages : [])
        .filter((st) => st?.id != null)
        .map((st) => ({ id: String(st.id), name: String(st.name || "").trim() || "Unnamed stage", count: Number(st.count) || 0 }))
      return { id: String(p?.id ?? ""), name: String(p?.name || "").trim() || "Pipeline", total: stages.reduce((n, st) => n + st.count, 0), stages }
    })
    .filter((p) => p.id && p.stages.length > 0)
}

/** The pipeline the Stage filter lists first: the one holding the most leads, the CRM's first on a tie. */
const busiestPipeline = (pipelines) => pipelines.reduce((best, p) => (!best || p.total > best.total ? p : best), null)

/**
 * @param {"opportunity"|"lead"} [props.stages] which tabs sit over the table: Open / Won / Abandoned /
 *   Lost (the Leads hub's, the default) or the lead's own stages, with the CRM pipeline and stage in Filters
 * @param {object} [props.query] the tab, filters and page, when the caller keeps them (in the address):
 *   `{ tab, pipeline, stage, page, sources, type, opportunity, tags }`; left out they are kept here
 * @param {(changes: object) => void} [props.onQuery] takes changes to `query`, null removing one
 */
export function LeadsContent({
  clientGroups,
  groupsLoading,
  datePreset,
  showStatCards = true,
  selectedClientGroup: controlledClientGroup,
  onSelectClientGroup,
  // Fills the height it is given: the toolbar and pager stay put and only the table scrolls, inside its card.
  fill = false,
  stages = "opportunity",
  query,
  onQuery,
}) {
  const leadTabs = stages === "lead"
  const router = useRouter()
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

  // The tab, the filters and the page: the caller's (the address) when it keeps them, else here.
  const [localState, setLocalState] = useState({})
  const tableState = query ?? localState
  const updateState = useCallback((changes) => {
    if (onQuery) onQuery(changes)
    else setLocalState((prev) => ({ ...prev, ...changes }))
  }, [onQuery])

  const currentPage = Math.max(1, Number.parseInt(tableState.page ?? "1", 10) || 1)
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
  const selectedSources = tableState.sources?.length ? tableState.sources : NONE
  const selectedType = tableState.type || "all"
  const selectedOpportunityStatus = tableState.opportunity || "all"
  const selectedTags = tableState.tags?.length ? tableState.tags : NONE
  const selectedLeadStage = LEAD_STAGE_TABS.some((t) => t.key === tableState.tab) ? tableState.tab : "all"
  // Any filter but the page itself starts the table again at its first page.
  const setSelectedOpportunityStatus = (value) => updateState({ opportunity: value === "all" ? null : value, page: null })
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
  // A client given without a way to change it is the page's scope, not a filter: Clear leaves it.
  const clientLocked = controlledClientGroup !== undefined && !onSelectClientGroup


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
  useRememberViewCatalogue("contacts", { label: "Leads Hub", path: "/contacts", columns: columnCatalogue })

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

  // The client's CRM pipelines, from the last page that answered (they ignore
  // the stage picked, so a stage's page keeps the whole pipeline's counts).
  const [pipelines, setPipelines] = useState(NONE)
  const defaultPipeline = useMemo(() => busiestPipeline(pipelines), [pipelines])
  const stageOwner = tableState.stage ? pipelines.find((p) => p.stages.some((st) => st.id === tableState.stage)) : null
  const pipeline = pipelines.find((p) => p.id === tableState.pipeline) ?? stageOwner ?? defaultPipeline
  const stage = pipeline?.stages.find((st) => st.id === tableState.stage) ?? null
  const stagesIn = useCallback(
    (pipelineId) => (pipelines.find((p) => p.id === pipelineId) ?? pipeline)?.stages ?? NONE,
    [pipelines, pipeline]
  )

  // Every filter on this page, in one control. Sources and Tags narrow to a
  // set; Types and Opportunities pick one, with "all" meaning unfiltered. With
  // the lead tabs, the CRM's pipeline (when it has more than one) and stage
  // lead, the stages in the CRM's order with their counts.
  const filterGroups = useMemo(() => [
    ...(leadTabs && pipelines.length > 1 ? [
      { id: "pipeline", label: "Pipeline", mode: "single", allValue: defaultPipeline.id, clears: ["stage"],
        items: pipelines.map((p) => ({ value: p.id, label: p.name, count: p.total })), value: pipeline.id },
    ] : []),
    ...(leadTabs && pipelines.length > 0 ? [
      { id: "stage", label: "Stage", mode: "single",
        items: (draft) => stagesIn(draft.pipeline).map((st) => ({ value: st.id, label: st.name, count: st.count })),
        value: stage?.id ?? "all" },
    ] : []),
    { id: "sources", label: "Sources", mode: "multi", items: sources, value: selectedSources },
    { id: "types", label: "Types", mode: "single", items: types, value: selectedType },
    { id: "opportunities", label: "Opportunities", mode: "single",
      items: leadTabs ? OPPORTUNITY_STATUSES : opportunityStatuses, value: selectedOpportunityStatus },
    { id: "tags", label: "Tags", mode: "multi", items: allTags, value: selectedTags },
  ], [leadTabs, pipelines, defaultPipeline, pipeline, stage, stagesIn, sources, selectedSources, types,
      selectedType, opportunityStatuses, selectedOpportunityStatus, allTags, selectedTags])

  // Filters' Apply: every choice at once, so the address changes in one step.
  const applyFilters = (draft) => {
    const one = (value) => (!value || value === "all" ? null : value)
    const list = (value) => (value?.length ? value : null)
    const next = {
      sources: list(draft.sources),
      type: one(draft.types),
      opportunity: one(draft.opportunities),
      tags: list(draft.tags),
    }
    if ("pipeline" in draft) next.pipeline = draft.pipeline === defaultPipeline?.id ? null : draft.pipeline
    if ("stage" in draft) next.stage = one(draft.stage)
    const now = {
      sources: list(selectedSources), type: one(selectedType), opportunity: one(selectedOpportunityStatus),
      tags: list(selectedTags), pipeline: tableState.pipeline || null, stage: tableState.stage || null,
    }
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(now[key]))
    )
    if (Object.keys(changes).length) updateState({ ...changes, page: null })
  }

  // The page of leads to ask for. With the lead tabs, a tab is `lead_stage`
  // and a stage `stage_id`; a stage the address carries is asked for as it is,
  // and dropped once the CRM's pipelines turn out not to have it.
  const requestUrl = useMemo(() => {
    if (ghlClientGroups.length === 0) return null
    const groupsParam = selectedClientGroup !== "all" ? selectedClientGroup : ""
    const { start_date, end_date } = presetToDateRange(datePreset)
    let endpoint = `/api/leads/unified?groups=${groupsParam}&page=${currentPage}&limit=15`
    if (start_date) endpoint += `&start_date=${start_date}`
    if (end_date) endpoint += `&end_date=${end_date}`
    selectedSources.forEach(s => { endpoint += `&source=${encodeURIComponent(s)}` })
    selectedTags.forEach(t => { endpoint += `&tag=${encodeURIComponent(t)}` })
    if (selectedOpportunityStatus !== "all") endpoint += `&opportunity_status=${encodeURIComponent(selectedOpportunityStatus)}`
    if (leadTabs && selectedLeadStage !== "all") endpoint += `&lead_stage=${encodeURIComponent(selectedLeadStage)}`
    if (leadTabs && tableState.stage) endpoint += `&stage_id=${encodeURIComponent(tableState.stage)}`
    return endpoint
  }, [ghlClientGroups.length, selectedClientGroup, datePreset, currentPage, selectedSources, selectedTags,
      selectedOpportunityStatus, leadTabs, selectedLeadStage, tableState.stage])

  // Only the latest request draws the table, however the answers arrive.
  const latestRequest = useRef(0)
  useEffect(() => {
    const id = ++latestRequest.current
    if (!requestUrl) {
      if (!groupsLoading) {
        setContacts([])
        setMetaData({ total_contacts: 0, has_next: false, has_prev: false })
        setLoading(false)
      }
      return
    }
    setLoading(true)
    setError(null)
    apiRequest(requestUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed: ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (id !== latestRequest.current) return
        setContacts(data.contacts || [])
        setMetaData(data.meta || { total_contacts: 0, has_next: false, has_prev: false })
        if (leadTabs) setPipelines(pipelinesOf(data.meta))
      })
      .catch((err) => {
        if (id !== latestRequest.current) return
        setError(err.message)
        setContacts([])
        setMetaData(null)
      })
      .finally(() => {
        if (id === latestRequest.current) setLoading(false)
      })
  }, [requestUrl, groupsLoading, leadTabs])

  // A pipeline or stage the address names that the CRM doesn't have (renamed,
  // removed, another client's) is dropped once the answer says so.
  useEffect(() => {
    if (!leadTabs || loading || !metaData) return
    const changes = {}
    if (tableState.pipeline && !pipelines.some((p) => p.id === tableState.pipeline)) changes.pipeline = null
    if (tableState.stage && !stage) changes.stage = null
    if (Object.keys(changes).length) updateState({ ...changes, page: null })
  }, [leadTabs, loading, metaData, pipelines, stage, tableState.pipeline, tableState.stage, updateState])

  // When embedded for a single group under internal (uncontrolled) selection,
  // auto-select it once groups load. Controlled usage (the Lead Hub page)
  // owns this decision itself, via its own ClientGroupPicker.
  useEffect(() => {
    if (controlledClientGroup !== undefined) return
    if (ghlClientGroups.length === 1 && uncontrolledClientGroup === "all") {
      setUncontrolledClientGroup(ghlClientGroups[0].id)
    }
  }, [controlledClientGroup, ghlClientGroups, uncontrolledClientGroup])

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
    updateState({ sources: null, type: null, opportunity: null, tags: null, pipeline: null, stage: null, page: null })
    if (!clientLocked) setSelectedClientGroup("all")
    setSortColumn("")
    setSortDirection("asc")
  }

  const hasActiveFilters =
    searchQuery ||
    selectedSources.length > 0 ||
    selectedType !== "all" ||
    selectedOpportunityStatus !== "all" ||
    (!clientLocked && selectedClientGroup !== "all") ||
    selectedTags.length > 0 ||
    Boolean(tableState.stage)


  const totalPages = metaData?.total_pages || 1
  const goToPage = (page) => updateState({ page: page > 1 ? String(page) : null })
  const handlePreviousPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1)
  }
  const handleNextPage = () => {
    if (metaData?.has_next) goToPage(currentPage + 1)
  }

  // Pipeline tabs, with the design's count badges — the same figures the
  // Lead Hub page's KPI tiles show, sourced here from this fetch's own
  // meta.stats rather than re-deriving them, since this table already pulls
  // them on every window/group change.
  const pipelineTabs = useMemo(() => {
    if (leadTabs) {
      // Counted by the backend over every other filter; an older one sends
      // none, and the tabs then go without numbers rather than wrong ones.
      const counts = metaData?.lead_stages
      return LEAD_STAGE_TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        badge: counts && counts[tab.key] != null ? Number(counts[tab.key]).toLocaleString() : undefined,
      }))
    }
    const stats = metaData?.stats ?? {}
    // PageTabs tints the badges (purple on the active tab, neutral elsewhere).
    return PIPELINE_TABS.map((tab) => ({
      key: tab.key,
      label: tab.label,
      badge: (stats[tab.stat] ?? 0).toLocaleString(),
    }))
  }, [metaData, leadTabs])

  // The stage picked in Filters, beside them as a chip that takes it off.
  const stageChip = leadTabs && stage && (
    <button
      type="button"
      onClick={() => updateState({ stage: null, page: null })}
      aria-label={`Remove the ${stage.name} stage filter`}
      title={pipelines.length > 1 ? `${pipeline.name} · ${stage.name}` : undefined}
      className={`${TOOLBAR_CHIP} max-w-[240px] shrink-0 whitespace-nowrap`}
    >
      <span className="truncate">Stage: {stage.name}</span>
      <X className="size-[14px] text-pd-subtle" aria-hidden="true" />
    </button>
  )

  return (
    <div className={fill ? "flex min-h-0 min-w-0 flex-1 flex-col" : "min-w-0"}>
      <Stagger className={fill ? "flex min-h-0 flex-1 flex-col gap-6" : "flex flex-col gap-6"}>
        <ErrorBanner error={error} />

        {showStatCards && (
          <StaggerItem>
            <ContactStats metaStats={metaData?.stats} loading={loading} />
          </StaggerItem>
        )}

        <StaggerItem className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <PageTabs
              label={leadTabs ? "Lead stage" : "Pipeline stage"}
              panelId={LEADS_PANEL_ID}
              tabs={pipelineTabs}
              value={leadTabs ? selectedLeadStage : selectedOpportunityStatus}
              onChange={leadTabs
                ? (value) => updateState({ tab: value === "all" ? null : value, page: null })
                : setSelectedOpportunityStatus}
            />

            <div className="flex min-w-0 items-center gap-2.5 md:ml-auto">
              {/* The search gives way first when the row fills up (a stage chip and Clear beside it). */}
              <div className="relative min-w-[120px] md:w-[200px]">
                <Search
                  className="pointer-events-none absolute top-1/2 left-[13px] size-[15px] -translate-y-1/2 text-pd-faint"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search leads…"
                  aria-label="Search leads"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-[38px] w-full pl-9 text-[13px]"
                />
              </div>

              {stageChip}

              <FilterPanel groups={filterGroups} onApply={applyFilters} triggerClassName={TOOLBAR_CHIP} />


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

          <PageTabPanel id={LEADS_PANEL_ID} label="Leads" className={fill ? "mt-4 flex min-h-0 flex-1 flex-col" : "mt-4"}>
            <StyledTable
              fill={fill}
              columns={contactColumns}
              data={filteredAndSortedContacts}
              columnVisibility={columnVisibilityMap}
              searchQuery=""
              clickableFirstColumn={false}
              isLoading={loading}
              onRowClick={(row) => row.contactId && router.push(`/contacts/${encodeURIComponent(row.contactId)}`)}
              initialColumnOrder={visibleColumns}
              onColumnOrderChange={(newOrder) => {
                setVisibleColumns(newOrder)
                // Auto-persist on drag-reorder (debounced inside the hook).
                saveViewDebounced(newOrder)
              }}
            />
          </PageTabPanel>
        </StaggerItem>

        {/* The same pager as every other table (ui/table-container): Previous, the page numbers, Next.
            The pages are the server's, so a number fetches that page. */}
        {totalPages > 1 && (
          <Pagination className={fill ? "shrink-0" : undefined}>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); handlePreviousPage() }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {pageNumbers(currentPage, totalPages).map((page, idx) => (
                <PaginationItem key={`${page}-${idx}`}>
                  {typeof page === "string" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (page !== currentPage) goToPage(page) }}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNextPage() }}
                  className={!metaData?.has_next ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </Stagger>
    </div>
  )
}
