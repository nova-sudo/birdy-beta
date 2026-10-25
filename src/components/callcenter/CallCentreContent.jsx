"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  ChevronDownIcon,
  LayoutGridIcon,
  PhoneIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Label,
  MetricGroup,
  Notice,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedTabs,
  Skeleton,
  Sparkline,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ds"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { usePageViews } from "@/lib/usePageViews"
import { apiRequest } from "@/lib/api"
import { STORAGE_KEYS } from "@/lib/constants"
import { presetToDateRange } from "@/lib/date-utils"
import { windowCallSeries, windowCallTotals } from "@/lib/saleshub-totals"
import { scopeHasCallCentre, groupsWithoutCallCentre } from "@/lib/call-centre-availability"
import { toTableColumns } from "@/lib/contact-columns"
import { CallCentreUnavailable } from "@/components/callcenter/CallCentreUnavailable"
import { CallLogsDialog, RecordingLinks } from "@/components/callcenter/CallLogsDialog"
import { MemberAnalyzeDialog } from "@/components/callcenter/MemberAnalyzeDialog"
import { CallAnalysisButton } from "@/components/callcenter/CallAnalysisSheet"
import { DirectionBadge } from "@/components/callcenter/CallCentreParts"
import { formatDuration } from "@/components/callcenter/analysis"
import { hpIcon as HP } from "@/lib/icons"
import {
  CALLS_FETCH_MULTIPLIER,
  MIN_CALLS_TO_FETCH,
  MAX_LEADS_TO_FETCH,
  MIN_CALLS_LIMIT,
  MAX_CALLS_LIMIT,
  DEFAULT_CALLS_LIMIT,
} from "@/constants"

// Every table pages client-side at this size. The Leads table can hold
// thousands of rows in memory; only one page of them is ever rendered.
const PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [25, 50]

const NONE = <span className="text-sm text-muted-foreground">—</span>

// ── Column definitions per tab ───────────────────────────────────────────────
// Under the client's name: how much of its pool the window's calls reached.
// Both halves of that ratio already have a column, but the ratio is the fact
// a reader actually wants, and it does not earn a column of its own.
const REACH_SUB = (row) =>
  row.total_leads > 0
    ? `${row.leads.toLocaleString()} of ${row.total_leads.toLocaleString()} called · ${Math.round(row.reach_rate * 100)}% reach`
    : null

const TREND_CELL = (_v, row) => <Sparkline values={row.trend} label={`${row.name} calls`} />

const OVERVIEW_COLUMNS = [
  { id: "name", label: "Client", sortable: true, sub: REACH_SUB },
  // Not sortable: an array has no order, and the figures it summarises are
  // sortable in the columns beside it.
  { id: "trend", label: "Trend", sortable: false, icons: HP, cell: TREND_CELL },
  { id: "total_leads", label: "Total Leads", sortable: true, icons: HP },
  { id: "leads", label: "Leads Called", sortable: true, icons: HP },
  { id: "total_calls", label: "Total Calls", sortable: true, icons: HP },
  { id: "inbound", label: "Inbound", sortable: true, icons: HP },
  { id: "outbound", label: "Outbound", sortable: true, icons: HP },
  { id: "transfers", label: "Transfers", sortable: true, icons: HP },
  { id: "talk_time", label: "Talk Time (min)", sortable: true, icons: HP },
]

const STATUS_CELL = (_v, row) => (
  <Badge tone={row.status === "Inactive" ? "danger" : "success"}>{row.status || "Active"}</Badge>
)

const CALLS_CELL = (_v, row) =>
  row.call_logs_count > 0 ? <CallLogsDialog lead={row} /> : <span className="text-sm text-muted-foreground">No calls</span>

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

const MEMBER_AI_CELL = (_v, row) => <MemberAnalyzeDialog member={row} />

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
  { id: "ai", label: "AI Analysis", cell: MEMBER_AI_CELL },
]

const DIRECTION_CELL = (_v, row) => <DirectionBadge direction={row.direction} />
const DURATION_CELL = (v) => <span className="num">{formatDuration(v)}</span>
const CALL_TIME_CELL = (v) => (v ? new Date(v).toLocaleString() : "—")
const RECORDING_CELL = (_v, row) => (row.recording_url ? <RecordingLinks url={row.recording_url} /> : NONE)
const ANALYZE_CELL = (_v, row) => <CallAnalysisButton row={row} />

