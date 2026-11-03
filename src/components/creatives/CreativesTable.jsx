"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Badge, Button, DataTable, ProgressBar } from "@/components/ds"
import { currencySymbol } from "@/lib/chat-viz"
import { floorProgress, formatCpl, scoreTone } from "@/lib/creative-verdict"
import { AccountDotStrip } from "./AccountDotStrip"
import { VerdictBadge } from "./VerdictBadge"

const num = (v) => (Number.isFinite(Number(v)) && v != null ? Number(v) : null)
const pct = (v) => (num(v) == null ? "—" : `${(Number(v) * 100).toFixed(1).replace(/\.0$/, "")}%`)
const money = (v, cur) => `${currencySymbol(cur)}${Math.round(num(v) ?? 0).toLocaleString("en-US")}`
const fmtDate = (iso) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null
}

const SCORE_LABEL = { pass: "Pass", fail: "Fail", scoring: "Scoring", removed: "Removed in Meta" }
const BAR_TONE = { success: "success", danger: "danger", warning: "warning", muted: "primary" }

function childBadge(ad) {
  if (ad.post_state === "failed") return { label: "Failed", tone: "danger" }
  if (ad.post_state === "removed" || ad.score?.state === "removed") return { label: "Removed in Meta", tone: "muted" }
  if (ad.post_state === "pending" || ad.post_state === "uploading") return { label: "Posting", tone: "neutral" }
  const state = ad.score?.state
  return { label: SCORE_LABEL[state] ?? "Scoring", tone: scoreTone(state ?? "scoring") }
}

// Which row action a child offers (null hides the cell in the mobile card list).
function childAction(ad) {
  if (ad.post_state === "failed") return "retry"
  if (ad.score?.state === "fail" && ad.post_state !== "removed") return "pause"
  return null
}

const rowCurrency = (r) => r.currency ?? r.__test?.summary?.currency

