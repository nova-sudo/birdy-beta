"use client"

// Sub-accounts review table (onboarding step 18): every GHL sub-account not
// yet imported, with an editable Birdy name, a searchable Facebook ad-account
// dropdown (suggested match pre-filled server-side), an Active/Inactive
// status dropdown, and an import checkbox per row.

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { PrimaryButton, SpinnerRing, StepHeading } from "./parts"

const NO_MATCH = "No matching ad account found"

// The largest plan (Scale) supports 25 client groups — pre-selecting or
// allowing more than that would just get silently truncated later by
// check_client_limit during the actual import, so it's capped here instead.
const MAX_IMPORT_SELECTION = 25

export default function ReviewStep({ review, settled, importing, onImport }) {
  // Per-row edits, sparse — row defaults come from the server payload.
  const [rows, setRows] = useState({})
  const [fbMenuOpen, setFbMenuOpen] = useState(null)
  const [statusMenuOpen, setStatusMenuOpen] = useState(null)
  const [fbSearch, setFbSearch] = useState("")

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
    const fb = edit.fb !== undefined ? edit.fb : account.fb_match
    return {
      ...account,
      importChecked: edit.import !== undefined ? edit.import : autoCheckedIds.has(account.location_id),
      birdyName: edit.birdyName !== undefined ? edit.birdyName : account.name,
      fb,
      status: edit.status || account.status_default || "active",
    }
  })

  const patch = (id, changes) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }))

  const importCount = resolved.filter((r) => r.importChecked).length
  const atSelectionCap = importCount >= MAX_IMPORT_SELECTION
  const activeCount = resolved.filter((r) => r.status === "active").length
  const fbQuery = fbSearch.toLowerCase()
  const fbOptions = fbAccounts.filter((a) => (a.name || "").toLowerCase().includes(fbQuery))

  const closeMenus = () => {
    setFbMenuOpen(null)
    setStatusMenuOpen(null)
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
    { label: "Inactive", value: resolved.length - activeCount, color: "text-pd-faint" },
  ]

  if (review === null || !settled) {
    const prep = review?.prep
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <SpinnerRing size={22} />
        <div className="text-[13px] text-pd-faint">
          {prep?.status === "running" && prep?.total
            ? `Analysing your sub-accounts… ${prep.done} of ${prep.total} checked`
            : "Reviewing your GHL account…"}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[860px]">
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
            className="flex flex-1 items-baseline gap-2 rounded-[10px] border border-pd-border bg-pd-table-head px-[14px] py-3"
          >
            <div className={`shrink-0 font-pd-display text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="truncate text-xs text-pd-subtle">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-pd-border text-left">
        <div className="flex items-center gap-[11px] border-b border-pd-border bg-pd-table-head px-[14px] py-[10px] text-[11px] font-bold tracking-[0.03em] text-pd-faint">
          <span className="w-[19px] shrink-0" />
          <span className="flex-[1.2]">NAME IN BIRDY</span>
          <span className="hidden flex-1 sm:block">GHL SUB-ACCOUNT</span>
          <span className="flex-[1.5]">FACEBOOK AD ACCOUNT</span>
          <span className="w-[118px] shrink-0 text-right">STATUS</span>
        </div>
        <div className="pd-scrolly max-h-[360px] overflow-y-auto">
          {resolved.length === 0 && (
            <div className="px-[14px] py-8 text-center text-[12.5px] text-pd-faint">
              Every sub-account with a Birdy import is already in — nothing left to review.
            </div>
          )}
          {resolved.map((row) => (
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
                className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-xs text-white ${
                  !row.importChecked && atSelectionCap ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                style={{
                  borderColor: row.importChecked ? "#6B4EE6" : "#DFDFE8",
                  background: row.importChecked ? "#6B4EE6" : "#fff",
                }}
              >
                {row.importChecked ? "✓" : ""}
              </span>

              {/* editable birdy name */}
              <input
                value={row.birdyName}
                onChange={(e) => patch(row.location_id, { birdyName: e.target.value })}
                className="min-w-0 flex-[1.2] rounded-lg border-[1.5px] border-pd-border bg-white px-[10px] py-[7px] text-[13.5px] font-semibold text-pd-ink outline-none transition-colors hover:border-[#D8D3F5] focus:border-pd-primary"
              />

              {/* read-only ghl name */}
              <span className="hidden flex-1 truncate text-[12.5px] text-pd-faint sm:block">{row.name}</span>

              {/* facebook dropdown */}
              <div className="relative min-w-0 flex-[1.5]">
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setStatusMenuOpen(null)
                    setFbSearch("")
                    setFbMenuOpen(fbMenuOpen === row.location_id ? null : row.location_id)
                  }}
                  className="flex cursor-pointer items-center justify-between gap-[6px] rounded-lg border-[1.5px] border-pd-border bg-white px-[10px] py-[7px] text-[12.5px] transition-colors hover:border-[#D8D3F5]"
                  style={{ color: row.fb ? "#5A5A6E" : "#B4530A" }}
                >
                  <span className="truncate">{row.fb ? row.fb.name : NO_MATCH}</span>
                  <ChevronDown className="h-[11px] w-[11px] shrink-0 text-pd-faint" strokeWidth={2.4} />
                </div>
                {fbMenuOpen === row.location_id && (
                  <div className="absolute left-0 top-[38px] z-20 w-[290px] overflow-hidden rounded-[10px] border border-pd-border bg-white shadow-[0_12px_28px_-8px_rgba(20,20,40,0.18)]">
                    <div className="p-2">
                      <input
                        value={fbSearch}
                        onChange={(e) => setFbSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        placeholder="Search ad accounts…"
                        className="w-full rounded-[7px] border-[1.5px] border-pd-border px-[9px] py-[7px] text-[12.5px] text-pd-ink outline-none focus:border-pd-primary"
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
                          className="cursor-pointer border-b border-pd-row-border px-3 py-[9px] text-[12.5px] text-pd-ink last:border-b-0 hover:bg-[#F7F5FE]"
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
                  className="flex cursor-pointer items-center justify-between gap-[5px] rounded-lg border-[1.5px] px-[9px] py-[6px] text-[11px] font-bold"
                  style={
                    row.status === "active"
                      ? { color: "#25A55F", background: "#EDF8F1", borderColor: "#BFE8D2" }
                      : { color: "#9A9AAB", background: "#F1F1F5", borderColor: "#E7E7ED" }
                  }
                >
                  {row.status === "active" ? "Active" : "Inactive"}
                  <ChevronDown className="h-[10px] w-[10px] shrink-0" strokeWidth={2.6} />
                </div>
                {statusMenuOpen === row.location_id && (
                  <div className="absolute right-0 top-9 z-20 w-[118px] overflow-hidden rounded-[10px] border border-pd-border bg-white shadow-[0_12px_28px_-8px_rgba(20,20,40,0.18)]">
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        patch(row.location_id, { status: "active" })
                        closeMenus()
                      }}
                      className="cursor-pointer px-[11px] py-2 text-[11.5px] font-semibold text-pd-success hover:bg-[#F0FBF4]"
                    >
                      Active
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        patch(row.location_id, { status: "inactive" })
                        closeMenus()
                      }}
                      className="cursor-pointer border-t border-pd-row-border px-[11px] py-2 text-[11.5px] font-semibold text-pd-faint hover:bg-[#F7F7F8]"
                    >
                      Inactive
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* click-catcher for open dropdowns */}
      {(fbMenuOpen || statusMenuOpen) && (
        <div className="fixed inset-0 z-[5]" onClick={closeMenus} />
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
