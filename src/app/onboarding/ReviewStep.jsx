"use client"

// Sub-accounts review table (onboarding step 18): every GHL sub-account not
// yet imported, with an editable Birdy name, a searchable Facebook ad-account
// dropdown (suggested match pre-filled server-side), an Active/Inactive
// status dropdown, and an import checkbox per row.

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_UNKNOWN } from "@/lib/lead-sources"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CyclingCaption,
  FakeProgressBar,
  PrimaryButton,
  ProgressBar,
  SearchInput,
  StepHeading,
} from "./parts"

const NO_MATCH = "No matching ad account found"

// What the prep job is actually doing, in the order it does it: mint a
// location token, read each sub-account's recent contacts, then pair the ones
// that are live against the Meta ad accounts.
//
// They describe real work rather than filling time. Someone who reads "pairing
// them with your Meta ad accounts" and then lands on a table of pairings knows
// the wait bought something; a generic "hang tight" teaches them the screen is
// decorative. The tone here is deliberately plain — Birdy's voice is a
// separate, un-signed-off decision, and swapping this array is the whole
// change when it lands.
const PREP_MESSAGES = [
  "Reading your GoHighLevel agency…",
  "Checking which sub-accounts are still bringing in leads…",
  "Counting new leads from the last 30 days…",
  "Pairing your clients with their Meta ad accounts…",
  "Almost there — larger agencies take a little longer…",
]

// How each client collects leads. Asked here because this is the one screen that
// already lists every client — and left as "Ask later" by default on purpose: a
// guessed default silently mis-configures every client nobody looked at, and the
// consequence (a setup screen demanding a snippet for a client using Meta
// Instant Forms, or worse, silence for one that needs one) is invisible until
// somebody wonders why a client reports no leads.
const LEAD_SOURCE_TONE = { unknown: "muted", instant_form: "meta", form_to_ghl: "primary", landing_page: "primary" }
const LEAD_SOURCES = [{ ...LEAD_SOURCE_UNKNOWN, short: "Ask later" }, ...LEAD_SOURCE_OPTIONS].map((o) => ({
  ...o,
  tone: LEAD_SOURCE_TONE[o.key],
}))

const LEAD_SOURCE_STYLE = {
  muted: "border-pd-border bg-pd-divider text-pd-subtle",
  meta: "border-pd-info-bg bg-pd-info-bg text-pd-info",
  primary: "border-pd-primary-pale bg-pd-primary-tint text-pd-primary",
}

// The largest plan (Scale) supports 25 client groups — pre-selecting or
// allowing more than that would just get silently truncated later by
// check_client_limit during the actual import, so it's capped here instead.
const MAX_IMPORT_SELECTION = 25

// Module scope: one collator for every row comparison, rather than rebuilding
// it per sort. Undefined locale so it follows the reader's own alphabet.
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