function Progress({ value, label, tone }) {
  return (
    <div className="flex min-w-32 flex-col gap-1">
      <ProgressBar value={value} tone={tone} label="Progress to verdict" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

/** Rows: one parent per test, children from `test.ads` flagged `__child`. */
function toRows(tests) {
  return tests.map((t) => ({
    ...t,
    __rowId: t.id,
    __children: (t.ads ?? []).map((ad) => ({ ...ad, __child: true, __test: t, __rowId: `${t.id}:${ad.id}` })),
  }))
}

/** The columns a viewer can switch on and off; Creative stays on. */
export const CREATIVE_COLUMNS = [
  { id: "creative", label: "Creative" },
  { id: "accounts", label: "Accounts" },
  { id: "spend", label: "Spend" },
  { id: "leads", label: "Leads" },
  { id: "cpl", label: "CPL vs target" },
  { id: "ctr", label: "CTR" },
  { id: "hook", label: "Hook rate" },
  { id: "progress", label: "Progress to verdict" },
  { id: "verdict", label: "Verdict" },
]

export function CreativesTable({ tests = [], loading = false, visibleColumns, onOpen, onAccountAction }) {
  const rows = React.useMemo(() => toRows(tests), [tests])

  const columns = React.useMemo(
    () => [
      {
        id: "creative",
        accessorFn: (r) => r.name ?? r.account_name ?? r.ad_account_id,
        header: "Creative",
        meta: { label: "Creative", minWidth: 280 },
        cell: ({ row }) => {
          const r = row.original
          if (r.__child) {
            return (
              <div className="min-w-0">
                <div className="truncate font-medium">{r.account_name ?? r.ad_account_id}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.ad_account_id} · adset “{r.adset_name}”
                </div>
              </div>
            )
          }
          const date = fmtDate(r.created_at)
          return (
            <div className="flex min-w-0 items-center gap-2">
              {row.getCanExpand() ? (
                <button
                  type="button"
                  aria-label={`${row.getIsExpanded() ? "Collapse" : "Expand"} ${r.name}`}
                  aria-expanded={row.getIsExpanded()}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-row-hover"
                  onClick={(e) => {
                    e.stopPropagation()
                    row.toggleExpanded()
                  }}
                >
                  <ChevronRight className={`size-4 transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`} />
                </button>
              ) : (
                <span className="size-6 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[r.code, date && `posted ${date}`, r.origin ?? r.created_via].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: "accounts",
        accessorFn: (r) => (r.__child ? childBadge(r).label : r.status),
        header: "Accounts",
        meta: { label: "Accounts" },
        cell: ({ row }) => {
          const r = row.original
          if (!r.__child) return <AccountDotStrip ads={r.ads ?? []} status={r.status} />
          const b = childBadge(r)
          return (
            <Badge tone={b.tone} size="sm">
              {b.label}
            </Badge>
          )
        },
      },
      {
        id: "spend",
        accessorFn: (r) => (r.__child ? (r.score?.spend ?? 0) : (r.summary?.spend ?? 0)),
        header: "Spend",
        meta: { label: "Spend" },
        cell: ({ row }) => {
          const r = row.original
          const cur = r.__child ? rowCurrency(r) : r.summary?.currency
          return <span className="tabular-nums">{money(r.__child ? r.score?.spend : r.summary?.spend, cur)}</span>
        },
      },
      {
        id: "leads",
        accessorFn: (r) => (r.__child ? (r.score?.leads ?? 0) : (r.summary?.leads ?? 0)),
        header: "Leads",
        meta: { label: "Leads" },
        cell: ({ row }) => {
          const r = row.original
          return <span className="tabular-nums">{num(r.__child ? r.score?.leads : r.summary?.leads) ?? 0}</span>
        },
      },
      {
        id: "cpl",
        accessorFn: (r) => (r.__child ? (r.score?.cpl ?? "none") : (r.summary?.cpl ?? "none")),
        header: "CPL vs target",
        meta: { label: "CPL" },
        cell: ({ row }) => {
          const r = row.original
          const cur = r.__child ? rowCurrency(r) : r.summary?.currency
          const score = r.__child ? r.score : r.summary
          const target = num((r.__child ? r.__test : r).targets?.metrics?.cpl?.value)
          return (
            <span className="tabular-nums">
              {formatCpl(score, cur)}
              {!r.__child && target != null && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ≤ {currencySymbol(cur)}
                  {target}
                </span>
              )}
            </span>
          )
        },
      },
      {
        id: "ctr",
        accessorFn: (r) => (r.__child ? (r.score?.ctr ?? "none") : (r.summary?.ctr ?? "none")),
        header: "CTR",
        meta: { label: "CTR" },
        cell: ({ row }) => {
          const r = row.original
          return <span className="tabular-nums">{pct(r.__child ? r.score?.ctr : r.summary?.ctr)}</span>
        },
      },
      {
        id: "hook",
        accessorFn: (r) => (r.__child ? (r.score?.hook_rate ?? "none") : (r.summary?.hook_rate ?? "none")),
        header: "Hook",
        meta: { label: "Hook rate" },
        cell: ({ row }) => {
          const r = row.original
          const isImage = !r.__child && r.creative?.format === "image"
          return <span className="tabular-nums">{isImage ? "—" : pct(r.__child ? r.score?.hook_rate : r.summary?.hook_rate)}</span>
        },
      },
      {
        id: "progress",
        accessorFn: (r) => (r.__child ? (r.score?.state ?? "scoring") : r.status),
        header: "Progress to verdict",
        meta: { label: "Progress" },
        cell: ({ row }) => {
          const r = row.original
          if (r.__child) {
            const fp = floorProgress(r.score, r.__test.targets, rowCurrency(r))
            return <Progress value={fp.pct * 100} label={fp.label} tone={BAR_TONE[scoreTone(r.score?.state)]} />
          }
          const ads = (r.ads ?? []).filter((a) => a.post_state !== "removed")
          const done = ads.filter((a) => a.score?.state === "pass" || a.score?.state === "fail").length
          const total = ads.length
          const cur = r.summary?.currency
          if (r.status === "winner" || r.status === "loser" || r.status === "inconclusive") {
            return <Progress value={100} label="done" tone={r.status === "winner" ? "success" : r.status === "loser" ? "danger" : undefined} />
          }
          if (!total || done === 0) {
            const best = ads.reduce((m, a) => Math.max(m, floorProgress(a.score, r.targets, a.currency ?? cur).pct), 0)
            return <Progress value={best * 100} label={best > 0 ? `${done}/${total} scored` : "not started"} />
          }
          return <Progress value={(done / total) * 100} label={`${done}/${total} scored`} />
        },
      },
      {
        id: "verdict",
        accessorFn: (r) => (r.__child ? childAction(r) : r.status),
        header: "Verdict",
        meta: { label: "Verdict" },
        cell: ({ row }) => {
          const r = row.original
          if (!r.__child) return <VerdictBadge status={r.status} />
          if (r.post_state === "failed") {
            return (
              <Button
                variant="ghost"
                size="sm"
                title={r.post_error}
                onClick={(e) => {
                  e.stopPropagation()
                  onAccountAction?.(r.__test, stripChild(r), "retry")
                }}
              >
                Retry
              </Button>
            )
          }
          if (r.score?.state === "fail" && r.post_state !== "removed") {
            return (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onAccountAction?.(r.__test, stripChild(r), "pause")
                }}
              >
                Pause here
              </Button>
            )
          }
          return null
        },
      },
    ],
    [onAccountAction]
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      {...(visibleColumns
        ? {
            state: {
              columnVisibility: Object.fromEntries(
                CREATIVE_COLUMNS.map((c) => [c.id, c.id === "creative" || visibleColumns.includes(c.id)])
              ),
            },
          }
        : {})}
      getSubRows={(r) => r.__children}
      getRowId={(r) => r.__rowId}
      onRowClick={(r) => {
        if (!r.__child) onOpen?.(r.id)
      }}
      paginate={false}
    />
  )
}

// Hand callers the original ad object, not the render wrapper.
function stripChild({ __child, __test, __rowId, ...ad }) {
  return ad
}
