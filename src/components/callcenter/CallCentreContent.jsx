"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import StyledTable from "@/components/ui/table-container"
import { PageTabPanel, PageTabs } from "@/components/portfolio"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { usePageViews } from "@/lib/usePageViews"
import { apiRequest } from "@/lib/api"
import { STORAGE_KEYS } from "@/lib/constants"
import { presetToDateRange } from "@/lib/date-utils"
import { windowCallTotals } from "@/lib/saleshub-totals"
import { hpIcon as HP } from "@/lib/icons"
import {
  CALLS_FETCH_MULTIPLIER,
  MIN_CALLS_TO_FETCH,
  MAX_LEADS_TO_FETCH,
  MIN_CALLS_LIMIT,
  MAX_CALLS_LIMIT,
  DEFAULT_CALLS_LIMIT,
} from "@/constants"
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
  ChevronDown,
  LayoutGrid,
  Search,
  X,
  SlidersHorizontal,
  Loader2,
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
  { id: "total_leads", label: "Total Leads", sortable: true, icons: HP },
  { id: "leads", label: "Leads Called", sortable: true, icons: HP },
  { id: "total_calls", label: "Total Calls", sortable: true, icons: HP },
  { id: "inbound", label: "Inbound", sortable: true, icons: HP },
  { id: "outbound", label: "Outbound", sortable: true, icons: HP },
  { id: "transfers", label: "Transfers", sortable: true, icons: HP },
  { id: "talk_time", label: "Talk Time (min)", sortable: true, icons: HP },
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
  { id: "email", label: "Email", sortable: true, icons: HP },
  { id: "phone", label: "Phone", sortable: true, icons: HP },
  { id: "company", label: "Company", sortable: true, icons: HP },
  { id: "location", label: "Location", sortable: true, icons: HP },
  { id: "first_call", label: "First Call", sortable: true, icons: HP, cell: DATE_CELL },
  { id: "last_call", label: "Last Call", sortable: true, icons: HP, cell: DATE_CELL },
  { id: "calls", label: "Call Logs", sortable: true, icons: HP, cell: CALLS_CELL },
  { id: "status", label: "Status", sortable: true, cell: STATUS_CELL },
]

const MEMBER_COLUMNS = [
  { id: "name", label: "Name", sortable: true },
  { id: "email", label: "Email", sortable: true, icons: HP },
  { id: "phone", label: "Phone", sortable: true, icons: HP },
  { id: "status", label: "Status", sortable: true, icons: HP, cell: STATUS_CELL },
  { id: "outbound", label: "Outbound", sortable: true, icons: HP },
  { id: "inbound", label: "Inbound", sortable: true, icons: HP },
  { id: "answered", label: "Answered", sortable: true, icons: HP },
  { id: "answer_rate", label: "Answer Rate", sortable: true, icons: HP },
  { id: "convos", label: "Convos", sortable: true, icons: HP },
  { id: "appts", label: "Appts", sortable: true, icons: HP },
  { id: "talk_min", label: "Talk (min)", sortable: true, icons: HP },
]

const DIRECTION_CELL = (_v, row) => (
  <Badge
    variant="outline"
    className={`${row.direction === "outbound"
      ? "bg-blue-100/80 text-blue-700 border-blue-200"
      : "bg-green-100/80 text-green-700 border-green-200"
      } border text-xs font-medium`}
  >
    {row.direction === "outbound" ? "Outbound" : "Inbound"}
  </Badge>
)

const DURATION_CELL = (v) => {
  const mins = Math.floor((v || 0) / 60)
  const secs = (v || 0) % 60
  return `${mins}m ${secs}s`
}

const CALL_TIME_CELL = (v) => (v ? new Date(v).toLocaleString() : "—")

const RECORDING_CELL = (_v, row) =>
  row.recording_url ? (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" asChild>
        <a href={row.recording_url} target="_blank" rel="noopener noreferrer" title="Play recording">
          <Play className="h-3.5 w-3.5" />
        </a>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" asChild>
        <a href={row.recording_url} download title="Download recording">
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  )

