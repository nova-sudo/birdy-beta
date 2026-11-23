"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Download } from "lucide-react"
import { toast } from "sonner"
import getSymbolFromCurrency from "currency-symbol-map"
import { SECTIONS, SectionHeader } from "@/components/by"
import { PAGE } from "@/components/agency/section-parts"
import { clientHref } from "@/components/shell/nav"
import { useClientActions } from "@/components/shell/client-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ErrorBanner } from "@/components/ErrorBanner"
import StyledTable from "@/components/ui/table-container"
import { Stagger, StaggerItem } from "@/components/motion"
import { PageTabPanel, PageTabs } from "@/components/portfolio"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { HealthPill } from "@/components/clients/HealthPill"
import { MetaCampaignsDialog } from "@/components/clients/MetaCampaignsDialog"
import { useColumnViews } from "@/lib/useColumnViews"
import {
  activeGroups as selectActive,
  isActive,
  matchesStatusFilter,
  matchesHealthFilter,
  statusCounts as countByStatus,
  healthCounts as countByHealth,
  HEALTH_VALUES,
} from "@/lib/client-status"
import { COLUMN_MENU_SOURCES, columnMenuSource, buildDynamicColumns, getTagCount } from "@/lib/enhanced-columns-config"
import { flaskIcon as Flask } from "@/lib/icons"
import { metricTone } from "@/lib/metric-tone"
import { usePageViews } from "@/lib/usePageViews"
import { useRememberViewCatalogue } from "@/lib/view-catalogues"
import { STORAGE_KEYS, DEFAULT_DATE_PRESET } from "@/lib/constants"
import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"
import { isAwaitingFirstData } from "@/lib/client-loading"
import { unassignedText } from "@/lib/meta-scope"
import { pdFontClass } from "@/lib/pd-fonts"

const CLIENTS_SECTION = SECTIONS.find((s) => s.id === "clients")

// Ties the status tabs to the table they filter, for anyone navigating by role.
const CLIENTS_PANEL_ID = "clients-table-panel"

/**
 * The Clients page's table as it was before the redesign (commit 6ada1fe's
 * /clients): status tabs, search, the Columns menu with saved views, Import and
 * "+", and the old StyledTable with its columns, health pills, drag-reorder and
 * loading rows. Framed in the new shell: the section header carries the old
 * date range control, and only the table scrolls, inside its card.
 *
 * Adding and importing go through the shell's dialogs; the shell invalidates
 * every client-groups window when they finish, which refreshes this table.
 */