const CALL_COLUMNS = [
  { id: "caller_name", label: "Lead", sortable: true, icons: HP },
  { id: "client", label: "Client", sortable: true, icons: HP },
  { id: "direction", label: "Direction", sortable: true, icons: HP, cell: DIRECTION_CELL },
  { id: "duration", label: "Duration", sortable: true, icons: HP, cell: DURATION_CELL },
  { id: "from_number", label: "From", sortable: true, icons: HP },
  { id: "to_number", label: "To", sortable: true, icons: HP },
  { id: "call_time", label: "Call Time", sortable: true, icons: HP, cell: CALL_TIME_CELL },
  { id: "recording", label: "Recording", icons: HP, cell: RECORDING_CELL },
  { id: "analyze", label: "AI", icons: HP, cell: ANALYZE_CELL },
]

const TAB_COLUMNS = { overview: OVERVIEW_COLUMNS, leads: LEAD_COLUMNS, members: MEMBER_COLUMNS, calls: CALL_COLUMNS }

// Table column defs are built once per tab, not per render: DataTable re-runs
// when `columns` changes identity.
const toColumns = (cols) => toTableColumns(cols.map((c) => ({ ...c, header: c.label })))
const TABLE_COLUMNS = Object.fromEntries(Object.entries(TAB_COLUMNS).map(([tab, cols]) => [tab, toColumns(cols)]))

// The section tabs. Overview and Members are hub-only: Overview lists one row
// per client, and Members is account-wide team data with no per-client filter
// upstream — neither means anything once the view is already scoped to a
// single client.
const SECTION_TABS = [
  { key: "overview", label: "Overview", icon: LayoutGridIcon, hubOnly: true },
  { key: "leads", label: "Leads", icon: UserIcon, hubOnly: false },
  { key: "members", label: "Members", icon: UsersIcon, hubOnly: true },
  { key: "calls", label: "Calls", icon: PhoneIcon, hubOnly: false },
]

const allVisible = (cols) => Object.fromEntries(cols.map((c) => [c.id, true]))

const clampCallsLimit = (n) => Math.min(MAX_CALLS_LIMIT, Math.max(MIN_CALLS_LIMIT, Number(n) || DEFAULT_CALLS_LIMIT))