const CALL_COLUMNS = [
  { id: "caller_name", label: "Lead", sortable: true, icons: HP },
  { id: "client", label: "Client", sortable: true, icons: HP },
  { id: "direction", label: "Direction", sortable: true, icons: HP, cell: DIRECTION_CELL },
  { id: "duration", label: "Duration", sortable: true, icons: HP, cell: DURATION_CELL },
  { id: "from_number", label: "From", sortable: true, icons: HP },
  { id: "to_number", label: "To", sortable: true, icons: HP },
  { id: "call_time", label: "Call Time", sortable: true, icons: HP, cell: CALL_TIME_CELL },
  { id: "recording", label: "Recording", icons: HP, cell: RECORDING_CELL },
]

const TAB_COLUMNS = { overview: OVERVIEW_COLUMNS, leads: LEAD_COLUMNS, members: MEMBER_COLUMNS, calls: CALL_COLUMNS }

// The section tabs, with the design's 14px leading glyph. Overview and Members
// are hub-only: Overview lists one row per client, and Members is account-wide
// team data with no per-client filter upstream — neither means anything once
// the view is already scoped to a single client.
const SECTION_TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid, hubOnly: true },
  { key: "leads", label: "Leads", icon: User, hubOnly: false },
  { key: "members", label: "Members", icon: Users, hubOnly: true },
  { key: "calls", label: "Calls", icon: Phone, hubOnly: false },
]

// Ties the tablist to the panel it swaps, for anyone navigating by role.
const TABLE_PANEL_ID = "sales-hub-table-panel"

// Every control in the toolbar row wears the design's dropdown trigger: 38px
// tall, white, hairline border, 10px radius, Inter 600 13px.
const TOOLBAR_CHIP =
  "flex h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border border-pd-border bg-pd-surface px-[13px] text-[13px] font-semibold text-pd-body hover:bg-pd-divider" 

const allVisible = (cols) => Object.fromEntries(cols.map((c) => [c.id, true]))

const clampCallsLimit = (n) => Math.min(MAX_CALLS_LIMIT, Math.max(MIN_CALLS_LIMIT, Number(n) || DEFAULT_CALLS_LIMIT))

