// Campaign checklist for sharing one Meta ad account between client groups.
//
// value: null = every campaign, string[] = only those campaign ids.
// Campaigns already owned by another group are shown but cannot be ticked.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest } from "@/lib/api"

const STATUS_LABELS = { ACTIVE: "Active", PAUSED: "Paused", ARCHIVED: "Archived", DELETED: "Deleted" }

function statusLabel(status) {
  if (!status) return "Unknown"
  if (STATUS_LABELS[status]) return STATUS_LABELS[status]
  const s = status.replace(/_/g, " ").toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const statusVariant = (status) =>
  status === "ACTIVE" ? "success" : status === "PAUSED" ? "warning" : "secondary"

function Tick({ checked }) {
  return (
    <div
      aria-hidden="true"
      className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
        checked ? "bg-pd-primary border-pd-primary" : "border-pd-border group-hover:border-pd-border-strong"
      }`}
    >
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
  )
}

function Row({ checked, disabled, onClick, title, subtitle, badge }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
        disabled
          ? "border-pd-border bg-pd-surface opacity-60 cursor-not-allowed"
          : checked
            ? "border-pd-primary bg-pd-primary-tint cursor-pointer"
            : "border-pd-border hover:border-pd-border-strong bg-pd-surface cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-pd-display font-semibold truncate ${
                checked && !disabled ? "text-pd-primary" : disabled ? "text-pd-subtle" : "text-pd-ink"
              }`}
            >
              {title}
            </span>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-xs text-pd-subtle truncate">{subtitle}</p>}
        </div>
        <Tick checked={checked} />
      </div>
    </button>
  )
}

export function MetaCampaignPicker({
  adAccountId,
  groupId,
  value,
  onChange,
  required = false,
  shareNote = null,
}) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")

  // Only the newest request may write state (account switch, Retry, unmount).
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    const current = () => id === requestId.current
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest(`/api/facebook/adaccounts/${adAccountId}/campaigns`)
      const body = await res.json().catch(() => ({}))
      if (!current()) return
      if (!res.ok) throw new Error(body?.detail || "Could not load campaigns from Meta.")
      setCampaigns(body.campaigns || [])
    } catch (e) {
      if (current()) setError(e?.message || "Could not load campaigns from Meta.")
    } finally {
      if (current()) setLoading(false)
    }
  }, [adAccountId])

  useEffect(() => {
    setCampaigns([])
    setQuery("")
    load()
    return () => {
      requestId.current++
    }
  }, [load])

  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value])
  const liveIds = useMemo(() => new Set(campaigns.map((c) => c.id)), [campaigns])
  const removed = selected.filter((id) => !liveIds.has(id))

  const q = query.trim().toLowerCase()
  const visible = q
    ? campaigns.filter((c) => c.name?.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    : campaigns

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const isMine = (c) => !c.claimed_by || c.claimed_by.group_id === groupId

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pd-faint w-4 h-4" />
        <Input
          type="text"
          placeholder="Search campaigns by name or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-pd-danger-border bg-pd-danger-bg p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-pd-danger">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading campaigns">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start justify-between rounded-xl border-2 border-pd-border p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="ml-3 size-5 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {!required && (
            <Row
              checked={value === null}
              onClick={() => onChange(null)}
              title="All campaigns"
              subtitle="Every campaign in this ad account, including new ones"
            />
          )}
          {visible.map((c) => {
            const mine = isMine(c)
            return (
              <Row
                key={c.id}
                checked={mine && selected.includes(c.id)}
                disabled={!mine}
                onClick={() => toggle(c.id)}
                title={c.name || "Unnamed campaign"}
                subtitle={mine ? `ID: ${c.id}` : `Used by ${c.claimed_by.name}`}
                badge={<Badge variant={statusVariant(c.effective_status)}>{statusLabel(c.effective_status)}</Badge>}
              />
            )
          })}
          {removed.map((id) => (
            <Row
              key={id}
              checked
              onClick={() => toggle(id)}
              title="Removed in Meta"
              subtitle={`ID: ${id}`}
            />
          ))}
          {visible.length === 0 && removed.length === 0 && (
            <p className="py-4 text-center text-sm text-pd-subtle">
              {q ? "No campaigns match your search." : "No campaigns in this ad account."}
            </p>
          )}
        </div>
      )}

      {Array.isArray(value) && !loading && !error && (
        <p className="text-xs text-pd-subtle">
          {selected.length} of {campaigns.length} selected
        </p>
      )}
      {shareNote && <p className="text-xs text-pd-subtle">{shareNote}</p>}
    </div>
  )
}

export default MetaCampaignPicker