// ── Toolbar filters ──────────────────────────────────────────────────────────
function FilterButton({ count, children, width = "w-80" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm">
          <SlidersHorizontalIcon />
          Filters
          {count > 0 && (
            <Badge tone="primary" className="num px-1.5">
              {count}
            </Badge>
          )}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${width} flex flex-col gap-4`}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

const DIRECTION_ITEMS = [
  { value: "all", label: "All" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
]

// ── Calls tab filters: recent-calls count, direction, duration range ──
function CallsFilter({
  recentLimitInput,
  onRecentLimitChange,
  onRecentLimitCommit,
  minLimit,
  maxLimit,
  direction,
  setDirection,
  minMinutes,
  setMinMinutes,
  minSeconds,
  setMinSeconds,
  maxMinutes,
  setMaxMinutes,
  maxSeconds,
  setMaxSeconds,
  onClear,
}) {
  const activeCount = [
    direction !== "all",
    minMinutes !== "" || minSeconds !== "",
    maxMinutes !== "" || maxSeconds !== "",
  ].filter(Boolean).length

  const part = (label, placeholder, value, set, max) => (
    <Input
      type="number"
      min={0}
      max={max}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => set(e.target.value)}
      className="h-control-sm w-14 px-2"
    />
  )

  return (
    <FilterButton count={activeCount}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recent-calls-limit">Show last</Label>
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
              if (e.key === "Enter") e.currentTarget.blur()
            }}
            className="h-control-sm w-20"
          />
          <span className="text-sm text-muted-foreground">calls</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Direction</span>
        <SegmentedTabs ariaLabel="Direction" size="sm" value={direction} onValueChange={setDirection} items={DIRECTION_ITEMS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Duration</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {part("Minimum minutes", "Min", minMinutes, setMinMinutes)}m
          {part("Minimum seconds", "Sec", minSeconds, setMinSeconds, 59)}s to
          {part("Maximum minutes", "Max", maxMinutes, setMaxMinutes)}m
          {part("Maximum seconds", "Sec", maxSeconds, setMaxSeconds, 59)}s
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </FilterButton>
  )
}

// ── Leads tab filter: hide leads with no dialer activity ──
function LeadsFilter({ hideNoDialerActivity, setHideNoDialerActivity }) {
  return (
    <FilterButton count={hideNoDialerActivity ? 1 : 0} width="w-72">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="hide-no-dialer"
          checked={hideNoDialerActivity}
          onCheckedChange={(checked) => setHideNoDialerActivity(!!checked)}
          className="mt-0.5"
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="hide-no-dialer">Hide No-Dialer-Activity Leads</Label>
          <p className="text-xs text-muted-foreground">Only show leads the dialer has called in the selected period.</p>
        </div>
      </div>
    </FilterButton>
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
      // The dialing agent (log-level caller_name — distinct from the lead
      // name above); labels the per-call AI analysis.
      agent_name: log.caller_name || null,
    }))
  })

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

// The toolbar's search matches the first visible column, as it always has.
const searchRows = (rows, columns, visibility, query) => {
  if (!query) return rows
  const q = query.toLowerCase()
  const key = columns.find((c) => visibility[c.id])?.id
  if (!key) return rows
  return rows.filter((row) => row[key] != null && row[key].toString().toLowerCase().includes(q))
}

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
  // Called after a client is switched to a call centre from the "not
  // available" panel, so the page can refetch; reloads the page if omitted.
  onCallCentreChanged,
}) {
  const [activeTab, setActiveTab] = useState(showGroupFilter ? "overview" : "leads")
  const [searchQuery, setSearchQuery] = useState("")

  // Column visibility (one map per tab).
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
  // A background batch failed: the rows that did load stay, and the table says so.
  const [leadsPartial, setLeadsPartial] = useState(false)
  const [leadsError, setLeadsError] = useState(null)
  const [leadsAttempt, setLeadsAttempt] = useState(0)
  // Client filter: "all" or a client_group id. Controlled by the page on the
  // Sales Hub, internal on /clients/[id].
  const [uncontrolledClientGroup, setUncontrolledClientGroup] = useState("all")
  const selectedClientGroup = controlledClientGroup ?? uncontrolledClientGroup
  const setSelectedClientGroup = onSelectClientGroup ?? setUncontrolledClientGroup
  // Whether the client in view has a call centre at all. Every table below is
  // Hot Prospector data; for a client whose `call_log_provider` is "none" they
  // are all correctly, uninformatively empty, and "No leads found" is the
  // wrong answer to why. See lib/call-centre-availability.js.
  const callCentreAvailable = useMemo(
    () => scopeHasCallCentre(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup],
  )
  // Leads tab filter: hide leads with no dialer activity. Sent to the backend
  // as has_calls=true so it's filtered against the whole dataset, not just
  // whatever page/batch has already been fetched.
  const [hideNoDialerActivity, setHideNoDialerActivity] = useState(false)

  // Members tab (account-wide HotProspector team).
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState(null)
  const [membersAttempt, setMembersAttempt] = useState(0)

  // Calls tab (most recent calls, flattened from the leads endpoint).
  const [calls, setCalls] = useState([])
  const [callsLoading, setCallsLoading] = useState(false)
  const [callsError, setCallsError] = useState(null)
  const [callsAttempt, setCallsAttempt] = useState(0)
  const [recentCallsLimit, setRecentCallsLimit] = useState(DEFAULT_CALLS_LIMIT)
  // The stored limit is read in an effect, not during render. Until it has
  // been read, nothing is fetched or written, so the default never overwrites it.
  const [limitReady, setLimitReady] = useState(false)
  // Raw text of the limit input, kept separate from recentCallsLimit so the
  // field can be freely edited (including a transient empty string while the
  // user backspaces) without being clamped back to a value on every keystroke.
  const [callsLimitInput, setCallsLimitInput] = useState(String(DEFAULT_CALLS_LIMIT))
  const commitCallsLimit = () => setRecentCallsLimit(clampCallsLimit(callsLimitInput))
  // Calls tab filters (client-side, applied on top of the fetched batch).
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
        const totalLeads = g.hotprospector?.metrics?.total_leads ?? 0
        const leads = cs.leads_with_calls ?? 0
        return {
          id: g.id,
          name: g.name || "Unnamed Client",
          ghl_location_id: g.ghl_location_id,
          // Windowed "leads" = leads contacted in the period. HP leads have no
          // creation date, so call activity is the only windowable lead metric;
          // total_leads (full pool) is the same across presets by design.
          total_leads: totalLeads,
          leads,
          reach_rate: totalLeads > 0 ? leads / totalLeads : 0,
          // Calls per day inside the window, for the row's sparkline — the
          // same days total_calls sums, so the curve and the figure agree.
          trend: windowCallSeries(g.hotprospector?.daily_calls, datePreset),
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
      setLeadsError(null)
      setLeadsPartial(false)
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
        // Nothing has rendered yet at this point, so a failure here is an
        // error state (the outer catch below), with a retry.
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
              // allSettled: one failed request must not discard its siblings' rows.
              const results = await Promise.allSettled(chunk.map((skip) => fetchBatch(skip, LEADS_BACKGROUND_BATCH_SIZE)))
              if (cancelled) return
              const ok = results.filter((r) => r.status === "fulfilled")
              const newLeads = ok.flatMap((r) => (r.value.data || []).map(mapLead))
              setLeads((prev) => [...prev, ...newLeads])
              if (ok.length < results.length) {
                console.error("Error loading remaining call-center leads (keeping what's loaded so far)")
                setLeadsPartial(true)
                break
              }
            }
          } catch (err) {
            if (!cancelled) {
              console.error("Error loading remaining call-center leads (keeping what's loaded so far):", err)
              setLeadsPartial(true)
            }
          } finally {
            if (!cancelled) setLeadsBackgroundLoading(false)
          }
        }
      } catch (err) {
        if (cancelled) return
        console.error("Error loading call-center leads:", err)
        setLeads([])
        setLeadsError(err?.message || "The request failed")
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
  }, [activeTab, datePreset, selectedLocationId, hideNoDialerActivity, leadsAttempt])

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
      setMembersLoading(true)
      setMembersError(null)
      try {
        const { start_date, end_date } = presetToDateRange(datePreset)
        const params = new URLSearchParams()
        if (start_date) params.set("start_date", start_date)
        if (end_date) params.set("end_date", end_date)
        const q = params.toString()
        const res = await apiRequest(`/api/hotprospector/members/dashboard${q ? `?${q}` : ""}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
      } catch (err) {
        if (cancelled) return
        setMembers([])
        setMembersError(err?.message || "The request failed")
      } finally {
        if (!cancelled) setMembersLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [datePreset, showGroupFilter, membersAttempt])

  // Read the stored "recent calls" count once, after mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SALES_HUB_CALLS_LIMIT)
      if (stored) setRecentCallsLimit(clampCallsLimit(stored))
    } catch {
      // localStorage unavailable (e.g. private mode) — the default stands.
    }
    setLimitReady(true)
  }, [])

  // Persist the user-configured "recent calls" count across sessions, and
  // keep the (freely-editable) input text in sync with the committed value.
  useEffect(() => {
    setCallsLimitInput(String(recentCallsLimit))
    if (!limitReady) return
    try {
      localStorage.setItem(STORAGE_KEYS.SALES_HUB_CALLS_LIMIT, String(recentCallsLimit))
    } catch {
      // localStorage unavailable (e.g. private mode) — setting just won't persist.
    }
  }, [recentCallsLimit, limitReady])

  // ── Fetch calls (Calls tab): pull enough leads' call logs, flatten, sort by
  //    recency, and keep only the user-configured number of most recent calls.
  useEffect(() => {
    if (activeTab !== "calls" || !limitReady) return
    let cancelled = false
    const run = async () => {
      setCallsLoading(true)
      setCallsError(null)
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
        setCallsError(err?.message || "The request failed")
      } finally {
        if (!cancelled) setCallsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, datePreset, selectedLocationId, recentCallsLimit, limitReady, callsAttempt])

  // Apply the Calls-tab filters (direction / duration) client-side.
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

  // One toolbar for whichever table is showing: search, any tab-specific
  // filters, then the Columns menu.
  const toolbar = (filters) => (
    <>
      <div className="relative w-full sm:w-56">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search…"
          aria-label="Search the table"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-control-sm pl-9"
        />
      </div>
      {filters}
      <ColumnsMenu
        columns={columnCatalogue}
        visibleColumns={visibleColumnIds}
        onChange={setVisibleColumnIds}
        defaultColumns={defaultColumnIds}
        views={pageViews}
        sources={columnSources}
        buttonClassName="ml-auto"
      />
    </>
  )

  // The empty slot: a search that matches nothing is not "no data".
  const emptyFor = (empty) =>
    searchQuery ? (
      <EmptyState
        title="No results"
        description={`Nothing in the first visible column matches "${searchQuery}".`}
        action={<Button size="sm" onClick={() => setSearchQuery("")}>Clear search</Button>}
      />
    ) : (
      empty
    )

  const tableFor = (tab, rows, props) => (
    <DataTable
      columns={TABLE_COLUMNS[tab]}
      data={searchRows(rows, TAB_COLUMNS[tab], colVis[tab], searchQuery)}
      state={{ columnVisibility: colVis[tab] }}
      stickyFirstColumn
      pageSize={PAGE_SIZE}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      getRowId={(row, index) => String(row.id ?? index)}
      {...props}
      empty={emptyFor(props.empty)}
    />
  )

  const errorFor = (what, error, onRetry) => (
    <ErrorState
      title={`Couldn't load the ${what}`}
      description={`${String(error).replace(/\.+$/, "")}. The ${what} are fine — we just couldn't reach them.`}
      onRetry={onRetry}
    />
  )

  // Placed after every hook, so the branch changes what is drawn and not what
  // is called. The tables, their toolbars and their saved column views all
  // describe Hot Prospector data; none of it means anything for a client who
  // has no dialler, and the loading spinners it would still run through would
  // promise rows that are never coming.
  if (!callCentreAvailable && !groupsLoading) {
    return (
      <div className="min-w-0">
        <CallCentreUnavailable
          title="No call centre connected"
          body="Call logs, leads and agent activity all come from a dialler. This client doesn't use one, so there's nothing to list here."
          groupIds={groupsWithoutCallCentre(clientGroups, selectedClientGroup)}
          onSwitched={onCallCentreChanged}
        />
      </div>
    )
  }

  return (
    // Width comes from the container, not the viewport.
    <div className="flex min-w-0 flex-col gap-6">
      {/* Stat cards (windowed). The Sales Hub draws its own hero from the same
          figures and turns these off; /clients/[id] draws the hero too, so they
          stay off there as well. */}
      {showStatCards && (
        <MetricGroup
          title="Call centre"
          items={[
            { key: "leads", label: "Leads Called", value: groupsLoading ? <Skeleton className="h-7 w-16 rounded-sm" /> : totals.leads.toLocaleString(), caption: "Leads contacted in the period" },
            { key: "calls", label: "Total Calls", value: groupsLoading ? <Skeleton className="h-7 w-16 rounded-sm" /> : totals.calls.toLocaleString(), caption: "In the selected period" },
            { key: "inbound", label: "Inbound", value: groupsLoading ? <Skeleton className="h-7 w-16 rounded-sm" /> : totals.inbound.toLocaleString(), caption: "Inbound calls" },
            { key: "outbound", label: "Outbound", value: groupsLoading ? <Skeleton className="h-7 w-16 rounded-sm" /> : totals.outbound.toLocaleString(), caption: "Outbound calls" },
          ]}
        />
      )}

      {/* Radix mounts only the selected panel; each carries its own fetch. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList variant="underline" aria-label="Sales Hub section">
          {sectionTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              <t.icon aria-hidden="true" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {showGroupFilter && (
          <TabsContent value="overview">
            {/* One row per client, windowed KPIs — click to drill into Leads. */}
            {tableFor("overview", filteredOverview, {
              loading: groupsLoading,
              toolbar: toolbar(null),
              onRowClick: handleDrillIn,
              empty: (
                <EmptyState
                  icon={LayoutGridIcon}
                  title="No calls in this window"
                  description="Clients with at least one call in the selected period appear here."
                />
              ),
            })}
          </TabsContent>
        )}

        <TabsContent value="leads" className="flex flex-col gap-3">
          {selectedClientGroup !== "all" && (
            <div className="flex items-center gap-2">
              <Badge tone="primary" className="gap-2 py-1">
                <span>Client: {selectedClientLabel}</span>
                <button
                  type="button"
                  onClick={() => setSelectedClientGroup("all")}
                  className="cursor-pointer outline-none hover:text-foreground focus-visible:shadow-control-focus"
                  aria-label="Show all clients"
                >
                  <XIcon className="size-3.5" />
                </button>
              </Badge>
              <span className="text-xs text-muted-foreground">Showing this client only</span>
            </div>
          )}

          {leadsBackgroundLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size={14} />
              <span>
                Loaded {leads.length} of {leadsTotal} leads — loading the rest in the background…
              </span>
            </div>
          )}

          {leadsPartial && (
            <Notice tone="warning">
              Loaded {leads.length} of {leadsTotal}, some rows couldn&apos;t load
            </Notice>
          )}

          {leadsError
            ? errorFor("leads", leadsError, () => setLeadsAttempt((n) => n + 1))
            : tableFor("leads", leads, {
                loading: leadsLoading,
                toolbar: toolbar(
                  <LeadsFilter
                    hideNoDialerActivity={hideNoDialerActivity}
                    setHideNoDialerActivity={setHideNoDialerActivity}
                  />,
                ),
                empty: (
                  <EmptyState
                    icon={UserIcon}
                    title="No leads in this window"
                    description={
                      hideNoDialerActivity
                        ? "No leads were called by the dialer in this period. Turn off the filter to see the rest."
                        : "Leads from the call centre appear here."
                    }
                  />
                ),
              })}
        </TabsContent>

        {showGroupFilter && (
          <TabsContent value="members">
            {/* Account-wide HotProspector team. */}
            {membersError
              ? errorFor("members", membersError, () => setMembersAttempt((n) => n + 1))
              : tableFor("members", members, {
                  loading: membersLoading,
                  toolbar: toolbar(null),
                  empty: (
                    <EmptyState
                      icon={UsersIcon}
                      title="No team members"
                      description="Agents from your HotProspector account appear here."
                    />
                  ),
                })}
          </TabsContent>
        )}

        <TabsContent value="calls">
          {/* Most recent calls across leads; the count is user-configurable. */}
          {callsError
            ? errorFor("calls", callsError, () => setCallsAttempt((n) => n + 1))
            : tableFor("calls", filteredCalls, {
                loading: callsLoading,
                toolbar: toolbar(
                  <CallsFilter
                    recentLimitInput={callsLimitInput}
                    onRecentLimitChange={setCallsLimitInput}
                    onRecentLimitCommit={commitCallsLimit}
                    minLimit={MIN_CALLS_LIMIT}
                    maxLimit={MAX_CALLS_LIMIT}
                    direction={callDirection}
                    setDirection={setCallDirection}
                    minMinutes={callDurationMinMinutes}
                    setMinMinutes={setCallDurationMinMinutes}
                    minSeconds={callDurationMinSeconds}
                    setMinSeconds={setCallDurationMinSeconds}
                    maxMinutes={callDurationMaxMinutes}
                    setMaxMinutes={setCallDurationMaxMinutes}
                    maxSeconds={callDurationMaxSeconds}
                    setMaxSeconds={setCallDurationMaxSeconds}
                    onClear={clearCallFilters}
                  />,
                ),
                empty: (
                  <EmptyState
                    icon={PhoneIcon}
                    title="No calls to show"
                    description="Recent calls in the selected period appear here. Widen the period or the filters."
                  />
                ),
              })}
        </TabsContent>
      </Tabs>
    </div>
  )
}