export function OldClientsTable() {
  const router = useRouter()
  const { openAddClient, openImport } = useClientActions()
  const {
    clientGroups: fetchedGroups,
    error: fetchError,
    loading,
    datePreset: selectedDateRange,
    setDatePreset: setSelectedDateRange,
    invalidate: invalidateClientGroups,
    refresh: refreshClientGroups,
    // Totals only: this page never charts a trend, and the per-day series is
    // most of the payload.
  } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const [error, setError] = useState("")
  const [clientGroups, setClientGroups] = useState([])
  // The client whose unassigned Meta campaigns the list's "Assign" opened.
  const [assignGroup, setAssignGroup] = useState(null)
  const [togglingRows, setTogglingRows] = useState(new Set())

  // Opens on Active: the clients being worked on are what the page is for, and
  // paused ones are a tab away.
  const [statusFilter, setStatusFilter] = useState("Active")
  const [searchQuery, setSearchQuery] = useState("")

  // Hook data into local state, so the status toggle can update optimistically.
  useEffect(() => {
    setError(fetchError || "")
    setClientGroups(fetchedGroups.map((group) => ({
      ...group,
      _isPending: group.status === "pending",
      _isCreating: group.status === "creating",
      // The client exists and can be opened, but none of its integrations has
      // finished a first refresh, so its figures are not yet measurements. A
      // freshly imported client shows as a loading row until they land.
      _isSyncing: isAwaitingFirstData(group),
    })))
  }, [fetchedGroups, fetchError])

  const [customMetrics, setCustomMetrics] = useState([])
  useEffect(() => {
    apiRequest("/api/custom-metrics").then(async (res) => {
      if (!res.ok) return
      const data = await res.json()
      setCustomMetrics((data.custom_metrics || []).map((m) => ({
        id: m.id, name: m.name, description: m.description || "",
        source: "Custom Formula", dashboard: (m.dashboards || []).join(", "),
        dashboards: m.dashboards || [], formula: m.formula_display || "",
        formulaParts: m.formula_parts || [], formatType: m.format_type || "integer",
        displayOnDashboard: true, category: "custom", enabled: true,
      })))
    }).catch(() => {})
  }, [])
  const [userCurrency] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.DEFAULT_CURRENCY) ?? null } catch { return null }
  })
  const { savedColumns, saveViewDebounced, viewsLoaded } = useColumnViews("clients")

  // Six tabs on two axes: Active/Inactive are status, Healthy/Warning/Critical
  // are health. The health tabs break down the Active tab, so they only
  // consider active clients.
  const filteredByStatus = useMemo(
    () => clientGroups.filter((g) =>
      HEALTH_VALUES.includes(statusFilter)
        ? isActive(g) && matchesHealthFilter(g, statusFilter)
        : matchesStatusFilter(g, statusFilter)
    ),
    [clientGroups, statusFilter],
  )

  const statusCounts = useMemo(() => countByStatus(clientGroups), [clientGroups])
  const healthCounts = useMemo(() => countByHealth(selectActive(clientGroups)), [clientGroups])

  const columns = useMemo(() => {
    const dynamicColumns = buildDynamicColumns(filteredByStatus)

    const custom = customMetrics
      .filter((m) => m.enabled && (m.dashboards?.includes("clients") || m.dashboard === "Clients"))
      .map((m) => ({
        id: m.id,
        label: m.name,
        visible: true,
        sortable: true,
        category: "formulas",
        type: "formula",
        icons: Flask,
      }))

    // Health is a stored per-client choice rather than anything measured, so it
    // is injected here instead of living in the metric column config.
    const health = {
      id: "health",
      label: "Health",
      visible: true,
      sortable: true,
      category: "core",
      type: "data",
      cell: (_v, row) => <HealthPill health={row?.health} withDot={false} />,
    }

    // Cost per lead reads against the client's own target. Its own `cell` opts
    // it out of the table's formatting, so the currency symbol is added back.
    const withTone = (list) => list.map((col) =>
      col.id === "cost_per_lead"
        ? {
            ...col,
            cell: (value, row) => (
              <span className={metricTone(value, row?.targets?.cpl, "lower")}>
                {value == null || !Number.isFinite(Number(value)) || Number(value) === 0
                  ? "—"
                  : `${getSymbolFromCurrency(userCurrency) || "$"}${Number(value).toLocaleString(undefined, {
                      minimumFractionDigits: 2, maximumFractionDigits: 2,
                    })}`}
              </span>
            ),
          }
        : col
    )

    const seen = new Set()
    const [rawNameCol, ...restDynamic] = withTone(dynamicColumns)
    // Beside the name: campaigns of a shared Meta account no client owns yet.
    const nameCol = rawNameCol?.id === "name" && !rawNameCol.cell ? {
      ...rawNameCol,
      cell: (value, row) => {
        const name = String(value ?? "—")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ")
        const group = row?.original ?? row
        const nudge = unassignedText(group?.meta_scope)
        return nudge ? (
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="max-w-full truncate">{name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAssignGroup(group) }}
              title={nudge}
              aria-label={`${nudge} · Assign`}
              className="whitespace-nowrap rounded-full bg-pd-warning-bg px-2 py-0.5 text-[10px] font-medium text-pd-amber hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {group.meta_scope.unassigned.length} unassigned · <span className="font-semibold text-pd-primary">Assign</span>
            </button>
          </span>
        ) : name
      },
    } : rawNameCol
    const all = nameCol
      ? [nameCol, health, ...restDynamic, ...custom]
      : [health, ...dynamicColumns, ...custom]
    return all.filter((col) => {
      if (seen.has(col.id)) return false
      seen.add(col.id)
      return true
    })
  }, [customMetrics, filteredByStatus, userCurrency])

  const [columnVisibility, setColumnVisibility] = useState(() => {
    const map = {}
    columns.forEach((c) => (map[c.id] = c.visible))
    return map
  })
  // The saved view is an ordered array: which columns show, and in what order.
  const [columnOrder, setColumnOrder] = useState([])

  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setColumnVisibility((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((k) => { updated[k] = false })
      savedColumns.forEach((id) => { updated[id] = true })
      return updated
    })
    if (Array.isArray(savedColumns) && savedColumns.length > 0) {
      setColumnOrder(savedColumns)
    }
  }, [viewsLoaded, savedColumns])

  useEffect(() => {
    setColumnVisibility((prev) => {
      const updated = { ...prev }
      columns.forEach((col) => {
        if (!(col.id in updated)) updated[col.id] = col.visible
      })
      return updated
    })
  }, [columns])

  // The Columns menu speaks in ordered id arrays; this page keeps an id to
  // bool map. "name" always stays on.
  const visibleColumnIds = useMemo(
    () => columns.filter((c) => columnVisibility[c.id]).map((c) => c.id),
    [columns, columnVisibility]
  )

  const setVisibleColumnIds = useCallback((ids) => {
    const on = new Set([...ids, "name"])
    setColumnVisibility((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((k) => { updated[k] = on.has(k) })
      return updated
    })
  }, [])

  const defaultColumnIds = useMemo(() => columns.filter((c) => c.visible).map((c) => c.id), [columns])

  const applyColumnView = useCallback((s) => {
    if (Array.isArray(s.visibleColumns)) setVisibleColumnIds(s.visibleColumns)
  }, [setVisibleColumnIds])

  const pageViews = usePageViews("clients", {
    onApply: applyColumnView,
    // Hold the default view until the saved column layout has loaded.
    ready: viewsLoaded,
  })

  const columnCatalogue = useMemo(
    () => columns
      .filter((c) => c.id !== "name")
      .map((c) => ({ id: c.id, label: c.label ?? c.id, source: columnMenuSource(c) })),
    [columns]
  )
  useRememberViewCatalogue("clients", { label: "Clients Hub", path: "/clients", columns: columnCatalogue })

  const handleStatusToggle = async (groupId, currentStatus) => {
    const newStatus = String(currentStatus).toLowerCase() === "active" ? "Inactive" : "Active"
    setTogglingRows((prev) => new Set(prev).add(groupId))
    try {
      const res = await apiRequest(`/api/client-groups/${groupId}/client-status`, {
        method: "PATCH",
        body: JSON.stringify({ client_status: newStatus }),
      })
      if (res.ok) {
        setClientGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, client_status: newStatus } : g)))
        toast.success(`Client marked as ${newStatus}`)
      } else {
        toast.error("Failed to update client status")
      }
    } catch {
      toast.error("Failed to update client status")
    } finally {
      setTogglingRows((prev) => {
        const next = new Set(prev)
        next.delete(groupId)
        return next
      })
    }
  }

  const filterTabs = [
    { key: "Active", label: "Active", count: statusCounts.active },
    { key: "Healthy", label: "Healthy", count: healthCounts.healthy },
    { key: "Warning", label: "Warning", count: healthCounts.warning },
    { key: "Critical", label: "Critical", count: healthCounts.critical },
    { key: "Inactive", label: "Inactive", count: statusCounts.inactive },
    { key: "all", label: "All Clients", count: statusCounts.all },
  ]

  return (
    <div className={PAGE}>
      <SectionHeader
        section={CLIENTS_SECTION}
        // No tab pill here, so the header keeps two columns and the date range sits on the right.
        className="min-[1440px]:grid-cols-[minmax(0,1fr)_auto]"
        dateRange={
          <div className={pdFontClass}>
            <DateRangeSelect value={selectedDateRange} onChange={setSelectedDateRange} />
          </div>
        }
      />
      {/* Full width. Nothing here scrolls but the table inside its card. */}
      <div className={`${pdFontClass} flex min-h-0 w-full flex-1 flex-col gap-6 px-7 pt-6 pb-6`}>
        <ErrorBanner error={error} />

        <Stagger className="flex min-h-0 flex-1 flex-col">
          {/* Status tabs left, table controls right. */}
          <StaggerItem className="mb-[14px] flex shrink-0 flex-col gap-3 md:flex-row md:items-center">
            <PageTabs
              label="Filter clients by status"
              panelId={CLIENTS_PANEL_ID}
              tabs={filterTabs.map((t) => ({ key: t.key, label: t.label, badge: t.count }))}
              value={statusFilter}
              onChange={setStatusFilter}
            />

            <div className="flex items-center gap-2.5 md:ml-auto">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-[13px] size-[15px] -translate-y-1/2 text-pd-faint"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search clients…"
                  aria-label="Search clients"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-[38px] w-full pl-9 text-[13px] md:w-[200px]"
                />
              </div>

              <ColumnsMenu
                columns={columnCatalogue}
                visibleColumns={visibleColumnIds}
                onChange={setVisibleColumnIds}
                defaultColumns={defaultColumnIds}
                views={pageViews}
                sources={COLUMN_MENU_SOURCES}
              />

              <Button
                variant="outline"
                onClick={openImport}
                aria-label="Import clients from GoHighLevel"
                className="h-[38px] shrink-0 gap-2 px-3 text-[13px]"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>

              <Button
                size="icon"
                onClick={openAddClient}
                aria-label="Add client"
                className="size-[38px] shrink-0"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </StaggerItem>

          <MetaCampaignsDialog
            open={!!assignGroup}
            onOpenChange={(o) => { if (!o) setAssignGroup(null) }}
            group={assignGroup}
            onSaved={() => { invalidateClientGroups?.(); refreshClientGroups?.() }}
          />

          <StaggerItem className="flex min-h-0 flex-1 flex-col">
            <PageTabPanel id={CLIENTS_PANEL_ID} label="Clients" className="mt-4 flex min-h-0 flex-1 flex-col">
              <StyledTable
                fill
                data={filteredByStatus}
                onRowClick={(group) => router.push(clientHref(group.id))}
                columns={columns}
                searchQuery={searchQuery}
                columnVisibility={columnVisibility}
                customMetrics={customMetrics}
                setCustomMetrics={setCustomMetrics}
                enableEnhancedExtraction={true}
                getTagCount={getTagCount}
                isLoading={loading}
                isRowLoading={(row) => row._isPending || row._isCreating || row._isSyncing}
                initialColumnOrder={columnOrder}
                onColumnOrderChange={(newOrder) => {
                  setColumnOrder(newOrder)
                  // A drag-reorder survives a refresh without "Save View".
                  saveViewDebounced(newOrder)
                }}
                enableStatusToggle={true}
                onStatusToggle={handleStatusToggle}
                togglingRows={togglingRows}
                initialPageSize={20}
              />
            </PageTabPanel>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  )
}
