"use client"

// components/settings/AIActivity.jsx
// "Activity" card in Settings → Connect to AI: everything the owner's connected
// AI apps did, newest first. Filters refetch from the first page; a row opens
// AIActivityPanel beside the table.

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiRequest, API_BASE_URL } from "@/lib/api"
import AppLogo from "@/components/connect/AppLogo"
import AIActivityPanel, { KIND_DOT, KIND_LABEL, formatCredits, formatWhen, kindLabel } from "./AIActivityPanel"

const PERIODS = [7, 30, 90]

// Radix Select rejects "" as an item value, so "no filter" travels as ALL.
const ALL = "all"

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <Select value={value === "" ? ALL : value} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label={label} className="h-8 max-w-full text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map(([v, text]) => <SelectItem key={v} value={v}>{text}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function localDay(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function filterQuery({ app, kind, client, days }) {
  const q = new URLSearchParams()
  if (app) q.set("app", app)
  if (kind) q.set("kind", kind)
  if (client) q.set("client_group_id", client)
  q.set("from", localDay(days))
  return q
}

const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`

export default function AIActivity() {
  const [filters, setFilters] = useState({ app: "", kind: "", client: "", days: 7 })
  const [apps, setApps] = useState([])
  const [clientOptions, setClientOptions] = useState({}) // id -> name, kept as filters narrow the list
  const [items, setItems] = useState(null)
  const [totals, setTotals] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [openId, setOpenId] = useState(null)
  const seq = useRef(0)

  const rememberClients = (list) =>
    setClientOptions((prev) => {
      const next = { ...prev }
      for (const it of list) for (const c of it.clients || []) if (c.id && c.name) next[c.id] = c.name
      return next
    })

  useEffect(() => {
    let live = true
    apiRequest("/api/mcp/activity/apps")
      .then((r) => (r.ok ? r.json() : []))
      .then((a) => { if (live && Array.isArray(a)) setApps(a) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    const mine = ++seq.current
    setItems(null)
    setLoadError(false)
    setCursor(null)
    ;(async () => {
      try {
        const res = await apiRequest(`/api/mcp/activity?${filterQuery(filters)}`)
        if (!res.ok) throw new Error("load failed")
        const data = await res.json()
        if (mine !== seq.current) return
        setItems(data.items || [])
        setTotals(data.totals || null)
        setCursor(data.next_cursor || null)
        rememberClients(data.items || [])
      } catch {
        if (mine === seq.current) { setLoadError(true); setItems([]) }
      }
    })()
  }, [filters])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    const mine = seq.current
    setLoadingMore(true)
    try {
      const q = filterQuery(filters)
      q.set("cursor", cursor)
      const res = await apiRequest(`/api/mcp/activity?${q}`)
      if (!res.ok) throw new Error("load failed")
      const data = await res.json()
      if (mine !== seq.current) return
      setItems((prev) => [...(prev || []), ...(data.items || [])])
      setCursor(data.next_cursor || null)
      rememberClients(data.items || [])
    } catch {
      setLoadError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, filters])

  const setFilter = (key) => (raw) => {
    const value = key === "days" ? Number(raw) : raw
    setOpenId(null)
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const csvHref = `${API_BASE_URL}/api/mcp/activity.csv?${filterQuery(filters)}`
  const empty = items !== null && items.length === 0 && !loadError

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-pd-display text-[15px] font-semibold text-pd-ink">Activity</h3>
            <p className="mt-1 text-[12.5px] text-pd-subtle">
              Everything your AI apps did in Birdy, newest first.
              {totals && <> {plural(totals.requests, "request")} · {formatCredits(totals.credits)} credits</>}
            </p>
          </div>
          <Button asChild variant="outline" size="md">
            <a href={csvHref} download>Export CSV</a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="App" value={filters.app} onChange={setFilter("app")} allLabel="All apps"
            options={apps.map((a) => [a.grant_id, `${a.app_name}${a.revoked ? " (disconnected)" : ""}`])} />
          <FilterSelect label="Kind" value={filters.kind} onChange={setFilter("kind")} allLabel="All kinds"
            options={Object.entries(KIND_LABEL)} />
          <FilterSelect label="Client" value={filters.client} onChange={setFilter("client")} allLabel="All clients"
            options={Object.entries(clientOptions)} />
          <FilterSelect label="Period" value={String(filters.days)} onChange={setFilter("days")}
            options={PERIODS.map((d) => [String(d), `Last ${d} days`])} />
        </div>

        {items === null ? (
          <p className="text-[13px] text-pd-subtle">Loading…</p>
        ) : empty ? (
          <p className="rounded-[12px] border border-dashed border-pd-border-strong bg-pd-table-head px-4 py-6 text-center text-[13px] text-pd-subtle">
            Nothing yet. Requests from your connected apps will show up here.
          </p>
        ) : (
          <div className={`min-w-0 overflow-hidden rounded-[12px] border border-pd-border ${openId ? "md:grid md:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-pd-table-head text-left text-pd-subtle">
                    <th className="hidden border-b border-pd-border px-2.5 py-2 font-medium md:table-cell">When</th>
                    <th className="hidden border-b border-pd-border px-1 py-2 font-medium md:table-cell"><span className="sr-only">App</span></th>
                    <th className="border-b border-pd-border px-2 py-2 font-medium md:px-2.5">What happened</th>
                    <th className="hidden border-b border-pd-border px-2.5 py-2 font-medium md:table-cell">Kind</th>
                    <th className="border-b border-pd-border px-2 py-2 text-right font-medium md:px-2.5">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      onClick={() => setOpenId(it.id)}
                      className={`cursor-pointer border-b border-pd-row-border last:border-b-0 hover:bg-pd-primary-tint/50 ${openId === it.id ? "bg-pd-primary-tint" : ""}`}
                    >
                      <td className="hidden w-px whitespace-nowrap px-2.5 py-2.5 text-pd-body md:table-cell">{formatWhen(it.created_at)}</td>
                      <td className="hidden w-px px-1 py-2.5 md:table-cell"><AppLogo name={it.app_name} /></td>
                      <td className="min-w-0 px-2 py-2.5 text-pd-ink md:px-2.5">
                        <button type="button" className="text-left focus-visible:outline-none focus-visible:underline">
                          {it.summary}
                        </button>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-pd-muted md:hidden">
                          <AppLogo name={it.app_name} />
                          <span>{formatWhen(it.created_at)}</span>·
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className={`size-2 rounded-full ${KIND_DOT[it.kind] || KIND_DOT.lookup}`} />
                            {kindLabel(it.kind, it.refusal_reason)}
                          </span>
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-2.5 py-2.5 md:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-pd-body">
                          <span aria-hidden="true" className={`size-2 rounded-full ${KIND_DOT[it.kind] || KIND_DOT.lookup}`} />
                          {kindLabel(it.kind, it.refusal_reason)}
                        </span>
                      </td>
                      <td className="w-px whitespace-nowrap px-2 py-2.5 text-right tabular-nums md:px-2.5 text-pd-body">{formatCredits(it.credits?.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {openId && <AIActivityPanel id={openId} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
          </div>
        )}

        {loadError && <p className="text-[13px] text-pd-danger">Couldn't load activity. Change a filter or refresh to try again.</p>}
        {cursor && (
          <div className="flex justify-center">
            <Button variant="outline" size="md" disabled={loadingMore} onClick={loadMore}>Load more</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