// ── Calls tab filters: recent-calls count, direction, duration range ──
function CallsFilterDropdown({
  open,
  setOpen,
  recentLimitInput,
  onRecentLimitChange,
  onRecentLimitCommit,
  minLimit,
  maxLimit,
  direction,
  setDirection,
  durationMinMinutes,
  setDurationMinMinutes,
  durationMinSeconds,
  setDurationMinSeconds,
  durationMaxMinutes,
  setDurationMaxMinutes,
  durationMaxSeconds,
  setDurationMaxSeconds,
  onClear,
}) {
  const activeCount = [
    direction !== "all",
    durationMinMinutes !== "" || durationMinSeconds !== "",
    durationMaxMinutes !== "" || durationMaxSeconds !== "",
  ].filter(Boolean).length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={TOOLBAR_CHIP}>
          <SlidersHorizontal className="size-[14px]" />
          <span className="hidden lg:inline">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pd-primary px-1 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="bg-white p-4 w-[340px] space-y-4"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-1.5" onFocusCapture={(e) => e.stopPropagation()}>
          <label htmlFor="recent-calls-limit" className="text-xs font-medium text-muted-foreground">
            Show last
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="recent-calls-limit"
              type="number"
              min={minLimit}
              max={maxLimit}
              value={recentLimitInput}
              onChange={(e) => onRecentLimitChange(e.target.value)}
              onBlur={onRecentLimitCommit}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter") e.currentTarget.blur()
              }}
              className="h-9 w-20 text-sm"
            />
            <span className="text-sm text-muted-foreground">calls</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Direction</span>
          <div className="flex gap-1">
            {[
              ["all", "All"],
              ["inbound", "Inbound"],
              ["outbound", "Outbound"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDirection(id)}
                className={`flex-1 h-8 rounded-md text-xs font-medium border transition-colors ${
                  direction === id
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5" onFocusCapture={(e) => e.stopPropagation()}>
          <span className="text-xs font-medium text-muted-foreground">Duration</span>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              placeholder="Min"
              value={durationMinMinutes}
              onChange={(e) => setDurationMinMinutes(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-9 text-sm w-14"
            />
            <span className="text-xs text-muted-foreground">m</span>
            <Input
              type="number"
              min={0}
              max={59}
              placeholder="Sec"
              value={durationMinSeconds}
              onChange={(e) => setDurationMinSeconds(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-9 text-sm w-14"
            />
            <span className="text-xs text-muted-foreground">s</span>
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="number"
              min={0}
              placeholder="Max"
              value={durationMaxMinutes}
              onChange={(e) => setDurationMaxMinutes(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-9 text-sm w-14"
            />
            <span className="text-xs text-muted-foreground">m</span>
            <Input
              type="number"
              min={0}
              max={59}
              placeholder="Sec"
              value={durationMaxSeconds}
              onChange={(e) => setDurationMaxSeconds(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-9 text-sm w-14"
            />
            <span className="text-xs text-muted-foreground">s</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t">
          <Button variant="ghost" size="sm" onClick={onClear} className="border border-gray-300 rounded-md">
            Clear
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-md bg-purple-600 text-white font-semibold"
          >
            Done
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Leads tab filter: hide leads with no dialer activity ──
function LeadsFilterDropdown({ open, setOpen, hideNoDialerActivity, setHideNoDialerActivity }) {
  const activeCount = hideNoDialerActivity ? 1 : 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={TOOLBAR_CHIP}>
          <SlidersHorizontal className="size-[14px]" />
          <span className="hidden lg:inline">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pd-primary px-1 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="bg-white p-4 w-[300px] space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox
            checked={hideNoDialerActivity}
            onCheckedChange={(checked) => setHideNoDialerActivity(!!checked)}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="block font-medium text-foreground">Hide No-Dialer-Activity Leads</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Only show leads the dialer has called in the selected period.
            </span>
          </span>
        </label>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const flattenCalls = (leadsData) =>
  (leadsData || []).flatMap((lead) => {
    const fullName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.phone || lead.email || "—"
    return (lead.call_logs || []).map((log, idx) => ({
      id: `${lead.id}-${idx}`,
      caller_name: fullName,
      client: lead.client_name || "—",
      direction: log.call_status === "outbound" ? "outbound" : "inbound",
      duration: log.duration || 0,
      from_number: log.from_number || "—",
      to_number: log.to_number || "—",
      call_time: log.call_time_iso || null,
      recording_url: log.recording_url || null,
    }))
  })

// Leads still load the *entire* windowed dataset client-side, so the table
// can sort/paginate across all of it (not just one server page) — matching
// how Overview/Members already work. But pulling it in one shot before
// rendering anything meant a large client sat on a static skeleton for as
// long as its full dataset took (multi-second, worse on "All Clients").
// Split the fetch in two so something real paints almost immediately:
//   1. One small first page, rendered the moment it lands.
//   2. The remainder streamed in behind it at a larger batch size, appended
//      to the table as each concurrent chunk resolves — background loading,
//      visible progress, no second wait before the rest shows up.
const LEADS_FIRST_BATCH_SIZE = 40
const LEADS_BACKGROUND_BATCH_SIZE = 200
const LEADS_BACKGROUND_CONCURRENCY = 6

// showGroupFilter controls the two hub-only tabs (Overview lists one row per
// client; Members is account-wide HotProspector team data with no per-client
// filter available upstream) — neither makes sense once the view is already
// locked to a single client group.
//
// The client selection is controlled when `selectedClientGroup` is passed and
// internal otherwise. The Sales Hub renders the picker itself, in its own
// header row, and so owns the value; /clients/[id] is already scoped to one
// client and never moves it, so it passes nothing and this keeps its own.
export function CallCentreContent({
  clientGroups,
  groupsLoading,
  datePreset,
  showGroupFilter = true,
  showStatCards = true,
  selectedClientGroup: controlledClientGroup,
  onSelectClientGroup,
}) {
  const [activeTab, setActiveTab] = useState(showGroupFilter ? "overview" : "leads")
  const [searchQuery, setSearchQuery] = useState("")

  // Column visibility (one map per tab) + the shared dropdown's open state.
  const [colVis, setColVis] = useState({
    overview: allVisible(OVERVIEW_COLUMNS),
    leads: allVisible(LEAD_COLUMNS),
    members: allVisible(MEMBER_COLUMNS),
    calls: allVisible(CALL_COLUMNS),
  })

  // Leads tab (fully loaded, windowed by the date preset — sorted/paginated client-side).
  const [leads, setLeads] = useState([])
  // True only until the first (small) batch has rendered — the table's own
  // skeleton reads this. Background loading of the remaining batches is
  // tracked separately so the table never re-shows a skeleton once rows exist.
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsBackgroundLoading, setLeadsBackgroundLoading] = useState(false)
  const [leadsTotal, setLeadsTotal] = useState(0)
  // Client filter: "all" or a client_group id. Controlled by the page on the
  // Sales Hub, internal on /clients/[id].
  const [uncontrolledClientGroup, setUncontrolledClientGroup] = useState("all")
  const selectedClientGroup = controlledClientGroup ?? uncontrolledClientGroup
  const setSelectedClientGroup = onSelectClientGroup ?? setUncontrolledClientGroup
  // Leads tab filter: hide leads with no dialer activity. Sent to the backend
  // as has_calls=true so it's filtered against the whole dataset, not just
  // whatever page/batch has already been fetched.
  const [leadsFilterOpen, setLeadsFilterOpen] = useState(false)
  const [hideNoDialerActivity, setHideNoDialerActivity] = useState(false)

  // Members tab (account-wide HotProspector team).
  const [members, setMembers] = useState([])

  // Calls tab (most recent calls, flattened from the leads endpoint).
  const [calls, setCalls] = useState([])
  const [callsLoading, setCallsLoading] = useState(false)
  const [recentCallsLimit, setRecentCallsLimit] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SALES_HUB_CALLS_LIMIT)
      return stored ? clampCallsLimit(stored) : DEFAULT_CALLS_LIMIT
    } catch {
      return DEFAULT_CALLS_LIMIT
    }
  })
  // Raw text of the limit input, kept separate from recentCallsLimit so the
  // field can be freely edited (including a transient empty string while the
  // user backspaces) without being clamped back to a value on every keystroke.
  const [callsLimitInput, setCallsLimitInput] = useState(String(recentCallsLimit))
  const commitCallsLimit = () => setRecentCallsLimit(clampCallsLimit(callsLimitInput))
  // Calls tab filters (client-side, applied on top of the fetched batch).
  const [callsFilterOpen, setCallsFilterOpen] = useState(false)
  const [callDirection, setCallDirection] = useState("all")
  const [callDurationMinMinutes, setCallDurationMinMinutes] = useState("")
  const [callDurationMinSeconds, setCallDurationMinSeconds] = useState("")
  const [callDurationMaxMinutes, setCallDurationMaxMinutes] = useState("")
  const [callDurationMaxSeconds, setCallDurationMaxSeconds] = useState("")
  const clearCallFilters = () => {
    setCallDirection("all")
    setCallDurationMinMinutes("")
    setCallDurationMinSeconds("")
    setCallDurationMaxMinutes("")
    setCallDurationMaxSeconds("")
  }

  // ── Overview rows: one per client, windowed call KPIs from /api/client-groups ──
  //
  // total_calls/inbound/outbound/talk_time come from hotprospector.daily_calls
  // (windowCallTotals), the same per-day series the Sales-Hub trend chart
  // sums, rather than hotprospector.call_stats: that preset cache only
  // refreshes once a day per location (hp-tick's cron cadence) so it can run
  // stale against current storage, and drifted from the chart's own totals
  // for exactly that reason. leads/transfers stay on call_stats — see
  // saleshub-totals.js's file header for why those two don't move.
  const overviewRows = useMemo(
    () =>
      (clientGroups || []).map((g) => {
        const cs = g.hotprospector?.call_stats || {}
        const daily = windowCallTotals(g.hotprospector?.daily_calls, datePreset)
        return {
          id: g.id,
          name: g.name || "Unnamed Client",
          ghl_location_id: g.ghl_location_id,
          // Windowed "leads" = leads contacted in the period. HP leads have no
          // creation date, so call activity is the only windowable lead metric;
          // total_leads (full pool) is the same across presets by design.
          total_leads: g.hotprospector?.metrics?.total_leads ?? 0,
          leads: cs.leads_with_calls ?? 0,
          total_calls: daily.calls,
          inbound: daily.inbound,
          outbound: daily.outbound,
          transfers: cs.transfers ?? 0,
          talk_time: daily.talk,
          original: g,
        }
      }),
    [clientGroups, datePreset],
  )

  // Apply the top-right client-filter selection, then hide 0-call clients from
  // this view only — clientGroups/overviewRows themselves are untouched, so the
  // Leads/Members tabs (which don't read overviewRows) are unaffected. This just
  // narrows what the Overview table (and its derived stat cards) renders.
  const filteredOverview = useMemo(
    () =>
      (selectedClientGroup === "all"
        ? overviewRows
        : overviewRows.filter((r) => r.id === selectedClientGroup)
      ).filter((r) => r.total_calls > 0),
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

  // ── Fetch leads (Leads tab) whenever the window / drill changes ──
  //    Still ends up pulling every page (sorting/pagination in the table
  //    operates on the full windowed dataset, not just one server page), but
  //    renders the first small batch immediately and streams the rest in
  //    behind it — see the LEADS_FIRST_BATCH_SIZE comment above.
  useEffect(() => {
    if (activeTab !== "leads") return
    let cancelled = false
    const run = async () => {
      setLeadsLoading(true)
      setLeadsBackgroundLoading(false)
      setLeadsTotal(0)
      try {
        const { start_date, end_date } = presetToDateRange(datePreset)
        const baseParams = {}
        if (selectedLocationId) baseParams.location_id = selectedLocationId
        if (start_date) baseParams.start_date = start_date
        if (end_date) baseParams.end_date = end_date
        if (hideNoDialerActivity) baseParams.has_calls = "true"

        const fetchBatch = async (skip, limit) => {
          const qs = new URLSearchParams({
            ...baseParams,
            skip: String(skip),
            limit: String(limit),
          })
          const res = await apiRequest(`/api/hotprospector/call-center?${qs.toString()}`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        }

        // Small first page — get real rows on screen as fast as possible
        // instead of holding a skeleton for however long the full dataset takes.
        // Nothing has rendered yet at this point, so a failure here still
        // clears to empty (the outer catch below) — same as the old behavior.
        const first = await fetchBatch(0, LEADS_FIRST_BATCH_SIZE)
        if (cancelled) return
        const firstBatch = first.data || []
        const total = first.meta?.total ?? firstBatch.length
        setLeads(firstBatch.map(mapLead))
        setLeadsTotal(total)
        setLeadsLoading(false)

        // Remainder streams in behind it: larger batches, capped concurrency,
        // appended to the table as each concurrent chunk resolves rather than
        // waiting for the entire dataset before anything past the first page
        // is visible. Its own try/catch: the first batch is already on
        // screen by now, so a background-page failure (e.g. one request
        // times out) should leave those rows in place and just stop
        // background loading — not wipe out what the user is already
        // looking at the way a failure before any render would.
        const remainingSkips = []
        for (let skip = firstBatch.length; skip < total; skip += LEADS_BACKGROUND_BATCH_SIZE) {
          remainingSkips.push(skip)
        }

        if (remainingSkips.length > 0) {
          setLeadsBackgroundLoading(true)
          try {
            for (let i = 0; i < remainingSkips.length; i += LEADS_BACKGROUND_CONCURRENCY) {
              if (cancelled) return
              const chunk = remainingSkips.slice(i, i + LEADS_BACKGROUND_CONCURRENCY)
              const results = await Promise.all(chunk.map((skip) => fetchBatch(skip, LEADS_BACKGROUND_BATCH_SIZE)))
              if (cancelled) return
              const newLeads = results.flatMap((data) => (data.data || []).map(mapLead))
              setLeads((prev) => [...prev, ...newLeads])
            }
          } catch (err) {
            if (!cancelled) console.error("Error loading remaining call-center leads (keeping what's loaded so far):", err)
          } finally {
            if (!cancelled) setLeadsBackgroundLoading(false)
          }
        }
      } catch (err) {
        if (cancelled) return
        console.error("Error loading call-center leads:", err)
        setLeads([])
      } finally {
        if (!cancelled) {
          setLeadsLoading(false)
          setLeadsBackgroundLoading(false)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, datePreset, selectedLocationId, hideNoDialerActivity])

  // ── Fetch members (team + per-day dashboard metrics) on preset change ──
  //    getMemberDashboardData is a per-day snapshot, so we pass the selected
  //    window's end date (today when "maximum"/no end date). Account-wide only
  //    (no per-client filter upstream) — skip entirely when scoped to one
  //    client group so a single-client page never fetches/shows other clients'
  //    agents.
  useEffect(() => {
    if (!showGroupFilter) return
    let cancelled = false
    const run = async () => {
      try {
        const { start_date, end_date } = presetToDateRange(datePreset)
        const params = new URLSearchParams()
        if (start_date) params.set("start_date", start_date)
        if (end_date) params.set("end_date", end_date)
        const q = params.toString()
        const res = await apiRequest(`/api/hotprospector/members/dashboard${q ? `?${q}` : ""}`)
        if (!res.ok) {
          if (!cancelled) setMembers([])
          return
        }
        const data = await res.json()
        if (cancelled) return
        setMembers(
          (data.data || []).map((m) => {
            const db = m.dashboard || {}
            return {
              id: m.memberId,
              name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email || "—",
              email: m.email || "—",
              phone: m.mobile || m.direct_number || m.inbound_phone || "—",
              status: m.member_status || "Active",
              outbound: Number(db.outboundCall) || 0,
              inbound: Number(db.inboundCall) || 0,
              answered: Number(db.answered_calls) || 0,
              answer_rate: db.answer_rate || "—",
              convos: Number(db.convos) || 0,
              appts: Number(db.Appts) || 0,
              talk_min: Number(db.talkMin) || 0,
            }
          }),
        )
      } catch {
        if (!cancelled) setMembers([])
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [datePreset, showGroupFilter])

  // Persist the user-configured "recent calls" count across sessions, and
  // keep the (freely-editable) input text in sync with the committed value.
  useEffect(() => {
    setCallsLimitInput(String(recentCallsLimit))
    try {
      localStorage.setItem(STORAGE_KEYS.SALES_HUB_CALLS_LIMIT, String(recentCallsLimit))
    } catch {
      // localStorage unavailable (e.g. private mode) — setting just won't persist.
    }
  }, [recentCallsLimit])

  // ── Fetch calls (Calls tab): pull enough leads' call logs, flatten, sort by
  //    recency, and keep only the user-configured number of most recent calls.
  useEffect(() => {
    if (activeTab !== "calls") return
    let cancelled = false
    const run = async () => {
      setCallsLoading(true)
      try {
        const { start_date, end_date } = presetToDateRange(datePreset)
        const qs = new URLSearchParams({
          skip: "0",
          limit: String(
            Math.min(MAX_LEADS_TO_FETCH, Math.max(recentCallsLimit * CALLS_FETCH_MULTIPLIER, MIN_CALLS_TO_FETCH)),
          ),
        })
        if (selectedLocationId) qs.set("location_id", selectedLocationId)
        if (start_date) qs.set("start_date", start_date)
        if (end_date) qs.set("end_date", end_date)
        const res = await apiRequest(`/api/hotprospector/call-center?${qs.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        const sorted = flattenCalls(data.data).sort(
          (a, b) => new Date(b.call_time || 0) - new Date(a.call_time || 0),
        )
        setCalls(sorted.slice(0, recentCallsLimit))
      } catch (err) {
        if (cancelled) return
        console.error("Error loading recent calls:", err)
        setCalls([])
      } finally {
        if (!cancelled) setCallsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, datePreset, selectedLocationId, recentCallsLimit])

  // Apply the Calls-tab filter dropdown (direction / duration) client-side.
  const filteredCalls = useMemo(() => {
    const hasMin = callDurationMinMinutes !== "" || callDurationMinSeconds !== ""
    const hasMax = callDurationMaxMinutes !== "" || callDurationMaxSeconds !== ""
    const minSecs = hasMin ? (Number(callDurationMinMinutes) || 0) * 60 + (Number(callDurationMinSeconds) || 0) : null
    const maxSecs = hasMax ? (Number(callDurationMaxMinutes) || 0) * 60 + (Number(callDurationMaxSeconds) || 0) : null
    return calls.filter((c) => {
      if (callDirection !== "all" && c.direction !== callDirection) return false
      const secs = c.duration || 0
      if (minSecs !== null && secs < minSecs) return false
      if (maxSecs !== null && secs > maxSecs) return false
      return true
    })
  }, [calls, callDirection, callDurationMinMinutes, callDurationMinSeconds, callDurationMaxMinutes, callDurationMaxSeconds])

  const mapLead = (lead) => {
    const fullName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
    const logs = lead.call_logs || []
    // Only dates a HP lead carries are its call times; expose first/last (windowed).
    const isos = logs.map((l) => l.call_time_iso).filter(Boolean).sort()
    // Coerce to a real number — the API can send call_logs_count as a string,
    // which would make the table's comparator sort it lexicographically.
    const callsCount = Number(lead.call_logs_count ?? logs.length) || 0
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
      call_logs_count: callsCount,
      // "calls" is the sort key for the Call Logs column; the cell itself
      // renders from call_logs/call_logs_count above.
      calls: callsCount,
      status: "Active",
    }
  }

  // Names the current scope for the Leads tab's "showing this client only" chip.
  const selectedClientLabel = useMemo(() => {
    if (selectedClientGroup === "all") return "All Clients"
    return (clientGroups || []).find((g) => g.id === selectedClientGroup)?.name || "All Clients"
  }, [selectedClientGroup, clientGroups])

  // ── Drill from an Overview client row into the Leads tab ──
  const handleDrillIn = (group) => {
    if (!group?.id) return
    setSelectedClientGroup(group.id)
    setActiveTab("leads")
  }

  // ── Column-visibility dropdown wiring (operates on the active tab's columns) ──
  const sectionTabs = useMemo(
    () => SECTION_TABS.filter((t) => showGroupFilter || !t.hubOnly),
    [showGroupFilter],
  )

  const activeColumns = TAB_COLUMNS[activeTab]
  const activeVis = colVis[activeTab]

  // ── Saved column views ─────────────────────────────────────────────────
  // Scoped per tab, like Marketing: each of the four tables has its own column
  // set, so its own views. The key is shared between the Sales Hub and
  // /clients/[id], which draw the same tables.
  const applyColumnView = useCallback((s) => {
    if (!Array.isArray(s.visibleColumns)) return
    const on = new Set(s.visibleColumns)
    setColVis((prev) => ({
      ...prev,
      [activeTab]: Object.fromEntries(
        TAB_COLUMNS[activeTab].map((c, i) => [c.id, i === 0 || on.has(c.id)]),
      ),
    }))
  }, [activeTab])

  const pageViews = usePageViews(`cc_${activeTab}`, { onApply: applyColumnView })

  // Everything on these tables comes from Hot Prospector except the leading
  // identity column and the locally derived status, which carry no badge.
  const columnCatalogue = useMemo(
    () => activeColumns.map((c) => ({
      id: c.id,
      label: c.label,
      source: c.icons === HP ? "hotprospector" : undefined,
    })),
    [activeColumns],
  )

  const columnSources = useMemo(
    () => (columnCatalogue.some((c) => c.source === "hotprospector")
      ? [{ id: "all", label: "All" }, { id: "hotprospector", label: "HP" }]
      : [{ id: "all", label: "All" }]),
    [columnCatalogue],
  )

  const visibleColumnIds = activeColumns.filter((c) => activeVis[c.id]).map((c) => c.id)

  const setVisibleColumnIds = (ids) => {
    const on = new Set(ids)
    setColVis((prev) => ({
      ...prev,
      [activeTab]: Object.fromEntries(
        activeColumns.map((c, i) => [c.id, i === 0 || on.has(c.id)]),
      ),
    }))
  }

  // "Default" restores this tab's baseline: every column on.
  const defaultColumnIds = activeColumns.map((c) => c.id)

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
    // Width comes from the container now. This used to be sized off the
    // viewport minus the rail (100dvw-130px), which is the sort of measurement
    // that goes wrong the moment anything else changes width — and did, inside
    // the Sales Hub's own scroll region.
    <div className="min-w-0">
      <div className="flex flex-col gap-6">
        {/* Stat cards (windowed). The Sales Hub draws its own six-tile KPI grid
            from the same figures and turns these off; /clients/[id] has no call
            KPIs of its own on this tab, so they stay its default. */}
        {showStatCards && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Leads Called" value={totals.leads} desc="Leads contacted in the period" Icon={Users} />
            <StatCard label="Total Calls" value={totals.calls} desc="In the selected period" Icon={Phone} />
            <StatCard label="Inbound" value={totals.inbound} desc="Inbound calls" Icon={PhoneIncoming} />
            <StatCard label="Outbound" value={totals.outbound} desc="Outbound calls" Icon={PhoneOutgoing} />
          </div>
        )}

        {/* Section tabs, and the controls that act on whichever table is under
            them. The design puts view switches above the content they filter
            and the window filter up in the header — see the shell. */}
        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <PageTabs
              label="Sales Hub section"
              panelId={TABLE_PANEL_ID}
              tabs={sectionTabs}
              value={activeTab}
              onChange={setActiveTab}
            />

            <div className="flex items-center gap-2.5 md:ml-auto">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-[13px] size-[15px] -translate-y-1/2 text-pd-faint"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search…"
                  aria-label="Search the table"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-[38px] w-full rounded-[10px] border-pd-border bg-pd-surface pl-9 text-[13px] text-pd-body placeholder:text-pd-faint md:w-[220px]"
                />
              </div>
              <ColumnsMenu
                columns={columnCatalogue}
                visibleColumns={visibleColumnIds}
                onChange={setVisibleColumnIds}
                defaultColumns={defaultColumnIds}
                views={pageViews}
                sources={columnSources}
              />
              {activeTab === "leads" && (
                <LeadsFilterDropdown
                  open={leadsFilterOpen}
                  setOpen={setLeadsFilterOpen}
                  hideNoDialerActivity={hideNoDialerActivity}
                  setHideNoDialerActivity={setHideNoDialerActivity}
                />
              )}
              {activeTab === "calls" && (
                <CallsFilterDropdown
                  open={callsFilterOpen}
                  setOpen={setCallsFilterOpen}
                  recentLimitInput={callsLimitInput}
                  onRecentLimitChange={setCallsLimitInput}
                  onRecentLimitCommit={commitCallsLimit}
                  minLimit={MIN_CALLS_LIMIT}
                  maxLimit={MAX_CALLS_LIMIT}
                  direction={callDirection}
                  setDirection={setCallDirection}
                  durationMinMinutes={callDurationMinMinutes}
                  setDurationMinMinutes={setCallDurationMinMinutes}
                  durationMinSeconds={callDurationMinSeconds}
                  setDurationMinSeconds={setCallDurationMinSeconds}
                  durationMaxMinutes={callDurationMaxMinutes}
                  setDurationMaxMinutes={setCallDurationMaxMinutes}
                  durationMaxSeconds={callDurationMaxSeconds}
                  setDurationMaxSeconds={setCallDurationMaxSeconds}
                  onClear={clearCallFilters}
                />
              )}
            </div>
          </div>

          {/* One panel, whichever section is selected. Radix's Tabs mounted all
              four and hid three; each of these carries its own fetch, so the
              hidden ones were work nobody asked for. */}
          <PageTabPanel id={TABLE_PANEL_ID} label="Sales Hub table" className="mt-4">
            {activeTab === "overview" && showGroupFilter && (
              // One row per client, windowed KPIs — click to drill into Leads.
              <StyledTable
                columns={OVERVIEW_COLUMNS}
                data={filteredOverview}
                columnVisibility={colVis.overview}
                searchQuery={searchQuery}
                isLoading={groupsLoading}
                onRowClick={handleDrillIn}
              />
            )}

            {activeTab === "leads" && (
              <>
                {selectedClientGroup !== "all" && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex items-center gap-2 rounded-md bg-pd-primary-tint px-2.5 py-1 text-[11.5px] font-semibold text-pd-primary">
                      Client: {selectedClientLabel}
                      <button
                        type="button"
                        onClick={() => setSelectedClientGroup("all")}
                        className="cursor-pointer hover:text-pd-ink"
                        aria-label="Show all clients"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                    <span className="text-[11.5px] text-pd-faint">Showing this client only</span>
                  </div>
                )}

                {leadsBackgroundLoading && (
                  <div className="mb-3 flex items-center gap-2 text-[11.5px] text-pd-faint">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>
                      Loaded {leads.length} of {leadsTotal} leads — loading the rest in the
                      background…
                    </span>
                  </div>
                )}

                <StyledTable
                  columns={LEAD_COLUMNS}
                  data={leads}
                  columnVisibility={colVis.leads}
                  searchQuery={searchQuery}
                  isLoading={leadsLoading}
                />
              </>
            )}

            {activeTab === "members" && showGroupFilter && (
              // Account-wide HotProspector team.
              <StyledTable
                columns={MEMBER_COLUMNS}
                data={members}
                columnVisibility={colVis.members}
                searchQuery={searchQuery}
                isLoading={false}
              />
            )}

            {activeTab === "calls" && (
              // Most recent calls across leads; the count is user-configurable.
              <StyledTable
                columns={CALL_COLUMNS}
                data={filteredCalls}
                columnVisibility={colVis.calls}
                searchQuery={searchQuery}
                isLoading={callsLoading}
              />
            )}
          </PageTabPanel>
        </div>
      </div>
    </div>
  )
}