export default function ReviewStep({ review, settled, importing, onImport }) {
  // Per-row edits, sparse — row defaults come from the server payload.
  const [rows, setRows] = useState({})
  const [search, setSearch] = useState("")
  const [fbMenuOpen, setFbMenuOpen] = useState(null)
  const [statusMenuOpen, setStatusMenuOpen] = useState(null)
  const [leadMenuOpen, setLeadMenuOpen] = useState(null)
  const [fbSearch, setFbSearch] = useState("")
  // Defaults to hiding them: the ticket asking for this is about noise during
  // pairing, and on a real agency two in five sub-accounts are dormant.
  const [hideInactive, setHideInactive] = useState(true)

  const unimported = useMemo(
    () => (review?.accounts || []).filter((a) => !a.already_imported),
    [review]
  )
  // The prep job decides who belongs in the list: only sub-accounts with a
  // lead in the last 90 days (unknown recency stays visible rather than
  // silently hiding someone's client).
  const accounts = useMemo(
    () => unimported.filter((a) => a.leads_recent_90 !== false),
    [unimported]
  )
  const hasRecency = unimported.some((a) => a.leads_recent_90 !== null && a.leads_recent_90 !== undefined)
  const fbAccounts = review?.fb_accounts || []

  // Only pre-check sub-accounts with a lead in the last 7 days, most-recent
  // first, capped at MAX_IMPORT_SELECTION — everything else still shows in
  // the table (untouched by this), just unchecked by default.
  const autoCheckedIds = useMemo(() => {
    const eligible = accounts
      .filter((a) => a.leads_recent_7)
      .slice()
      .sort((a, b) => new Date(b.last_lead_at || 0) - new Date(a.last_lead_at || 0))
      .slice(0, MAX_IMPORT_SELECTION)
    return new Set(eligible.map((a) => a.location_id))
  }, [accounts])

  const resolved = accounts.map((account) => {
    const edit = rows[account.location_id] || {}
    // Only a confident pairing arrives as fb_match, so this is the box's
    // value. fb_suggestion is the server's near-miss and deliberately does
    // not feed it — see the "Did you mean" affordance below.
    const fb = edit.fb !== undefined ? edit.fb : account.fb_match
    return {
      ...account,
      importChecked: edit.import !== undefined ? edit.import : autoCheckedIds.has(account.location_id),
      birdyName: edit.birdyName !== undefined ? edit.birdyName : account.name,
      fb,
      suggestion: account.fb_suggestion || null,
      // The prep job writes 0 for a sub-account it read and found nothing in,
      // and leaves the field off entirely for one it has not reached. Those
      // are different answers and the column shows them differently.
      leads30dKnown: typeof account.leads_30d === "number",
      status: edit.status || account.status_default || "active",
      leadSource: edit.leadSource || "unknown",
    }
  })

  // Ticked rows first, then everyone else, each block A–Z.
  //
  // The pre-selection is the answer to "which of your 174 sub-accounts is this
  // step actually about", and it was landing scattered through an unordered
  // list — so the one thing the user came here to check was the one thing they
  // had to hunt for. Ticked at the top makes the selection reviewable at a
  // glance, and unticking drops that row straight back into the alphabetical
  // pile below, where it can be found again by name.
  //
  // Sorted on the GHL name, not the editable Birdy one. They are the same value
  // until someone edits it, and sorting on the edited one would re-sort the
  // table on every keystroke — pulling the text field the user is typing into
  // out from under the cursor. `numeric` so "Clinic 9" precedes "Clinic 10",
  // and `base` sensitivity so case and accents don't split the alphabet.
  const ordered = resolved
    .slice()
    .sort((a, b) =>
      a.importChecked !== b.importChecked
        ? a.importChecked ? -1 : 1
        : collator.compare(a.name || "", b.name || "")
    )

  // Filtering is a view concern and deliberately nothing more. Counts, the
  // auto-check cap and what actually gets imported all read `resolved`, not
  // this — searching must never silently drop a sub-account someone already
  // ticked, which is exactly what filtering the source list would do.
  const query = search.trim().toLowerCase()
  const matchesQuery = (row) =>
    !query ||
    [row.birdyName, row.name, row.fb?.name, row.suggestion?.name].some(
      (field) => (field || "").toLowerCase().includes(query)
    )

  // Dormant sub-accounts are the noise this screen is trying to see past: an
  // agency with 177 of them is really being asked about the 109 still bringing
  // in leads. They are folded away rather than dropped — "not live right now"
  // is a judgement made from one lead date, and an agency having a quiet month
  // must still be able to find its own client. A ticked row is never folded
  // away: the count beneath the table is the promise that nothing selected can
  // vanish, and hiding one silently would break it.
  const visible = ordered.filter(
    (row) =>
      matchesQuery(row) &&
      (!hideInactive || row.status !== "inactive" || row.importChecked)
  )
  const hiddenChecked = resolved.filter(
    (row) => row.importChecked && !visible.includes(row)
  ).length
  const hiddenInactive = hideInactive
    ? ordered.filter(
        (row) => matchesQuery(row) && row.status === "inactive" && !row.importChecked
      ).length
    : 0

  const patch = (id, changes) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }))

  const importCount = resolved.filter((r) => r.importChecked).length
  const atSelectionCap = importCount >= MAX_IMPORT_SELECTION
  const activeCount = resolved.filter((r) => r.status === "active").length
  const inactiveCount = resolved.length - activeCount
  const fbQuery = fbSearch.toLowerCase()
  const fbOptions = fbAccounts.filter((a) => (a.name || "").toLowerCase().includes(fbQuery))

  const closeMenus = () => {
    setFbMenuOpen(null)
    setStatusMenuOpen(null)
    setLeadMenuOpen(null)
    setFbSearch("")
  }

  const stats = [
    { label: "Accounts found", value: unimported.length, color: "text-pd-ink" },
    {
      label: "With leads in 90 days",
      value: hasRecency ? unimported.filter((a) => a.leads_recent_90 === true).length : "—",
      color: "text-pd-ink",
    },
    { label: "Active", value: activeCount, color: "text-pd-success" },
    { label: "Inactive", value: inactiveCount, color: "text-pd-faint" },
  ]

  if (review === null || !settled) {
    const prep = review?.prep
    // The longest wait in the whole wizard: the prep job reads every
    // sub-account's recent leads and pairs it against a Meta ad account, so a
    // large agency sits here for a minute or more. Once the job reports a
    // total we have real progress to show; before that — while the job is
    // still being scheduled — a bar that visibly moves is the difference
    // between "working" and "frozen", which is what people reload out of.
    const hasRealProgress = prep?.status === "running" && prep?.total > 0
    return (
      <div className="flex w-full max-w-[460px] flex-col items-center py-14">
        {/* Saying what this is and why it takes a while. The step used to
            open on a spinner and a bar with no title at all, so the one
            genuinely slow stage in onboarding gave no account of itself — and
            a wait you cannot explain is a wait people assume has broken. */}
        <div className="mb-[10px] text-center">
          <StepHeading small>Analysing your sub-accounts</StepHeading>
        </div>
        <div className="mb-[26px] text-center text-[13.5px] leading-normal text-pd-body">
          We&apos;re going through every sub-account in your GoHighLevel agency, checking
          which ones are still bringing in leads and matching them to your Meta ad
          accounts. Agencies with a lot of clients can take a minute or two — you only
          have to do this once.
        </div>

        <div className="w-full overflow-hidden rounded-xl border border-pd-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-[11px] border-b border-pd-row-border px-[14px] py-[10px] last:border-b-0">
              <Skeleton className="h-[19px] w-[19px] rounded-full" />
              <Skeleton className="h-4 flex-[1.2]" />
              <Skeleton className="hidden h-4 flex-1 sm:block" />
              <Skeleton className="h-4 w-[76px]" />
            </div>
          ))}
        </div>
        <div className="mt-4 w-full">
          {hasRealProgress ? (
            <>
              <ProgressBar value={(prep.done / prep.total) * 100} />
              <div className="mt-[9px] text-center text-[13px] text-pd-faint">
                {prep.done} of {prep.total} sub-accounts checked
              </div>
            </>
          ) : (
            <FakeProgressBar className="w-full" expectedMs={15000} />
          )}
          <CyclingCaption className="mt-[9px]" messages={PREP_MESSAGES} />
        </div>
      </div>
    )
  }

  return (
    // Widest step in the wizard, and the only one that is a table rather than
    // a column of prose. 860px had it pairing two account names, a status and
    // a lead source inside six truncating columns; the activity count added
    // here needs room that was not there. Capped at the same 1080px as the
    // progress bar in the top bar so the two line up on a wide monitor
    // instead of the table sitting visibly narrower than the chrome above it.
    <div className="w-full max-w-[1080px]">
      <div className="mb-2 text-center">
        <StepHeading small>Here&apos;s what we found in your GHL account</StepHeading>
      </div>
      <div className="mb-5 text-center text-[13.5px] text-pd-faint">
        {hasRecency
          ? `We've pre-selected sub-accounts with a lead in the last 7 days (up to ${MAX_IMPORT_SELECTION}) and flagged any with no leads in the last 30 days as inactive. Review and adjust before we bring them in.`
          : "These are the sub-accounts you haven't imported yet. Review the names, Facebook matches and status, untick any you don't want, then bring them in."}
      </div>

      {/* stat banner */}
      <div className="mb-[18px] flex gap-3 text-left">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-1 items-baseline gap-2 rounded-xl border border-pd-border bg-pd-table-head px-[14px] py-3"
          >
            <div className={`shrink-0 font-pd-display text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="truncate text-xs text-pd-subtle">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search. The per-row Facebook dropdown has always had its own filter,
          but the table itself had none — and with 173 sub-accounts, finding the
          one you care about meant scrolling for it. Matches either side of the
          pairing, GHL name or ad-account name, because the job on this step is
          checking that the two line up. */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${resolved.length} sub-account${resolved.length === 1 ? "" : "s"} or ad accounts…`}
          />
        </div>
        {/* The escape hatch for the default above. Stated as a count rather
            than a bare label so the number it is keeping off screen is on
            screen — "Hide inactive" alone tells you a rule is in force but not
            what it costs. */}
        <button
          type="button"
          onClick={() => setHideInactive((v) => !v)}
          className="flex shrink-0 cursor-pointer items-center gap-[7px] rounded-full border-[1.5px] border-pd-border bg-white px-[11px] py-[9px] text-[12.5px] text-pd-body transition-colors hover:border-pd-primary-pale"
        >
          <span
            className={`flex h-[15px] w-[15px] items-center justify-center rounded-full border-[1.5px] text-[10px] text-white ${
              hideInactive ? "border-pd-primary bg-pd-primary" : "border-pd-border-strong bg-white"
            }`}
          >
            {hideInactive ? "✓" : ""}
          </span>
          Hide inactive
          {inactiveCount > 0 && (
            <span className="text-pd-faint">({inactiveCount})</span>
          )}
        </button>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-pd-border text-left">
        <div className="flex items-center gap-[11px] border-b border-pd-border bg-pd-table-head px-[14px] py-[10px] text-[11px] font-bold tracking-[0.03em] text-pd-faint">
          <span className="w-[19px] shrink-0" />
          <span className="flex-[1.2]">NAME IN BIRDY</span>
          <span className="hidden flex-1 sm:block">GHL SUB-ACCOUNT</span>
          <span className="w-[76px] shrink-0 text-right">NEW (30D)</span>
          <span className="flex-[1.5]">FACEBOOK AD ACCOUNT</span>
          <span className="w-[118px] shrink-0 text-right">STATUS</span>
          <span className="w-[132px] shrink-0 text-right">LEADS FROM</span>
        </div>
        <div className="pd-scrolly max-h-[360px] overflow-y-auto">
          {resolved.length === 0 && (
            <div className="px-[14px] py-8 text-center text-[12.5px] text-pd-faint">
              Every sub-account with a Birdy import is already in — nothing left to review.
            </div>
          )}
          {resolved.length > 0 && visible.length === 0 && (
            <div className="px-[14px] py-8 text-center text-[12.5px] text-pd-faint">
              No sub-account or ad account matches &ldquo;{search.trim()}&rdquo;.
            </div>
          )}
          {visible.map((row) => (
            <div
              key={row.location_id}
              className="flex items-center gap-[11px] border-b border-pd-row-border px-[14px] py-[10px] last:border-b-0"
              style={{ opacity: row.importChecked ? 1 : 0.5 }}
            >
              {/* import checkbox — unchecking is always allowed; checking a
                  new one is blocked once MAX_IMPORT_SELECTION is reached. */}
              <span
                onClick={() => {
                  if (!row.importChecked && atSelectionCap) return
                  patch(row.location_id, { import: !row.importChecked })
                }}
                className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs text-white ${
                  !row.importChecked && atSelectionCap ? "cursor-not-allowed" : "cursor-pointer"
                } ${row.importChecked ? "border-pd-primary bg-pd-primary" : "border-pd-border-strong bg-white"}`}
              >
                {row.importChecked ? "✓" : ""}
              </span>

              {/* editable birdy name */}
              <input
                value={row.birdyName}
                onChange={(e) => patch(row.location_id, { birdyName: e.target.value })}
                className="min-w-0 flex-[1.2] rounded-full border-[1.5px] border-pd-border bg-white px-[10px] py-[7px] text-[13.5px] font-semibold text-pd-ink outline-none transition-colors hover:border-pd-primary-pale focus:border-pd-primary"
              />

              {/* read-only ghl name */}
              <span className="hidden flex-1 truncate text-[12.5px] text-pd-faint sm:block">{row.name}</span>

              {/* New leads in the last 30 days. The fastest way to tell a live
                  client from a dormant one — which is the question this whole
                  screen is really asking, and the one the Active/Inactive chip
                  only answers yes/no. Dashes while the prep job has not
                  reached this row yet; never a 0 it has not earned. */}
              <span
                className={`w-[76px] shrink-0 text-right text-[12.5px] tabular-nums ${
                  row.leads30dKnown ? (row.leads_30d > 0 ? "text-pd-success" : "text-pd-faint") : "text-pd-chevron"
                }`}
                title={row.leads_30d_capped ? `More than ${row.leads_30d} new leads in the last 30 days` : undefined}
              >
                {row.leads30dKnown ? `${row.leads_30d}${row.leads_30d_capped ? "+" : ""}` : "—"}
              </span>

              {/* facebook dropdown */}
              <div className="relative min-w-0 flex-[1.5]">
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setStatusMenuOpen(null)
                    setFbSearch("")
                    setFbMenuOpen(fbMenuOpen === row.location_id ? null : row.location_id)
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-[6px] rounded-full border-[1.5px] border-pd-border bg-white px-[10px] py-[7px] text-[12.5px] transition-colors hover:border-pd-primary-pale ${
                    row.fb ? "text-pd-body" : "text-pd-amber"
                  }`}
                >
                  <span className="truncate">{row.fb ? row.fb.name : NO_MATCH}</span>
                  <ChevronDown className="h-[11px] w-[11px] shrink-0 text-pd-faint" strokeWidth={2.4} />
                </div>

                {/* A pairing the server was not confident enough to fill in.
                    It is offered here rather than pre-selected: a wrong ad
                    account in the box reads as answered, so nobody checks it,
                    and the client is imported reporting another client's
                    spend. An empty box is visibly unanswered and costs one
                    click — this is that click, without the false confidence.
                    Hidden once the row has an ad account either way. */}
                {!row.fb && row.suggestion && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      patch(row.location_id, { fb: row.suggestion })
                    }}
                    className="mt-[3px] block max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[11px] text-pd-primary underline"
                  >
                    Did you mean {row.suggestion.name}?
                  </button>
                )}
                {fbMenuOpen === row.location_id && (
                  <div className="absolute left-0 top-[38px] z-20 w-[290px] overflow-hidden rounded-xl border border-pd-border bg-white shadow-pd-popover">
                    <div className="p-2">
                      <input
                        value={fbSearch}
                        onChange={(e) => setFbSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        placeholder="Search ad accounts…"
                        className="w-full rounded-full border-[1.5px] border-pd-border px-[9px] py-[7px] text-[12.5px] text-pd-ink outline-none focus:border-pd-primary"
                      />
                    </div>
                    <div className="pd-scrolly max-h-[180px] overflow-y-auto border-t border-pd-row-border">
                      {fbOptions.length === 0 && (
                        <div className="px-3 py-[9px] text-[12.5px] text-pd-faint">No ad accounts found</div>
                      )}
                      {fbOptions.map((option) => (
                        <div
                          key={option.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            patch(row.location_id, { fb: option })
                            closeMenus()
                          }}
                          className="cursor-pointer border-b border-pd-row-border px-3 py-[9px] text-[12.5px] text-pd-ink last:border-b-0 hover:bg-pd-primary-tint"
                        >
                          {option.name}
                          <span className="ml-[6px] text-[11px] text-pd-faint">{option.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* status dropdown */}
              <div className="relative w-[118px] shrink-0">
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setFbMenuOpen(null)
                    setStatusMenuOpen(statusMenuOpen === row.location_id ? null : row.location_id)
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-[5px] rounded-full border-[1.5px] px-[9px] py-[6px] text-[11px] font-bold ${
                    row.status === "active"
                      ? "border-pd-success bg-pd-success-bg text-pd-success"
                      : "border-gray-600 bg-pd-divider text-pd-body"
                  }`}
                >
                  {row.status === "active" ? "Active" : "Inactive"}
                  <ChevronDown className="h-[10px] w-[10px] shrink-0" strokeWidth={2.6} />
                </div>
                {statusMenuOpen === row.location_id && (
                  <div className="absolute right-0 top-9 z-20 w-[118px] overflow-hidden rounded-xl border border-pd-border bg-white shadow-pd-popover">
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        patch(row.location_id, { status: "active" })
                        closeMenus()
                      }}
                      className="cursor-pointer px-[11px] py-2 text-[11.5px] font-semibold text-pd-success hover:bg-pd-success-bg"
                    >
                      Active
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        patch(row.location_id, { status: "inactive" })
                        closeMenus()
                      }}
                      className="cursor-pointer border-t border-pd-row-border px-[11px] py-2 text-[11.5px] font-semibold text-pd-faint hover:bg-pd-canvas"
                    >
                      Inactive
                    </div>
                  </div>
                )}
              </div>

              {/* lead source dropdown */}
              <div className="relative w-[132px] shrink-0">
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setFbMenuOpen(null)
                    setStatusMenuOpen(null)
                    setLeadMenuOpen(leadMenuOpen === row.location_id ? null : row.location_id)
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-[5px] rounded-full border-[1.5px] px-[9px] py-[6px] text-[11px] font-bold ${
                    LEAD_SOURCE_STYLE[
                      (LEAD_SOURCES.find((o) => o.key === row.leadSource) || LEAD_SOURCES[0]).tone
                    ]
                  }`}
                >
                  {(LEAD_SOURCES.find((o) => o.key === row.leadSource) || LEAD_SOURCES[0]).short}
                  <ChevronDown className="h-[10px] w-[10px] shrink-0" strokeWidth={2.6} />
                </div>
                {leadMenuOpen === row.location_id && (
                  <div className="absolute right-0 top-9 z-20 w-[280px] overflow-hidden rounded-xl border border-pd-border bg-white shadow-pd-popover">
                    {LEAD_SOURCES.map((option) => (
                      <div
                        key={option.key}
                        onClick={(e) => {
                          e.stopPropagation()
                          patch(row.location_id, { leadSource: option.key })
                          closeMenus()
                        }}
                        className="cursor-pointer border-b border-pd-row-border px-[11px] py-2 text-[11.5px] text-pd-ink last:border-b-0 hover:bg-pd-primary-tint"
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-0.5 text-[10.5px] text-pd-faint">{option.brief}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* click-catcher for open dropdowns */}
      {(fbMenuOpen || statusMenuOpen || leadMenuOpen) && (
        <div className="fixed inset-0 z-[5]" onClick={closeMenus} />
      )}

      {(query || hiddenInactive > 0) && visible.length > 0 && (
        <div className="mt-[14px] text-center text-[12.5px] text-pd-faint">
          {query && <>Showing {visible.length} of {resolved.length}</>}
          {/* Said out loud because the Import button counts every ticked row,
              including the ones this search is hiding — without this the count
              looks wrong. */}
          {hiddenChecked > 0 && (
            <> · {hiddenChecked} selected {hiddenChecked === 1 ? "row is" : "rows are"} hidden by this search</>
          )}
          {hiddenInactive > 0 && (
            <>
              {query ? " · " : ""}{hiddenInactive} inactive hidden ·{" "}
              <button
                type="button"
                onClick={() => setHideInactive(false)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-pd-primary underline"
              >
                show them
              </button>
            </>
          )}
        </div>
      )}

      {atSelectionCap && (
        <div className="mt-[14px] text-center text-[12.5px] text-pd-faint">
          You&apos;ve selected the maximum of {MAX_IMPORT_SELECTION} sub-accounts for this import — untick one to pick another.
        </div>
      )}

      <div className="relative z-[6] mt-[26px] text-center">
        <PrimaryButton
          disabled={importing || importCount === 0}
          onClick={() =>
            onImport(
              resolved
                .filter((r) => r.importChecked)
                .map((r) => ({
                  location_id: r.location_id,
                  name: r.birdyName.trim() || r.name,
                  meta_ad_account_id: r.fb?.id || null,
                  ad_account_currency: r.fb?.currency || null,
                  client_status: r.status === "active" ? "Active" : "Inactive",
                  lead_collection_method: r.leadSource,
                }))
            )
          }
        >
          {importing ? "Importing…" : `Import ${importCount} sub-account${importCount === 1 ? "" : "s"}`}
        </PrimaryButton>
      </div>
    </div>
  )
}
