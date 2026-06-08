"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import StyledTable from "@/components/ui/table-container"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { presetToDateRange } from "@/lib/date-utils"
import { hpIcon as HP } from "@/lib/icons"
import {
  Users,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Play,
  Download,
  User,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react"

// ── Call Logs dialog (opened from the Leads tab's "Call Logs" cell) ──────────
function CallLogsDialog({ lead }) {
  const formatDuration = (seconds) => {
    const mins = Math.floor((seconds || 0) / 60)
    const secs = (seconds || 0) % 60
    return `${mins}m ${secs}s`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent hover:bg-muted/50 transition-colors">
          <Phone className="h-4 w-4" />
          {lead.call_logs_count} {lead.call_logs_count === 1 ? "call" : "calls"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white">
        <div className="pb-6 border-b">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold text-foreground">{lead.name}</DialogTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-purple-500" />
                <span>{lead.email}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-purple-500" />
                <span>{lead.phone}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {lead.call_logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Call Logs</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              No recorded calls for this lead in the selected period.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-6">
            {lead.call_logs.map((callLog, index) => (
              <div
                key={index}
                className="group relative p-5 rounded-lg border border-border bg-card hover:border-purple-200 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-purple-100/80 flex items-center justify-center">
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{callLog.caller_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {callLog.call_time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      className={`${callLog.call_status === "outbound"
                        ? "bg-blue-100/80 text-blue-700 border-blue-200"
                        : "bg-green-100/80 text-green-700 border-green-200"
                        } border text-xs font-medium`}
                      variant="outline"
                    >
                      {callLog.call_status === "outbound" ? "📤 Outbound" : "📥 Inbound"}
                    </Badge>
                    {callLog.transfer && (
                      <Badge
                        variant="outline"
                        className="bg-amber-100/80 text-amber-700 border-amber-200 text-xs font-medium"
                      >
                        ↗ Transferred
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</p>
                    <p className="text-sm font-semibold text-foreground">{formatDuration(callLog.duration)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Speed to Lead</p>
                    <p className="text-sm font-semibold text-foreground">{formatDuration(callLog.speed_to_lead)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Group</p>
                    <p className="text-sm font-semibold text-foreground">{callLog.group || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">From</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{callLog.from_number || "—"}</p>
                  </div>
                  <div className="text-muted-foreground/30">→</div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">To</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{callLog.to_number || "—"}</p>
                  </div>
                </div>

                {callLog.recording_url && (
                  <div className="flex gap-2 pt-3">
                    <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent hover:bg-purple-50">
                      <a href={callLog.recording_url} target="_blank" rel="noopener noreferrer">
                        <Play className="h-4 w-4 mr-2" />
                        Play
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent hover:bg-purple-50">
                      <a href={callLog.recording_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Column definitions per tab ───────────────────────────────────────────────
const OVERVIEW_COLUMNS = [
  { id: "name", label: "Client", sortable: true },
  { id: "leads", label: "Leads Called", sortable: true, icons: HP },
  { id: "total_calls", label: "Total Calls", sortable: true, icons: HP },
  { id: "inbound", label: "Inbound", sortable: true, icons: HP },
  { id: "outbound", label: "Outbound", sortable: true, icons: HP },
  { id: "transfers", label: "Transfers", sortable: true, icons: HP },
]

const STATUS_CELL = (_v, row) => (
  <Badge
    variant="outline"
    className={`border-0 rounded-full font-semibold ${row.status === "Inactive" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#DCFCE7] text-[#166534]"}`}
  >
    {row.status || "Active"}
  </Badge>
)

const CALLS_CELL = (_v, row) =>
  row.call_logs_count > 0 ? (
    <CallLogsDialog lead={row} />
  ) : (
    <span className="text-sm text-muted-foreground">No calls</span>
  )

const DATE_CELL = (v) => (v ? new Date(v).toLocaleDateString() : "—")

const LEAD_COLUMNS = [
  { id: "name", label: "Name", sortable: true },
  { id: "client", label: "Client", sortable: true, icons: HP },
  { id: "email", label: "Email", icons: HP },
  { id: "phone", label: "Phone", icons: HP },
  { id: "company", label: "Company", icons: HP },
  { id: "location", label: "Location", icons: HP },
  { id: "first_call", label: "First Call", sortable: true, icons: HP, cell: DATE_CELL },
  { id: "last_call", label: "Last Call", sortable: true, icons: HP, cell: DATE_CELL },
  { id: "calls", label: "Call Logs", icons: HP, cell: CALLS_CELL },
  { id: "status", label: "Status", cell: STATUS_CELL },
]

const MEMBER_COLUMNS = [
  { id: "name", label: "Name", sortable: true },
  { id: "email", label: "Email", icons: HP },
  { id: "phone", label: "Phone", icons: HP },
  { id: "extension", label: "Extension", icons: HP },
  { id: "status", label: "Status", icons: HP, cell: STATUS_CELL },
]

const TAB_COLUMNS = { overview: OVERVIEW_COLUMNS, leads: LEAD_COLUMNS, members: MEMBER_COLUMNS }
const allVisible = (cols) => Object.fromEntries(cols.map((c) => [c.id, true]))

const LEADS_PER_PAGE = 15

export default function CallCenterPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } = useClientGroups(DEFAULT_DATE_PRESET)

  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")

  // Column visibility (one map per tab) + the shared dropdown's open state.
  const [colVis, setColVis] = useState({
    overview: allVisible(OVERVIEW_COLUMNS),
    leads: allVisible(LEAD_COLUMNS),
    members: allVisible(MEMBER_COLUMNS),
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)

  // Leads tab (server-paginated, windowed by the date preset).
  const [leads, setLeads] = useState([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsPage, setLeadsPage] = useState(1)
  const [leadsTotal, setLeadsTotal] = useState(0)
  // Client filter (top-right picker, like the Leads hub). "all" or a client_group id.
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [gridOpen, setGridOpen] = useState(false)
  const [groupSearch, setGroupSearch] = useState("")
  const gridRef = useRef(null)

  // Members tab (account-wide HotProspector team).
  const [members, setMembers] = useState([])

  // ── Overview rows: one per client, windowed call KPIs from /api/client-groups ──
  const overviewRows = useMemo(
    () =>
      (clientGroups || []).map((g) => {
        const cs = g.hotprospector?.call_stats || {}
        return {
          id: g.id,
          name: g.name || "Unnamed Client",
          ghl_location_id: g.ghl_location_id,
          // Windowed "leads" = leads contacted in the period. HP leads have no
          // creation date, so call activity is the only windowable lead metric;
          // total_leads (full pool) is the same across presets by design.
          leads: cs.leads_with_calls ?? 0,
          total_calls: cs.total_calls ?? 0,
          inbound: cs.inbound_count ?? 0,
          outbound: cs.outbound_count ?? 0,
          transfers: cs.transfers ?? 0,
          original: g,
        }
      }),
    [clientGroups],
  )

  // Apply the top-right client-filter selection to the Overview.
  const filteredOverview = useMemo(
    () =>
      selectedClientGroup === "all"
        ? overviewRows
        : overviewRows.filter((r) => r.id === selectedClientGroup),
    [overviewRows, selectedClientGroup],
  )

  // The selected client's GHL location id (drives the Leads fetch); null for "all".
  const selectedLocationId = useMemo(() => {
    if (selectedClientGroup === "all") return null
    return (clientGroups || []).find((g) => g.id === selectedClientGroup)?.ghl_location_id || null
  }, [clientGroups, selectedClientGroup])

  // ── Stat cards: windowed totals across clients ──
  const totals = useMemo(
    () =>
      filteredOverview.reduce(
        (acc, r) => ({
          leads: acc.leads + (r.leads || 0),
          calls: acc.calls + (r.total_calls || 0),
          inbound: acc.inbound + (r.inbound || 0),
          outbound: acc.outbound + (r.outbound || 0),
        }),
        { leads: 0, calls: 0, inbound: 0, outbound: 0 },
      ),
    [filteredOverview],
  )

  // ── Fetch leads (Leads tab) whenever the window / drill / page changes ──
  useEffect(() => {
    if (activeTab !== "leads") return
    let cancelled = false
    const run = async () => {
      setLeadsLoading(true)
      try {
        const { start_date, end_date } = presetToDateRange(datePreset)
        const qs = new URLSearchParams({
          skip: String((leadsPage - 1) * LEADS_PER_PAGE),
          limit: String(LEADS_PER_PAGE),
        })
        if (selectedLocationId) qs.set("location_id", selectedLocationId)
        if (start_date) qs.set("start_date", start_date)
        if (end_date) qs.set("end_date", end_date)
        const res = await apiRequest(`/api/hotprospector/call-center?${qs.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setLeads((data.data || []).map(mapLead))
        setLeadsTotal(data.meta?.total ?? 0)
      } catch (err) {
        if (cancelled) return
        console.error("Error loading call-center leads:", err)
        setLeads([])
        setLeadsTotal(0)
      } finally {
        if (!cancelled) setLeadsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, datePreset, selectedLocationId, leadsPage])

  // ── Fetch members once ──
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await apiRequest("/api/hotprospector/members")
        if (!res.ok) {
          if (!cancelled) setMembers([])
          return
        }
        const data = await res.json()
        if (cancelled) return
        setMembers(
          (data.data || []).map((m) => ({
            id: m.memberId,
            name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "—",
            email: m.email || "—",
            phone: m.mobile || m.direct_number || m.inbound_phone || "—",
            extension: m.phone_extension || "—",
            status: m.member_status || "Active",
          })),
        )
      } catch {
        if (!cancelled) setMembers([])
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const mapLead = (lead) => {
    const fullName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
    const logs = lead.call_logs || []
    // Only dates a HP lead carries are its call times; expose first/last (windowed).
    const isos = logs.map((l) => l.call_time_iso).filter(Boolean).sort()
    return {
      id: lead.id,
      name: fullName || lead.phone || lead.email || "—",
      client: lead.client_name || "—",
      email: lead.email || "—",
      phone: lead.phone || lead.mobile || "—",
      company: lead.company || "—",
      location: [lead.city, lead.state].filter(Boolean).join(", ") || "—",
      first_call: isos[0] || null,
      last_call: isos[isos.length - 1] || null,
      call_logs: logs,
      call_logs_count: lead.call_logs_count ?? logs.length,
      status: "Active",
    }
  }

  // ── Date preset change: reset leads paging ──
  const handlePresetChange = (preset) => {
    setDatePreset(preset)
    setLeadsPage(1)
  }

  // ── Top-right client picker (mirrors the Leads hub group picker) ──
  const clientGridItems = useMemo(
    () => [
      { id: "all", name: "All Clients" },
      ...(clientGroups || []).map((g) => ({ id: g.id, name: g.name || "Unnamed Client" })),
    ],
    [clientGroups],
  )
  const filteredClientGrid = useMemo(
    () => clientGridItems.filter((it) => it.name.toLowerCase().includes(groupSearch.toLowerCase())),
    [clientGridItems, groupSearch],
  )
  const selectedClientLabel = useMemo(() => {
    if (selectedClientGroup === "all") return "All Clients"
    return (clientGroups || []).find((g) => g.id === selectedClientGroup)?.name || "All Clients"
  }, [selectedClientGroup, clientGroups])
  const pickClient = (id) => {
    setSelectedClientGroup(id)
    setGridOpen(false)
    setGroupSearch("")
    setLeadsPage(1)
  }

  // Close the picker on outside click.
  useEffect(() => {
    if (!gridOpen) return
    const onDocClick = (e) => {
      if (gridRef.current && !gridRef.current.contains(e.target)) setGridOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [gridOpen])

  // ── Drill from an Overview client row into the Leads tab ──
  const handleDrillIn = (group) => {
    if (!group?.id) return
    setSelectedClientGroup(group.id)
    setLeadsPage(1)
    setActiveTab("leads")
  }

  // ── Column-visibility dropdown wiring (operates on the active tab's columns) ──
  const activeColumns = TAB_COLUMNS[activeTab]
  const activeVis = colVis[activeTab]
  const toggleCol = (id) =>
    setColVis((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [id]: !(prev[activeTab][id] ?? true) },
    }))
  const selectAllCols = () => setColVis((prev) => ({ ...prev, [activeTab]: allVisible(activeColumns) }))
  const clearCols = () =>
    setColVis((prev) => ({
      ...prev,
      // keep the first (name) column — StyledTable always shows it anyway
      [activeTab]: Object.fromEntries(activeColumns.map((c, i) => [c.id, i === 0])),
    }))

  const leadsTotalPages = Math.max(1, Math.ceil(leadsTotal / LEADS_PER_PAGE))

  const StatCard = ({ label, value, desc, Icon }) => (
    <Card className="border rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-[#71658B] font-medium">{label}</CardTitle>
        <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
          <Icon className="h-5 w-5 text-purple-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{groupsLoading ? "—" : value.toLocaleString()}</div>
        <p className="text-xs text-[#71658B] text-muted-foreground mt-1">{desc}</p>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto">
      <div className="flex flex-col gap-6">
        {/* Header + toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl lg:text-3xl py-2 md:py-0 font-bold text-foreground text-center md:text-left whitespace-nowrap">
              Sales Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center md:text-left">
              Call-center performance across your Hot Prospector clients
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 flex-nowrap overflow-x-auto md:overflow-x-visible md:gap-1 md:py-1 md:px-1 w-fit mx-auto md:mx-0">
            <DateRangeSelect value={datePreset} onChange={handlePresetChange} />

            {/* Client picker — filters the Overview and scopes the Leads tab */}
            <div className="relative" ref={gridRef}>
              <button
                onClick={() => setGridOpen((p) => !p)}
                className="h-10 bg-white font-semibold border border-gray-200 rounded-md px-3 flex items-center gap-2 text-sm min-w-[130px] max-w-[200px] hover:bg-gray-50 transition-colors"
              >
                <span className="truncate flex-1 text-left text-gray-800">{selectedClientLabel}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${gridOpen ? "rotate-180" : ""}`} />
              </button>
              {gridOpen && (
                <div className="absolute z-50 mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-max">
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  {filteredClientGrid.length > 0 ? (
                    <div className="grid gap-1 max-h-72 overflow-y-auto" style={{ gridTemplateColumns: "repeat(5, minmax(100px, 1fr))" }}>
                      {filteredClientGrid.map((item) => {
                        const isSel = item.id === selectedClientGroup
                        return (
                          <button
                            key={item.id}
                            onClick={() => pickClient(item.id)}
                            title={item.name}
                            className={`text-xs px-2.5 py-2 rounded-md border text-left truncate transition-colors whitespace-nowrap ${
                              isSel
                                ? "bg-purple-600 text-white border-purple-600 font-semibold"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                            }`}
                          >
                            {item.name}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3 px-6">No clients found</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Stat cards (windowed) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Leads Called" value={totals.leads} desc="Leads contacted in the period" Icon={Users} />
          <StatCard label="Total Calls" value={totals.calls} desc="In the selected period" Icon={Phone} />
          <StatCard label="Inbound" value={totals.inbound} desc="Inbound calls" Icon={PhoneIncoming} />
          <StatCard label="Outbound" value={totals.outbound} desc="Outbound calls" Icon={PhoneOutgoing} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <TabsList className="flex-1 justify-start overflow-x-auto">
              <TabsTrigger value="overview">
                <Users className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="leads">
                <Phone className="h-4 w-4 mr-2" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="members">
                <User className="h-4 w-4 mr-2" />
                Members
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 w-fit shrink-0">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white h-10 w-fit md:w-48 text-sm"
              />
              <ColumnVisibilityDropdown
                isOpen={colMenuOpen}
                setIsOpen={setColMenuOpen}
                categories={[{ id: "all", label: "All" }]}
                selectedCategory="all"
                setSelectedCategory={() => {}}
                categoryCounts={{ all: activeColumns.length }}
                filteredColumns={activeColumns}
                columnVisibility={activeVis}
                toggleColumnVisibility={toggleCol}
                getIcon={(col) => (col.icons ? col.icons.src || col.icons : null)}
                selectAll={selectAllCols}
                clearAll={clearCols}
                save={() => setColMenuOpen(false)}
              />
            </div>
          </div>

          {/* Overview — one row per client, windowed KPIs (click to drill into Leads) */}
          <TabsContent value="overview" className="mt-4">
            <StyledTable
              columns={OVERVIEW_COLUMNS}
              data={filteredOverview}
              columnVisibility={colVis.overview}
              searchQuery={searchQuery}
              isLoading={groupsLoading}
              onRowClick={handleDrillIn}
            />
          </TabsContent>

          {/* Leads — one row per lead, windowed call logs */}
          <TabsContent value="leads" className="mt-4">
            {selectedClientGroup !== "all" && (
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" className="gap-2 bg-purple-50 text-purple-700 border-purple-200">
                  Client: <span className="font-semibold">{selectedClientLabel}</span>
                  <button onClick={() => pickClient("all")} className="ml-1 hover:text-purple-900" aria-label="Show all clients">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
                <span className="text-xs text-muted-foreground">Showing this client only</span>
              </div>
            )}

            <StyledTable
              columns={LEAD_COLUMNS}
              data={leads}
              columnVisibility={colVis.leads}
              searchQuery={searchQuery}
              isLoading={leadsLoading}
            />

            {leadsTotal > LEADS_PER_PAGE && (
              <div className="flex items-center justify-center p-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                    disabled={leadsPage === 1 || leadsLoading}
                    className="hover:bg-purple-200 gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm font-medium px-4">
                    Page {leadsPage} of {leadsTotalPages}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeadsPage((p) => Math.min(leadsTotalPages, p + 1))}
                    disabled={leadsPage >= leadsTotalPages || leadsLoading}
                    className="hover:bg-purple-200 gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Members — account-wide HotProspector team */}
          <TabsContent value="members" className="mt-4">
            <StyledTable
              columns={MEMBER_COLUMNS}
              data={members}
              columnVisibility={colVis.members}
              searchQuery={searchQuery}
              isLoading={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
