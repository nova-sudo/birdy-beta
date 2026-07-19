"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import StyledTable from "@/components/ui/table-container"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET, STORAGE_KEYS } from "@/lib/constants"
import { presetToDateRange } from "@/lib/date-utils"
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
  X,
  History,
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
        <Button
          variant="outline"
          className="flex items-center gap-1 md:gap-2 px-2 hover:bg-purple-200 font-semibold md:px-4 bg-white h-10 text-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden lg:inline">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[11px] font-bold text-white bg-purple-700">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
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
        <Button
          variant="outline"
          className="flex items-center gap-1 md:gap-2 px-2 hover:bg-purple-200 font-semibold md:px-4 bg-white h-10 text-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden lg:inline">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[11px] font-bold text-white bg-purple-700">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
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

export default function CallCenterPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } = useClientGroups(DEFAULT_DATE_PRESET)

  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")

  // Column visibility (one map per tab) + the shared dropdown's open state.
  const [colVis, setColVis] = useState({
    overview: allVisible(OVERVIEW_COLUMNS),
    leads: allVisible(LEAD_COLUMNS),
    members: allVisible(MEMBER_COLUMNS),
    calls: allVisible(CALL_COLUMNS),
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)

  // Leads tab (fully loaded, windowed by the date preset — sorted/paginated client-side).
  const [leads, setLeads] = useState([])
  // True only until the first (small) batch has rendered — the table's own
  // skeleton reads this. Background loading of the remaining batches is
  // tracked separately so the table never re-shows a skeleton once rows exist.
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsBackgroundLoading, setLeadsBackgroundLoading] = useState(false)
  const [leadsTotal, setLeadsTotal] = useState(0)
  // Client filter (top-right picker, like the Leads hub). "all" or a client_group id.
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [gridOpen, setGridOpen] = useState(false)
  const [groupSearch, setGroupSearch] = useState("")
  const gridRef = useRef(null)
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
          total_leads: g.hotprospector?.metrics?.total_leads ?? 0,
          leads: cs.leads_with_calls ?? 0,
          total_calls: cs.total_calls ?? 0,
          inbound: cs.inbound_count ?? 0,
          outbound: cs.outbound_count ?? 0,
          transfers: cs.transfers ?? 0,
          talk_time: cs.total_talk_min ?? 0,
          original: g,
        }
      }),
    [clientGroups],
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
  //    window's end date (today when "maximum"/no end date).
  useEffect(() => {
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
  }, [datePreset])

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

  // ── Date preset change ──
  const handlePresetChange = (preset) => {
    setDatePreset(preset)
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
                <div className="absolute z-50 mt-1 right-0 w-[320px] max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg p-2">
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
                    <div className="grid gap-1 max-h-72 overflow-y-auto" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      {filteredClientGrid.map((item) => {
                        const isSel = item.id === selectedClientGroup
                        return (
                          <button
                            key={item.id}
                            onClick={() => pickClient(item.id)}
                            title={item.name}
                            className={`text-xs px-2.5 py-2 rounded-md border text-left truncate transition-colors ${
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
              <TabsTrigger value="calls">
                <History className="h-4 w-4 mr-2" />
                Calls
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

            {leadsBackgroundLoading && (
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  Loaded {leads.length} of {leadsTotal} leads — loading the rest in the background…
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

          {/* Calls — most recent calls across leads (count is user-configurable) */}
          <TabsContent value="calls" className="mt-4">
            <StyledTable
              columns={CALL_COLUMNS}
              data={filteredCalls}
              columnVisibility={colVis.calls}
              searchQuery={searchQuery}
              isLoading={callsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
