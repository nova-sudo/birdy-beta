"use client"

// The manual editor for the Slack report: the same template the copilot
// designs, edited by hand. Sections can be added, removed, reordered (drag the
// handle, or the arrow buttons from the keyboard) and configured inline; the
// preview on the right re-renders through /api/report-designer/preview, so it
// is the message that will actually be posted, and a template the server would
// refuse shows its reasons there before anyone presses Save.
//
// The schedule is not edited here: it lives on the controls above the report
// card in Settings, and is carried through unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Reorder, useDragControls } from "framer-motion"
import {
  AlertTriangle, BarChart3, Bell, ChevronDown, ChevronUp, GripVertical, Plus, Sparkles, Trash2, Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { reportApi, scheduleLabel } from "@/lib/report-designer"
import {
  addSection, applyOrder, canAdd, COMPARE_OPTIONS, MAX_RANKING, MAX_SECTIONS, moveSection, newSection,
  removeSection, SECTION_TYPES, sectionSummary, toTemplate, typeLabel, updateSection, withKeys,
} from "@/lib/report-editor"
import SlackMessagePreview from "./SlackMessagePreview"

const ICONS = {
  metric: BarChart3, ranking: Trophy, alerts: Bell, underperforming_ads: AlertTriangle, birdy_take: Sparkles,
}

const PORTFOLIO = "__portfolio__"

function MetricSelect({ value, catalog, onChange, id }) {
  const groups = useMemo(() => {
    const out = new Map()
    for (const m of catalog) {
      if (!out.has(m.source)) out.set(m.source, [])
      out.get(m.source).push(m)
    }
    return [...out.entries()]
  }, [catalog])
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="mt-1.5 h-[36px] w-full text-[13px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {groups.map(([source, items]) => (
          <SelectGroup key={source}>
            <SelectLabel>{source}</SelectLabel>
            {items.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}{m.available === false ? " · not connected" : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function SectionFields({ section, catalog, clients, onChange }) {
  const meta = catalog.find((m) => m.id === section.metric)
  const fid = (name) => `${section._key}-${name}`
  if (section.type === "metric") {
    const scopeValue = typeof section.scope === "object" && section.scope ? section.scope.client_id : PORTFOLIO
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={fid("metric")} className="text-xs font-semibold">Metric</Label>
          <MetricSelect
            id={fid("metric")}
            value={section.metric}
            catalog={catalog}
            onChange={(metric) => {
              const next = catalog.find((m) => m.id === metric)
              // A target comparison only exists for metrics with a stored target.
              onChange({ metric, ...(section.compare === "target" && !next?.has_target ? { compare: "none" } : {}) })
            }}
          />
        </div>
        <div>
          <Label htmlFor={fid("scope")} className="text-xs font-semibold">For</Label>
          <Select
            value={scopeValue}
            onValueChange={(v) => onChange({ scope: v === PORTFOLIO ? "portfolio" : { client_id: v } })}
          >
            <SelectTrigger id={fid("scope")} className="mt-1.5 h-[36px] w-full text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={PORTFOLIO}>All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("compare")} className="text-xs font-semibold">Compare</Label>
          <Select value={section.compare || "none"} onValueChange={(compare) => onChange({ compare })}>
            <SelectTrigger id={fid("compare")} className="mt-1.5 h-[36px] w-full text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPARE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === "target" && !meta?.has_target}>
                  {o.label}{o.value === "target" && !meta?.has_target ? " · no target for this metric" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }
  if (section.type === "ranking") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={fid("metric")} className="text-xs font-semibold">Rank by</Label>
          <MetricSelect id={fid("metric")} value={section.metric} catalog={catalog} onChange={(metric) => onChange({ metric })} />
        </div>
        <div>
          <Label htmlFor={fid("direction")} className="text-xs font-semibold">Show</Label>
          <Select value={section.direction} onValueChange={(direction) => onChange({ direction })}>
            <SelectTrigger id={fid("direction")} className="mt-1.5 h-[36px] w-full text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="best">Best performers</SelectItem>
              <SelectItem value="worst">Clients needing attention</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("limit")} className="text-xs font-semibold">How many</Label>
          <Select value={String(section.limit)} onValueChange={(v) => onChange({ limit: Number(v) })}>
            <SelectTrigger id={fid("limit")} className="mt-1.5 h-[36px] w-full text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: MAX_RANKING }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }
  if (section.type === "birdy_take") {
    return (
      <div>
        <Label htmlFor={fid("focus")} className="text-xs font-semibold">Focus (optional)</Label>
        <Input
          id={fid("focus")}
          value={section.focus || ""}
          maxLength={140}
          onChange={(e) => onChange({ focus: e.target.value })}
          placeholder="e.g. which clients to push budget to"
          className="mt-1.5 h-[36px] text-[13px]"
        />
        <p className="mt-1.5 text-[11.5px] text-pd-faint">Written fresh each time the report goes out, from its own numbers. Uses Birdy Credits.</p>
      </div>
    )
  }
  return <p className="text-[12px] text-pd-faint">Nothing to set up. Birdy fills this in from the period.</p>
}

function SectionRow({ section, index, count, open, onToggle, onMove, onRemove, onChange, catalog, catalogById, clientsById, clients, draggable }) {
  const controls = useDragControls()
  const Icon = ICONS[section.type] || BarChart3
  const fixed = section.type === "birdy_take"
  const body = (
    <div className={`rounded-xl border bg-pd-surface transition-colors ${open ? "border-pd-primary/50" : "border-pd-border"}`}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        {draggable ? (
          <button
            type="button"
            aria-label="Drag to reorder"
            onPointerDown={(e) => controls.start(e)}
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-pd-faint hover:bg-pd-divider hover:text-pd-ink active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : <span className="size-7 shrink-0" />}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pd-primary-tint text-pd-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 cursor-pointer text-left">
          <div className="text-[13px] font-semibold text-pd-ink">{typeLabel(section.type)}</div>
          <div className="truncate text-[12px] text-pd-subtle">{sectionSummary(section, catalogById, clientsById)}</div>
        </button>
        {!fixed && (
          <>
            <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-pd-subtle hover:bg-pd-divider disabled:cursor-default disabled:opacity-30">
              <ChevronUp className="size-4" />
            </button>
            <button type="button" aria-label="Move down" disabled={index >= count - 1} onClick={() => onMove(+1)}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-pd-subtle hover:bg-pd-divider disabled:cursor-default disabled:opacity-30">
              <ChevronDown className="size-4" />
            </button>
          </>
        )}
        <button type="button" aria-label={`Remove ${typeLabel(section.type)}`} onClick={onRemove}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-pd-subtle hover:bg-pd-danger-bg hover:text-pd-danger">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open && (
        <div className="border-t border-pd-divider px-4 py-3.5">
          <SectionFields section={section} catalog={catalog} clients={clients} onChange={onChange} />
        </div>
      )}
    </div>
  )
  if (!draggable) return body
  return (
    <Reorder.Item value={section._key} dragListener={false} dragControls={controls} className="list-none">
      {body}
    </Reorder.Item>
  )
}

export default function ReportEditor({ brief, onSave, onCancel, saving = false }) {
  const [catalog, setCatalog] = useState([])
  const [clients, setClients] = useState([])
  const [title, setTitle] = useState(brief?.title || "")
  const [sections, setSections] = useState(() => withKeys(brief?.sections || []))
  const [openKey, setOpenKey] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const ticket = useRef(0)

  useEffect(() => {
    reportApi.state()
      .then((s) => { setCatalog(s.catalog || []); setClients(s.clients || []) })
      .catch(() => {})
  }, [])

  const catalogById = useMemo(() => Object.fromEntries(catalog.map((m) => [m.id, m])), [catalog])
  const clientsById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients])
  const template = useMemo(() => toTemplate(brief, title, sections), [brief, title, sections])

  // Re-render the real message shortly after the last edit.
  useEffect(() => {
    if (!sections.length) {
      setPreview(null)
      setErrors([])
      return
    }
    const mine = ++ticket.current
    setPreviewLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await reportApi.previewRaw(template)
        if (mine !== ticket.current) return
        if (res.status === 400) {
          const body = await res.json().catch(() => ({}))
          setErrors(body?.detail?.errors || ["This report can't be saved as it is."])
        } else if (res.ok) {
          setPreview(await res.json())
          setErrors([])
        }
      } catch { /* keep the last good preview */ } finally {
        if (mine === ticket.current) setPreviewLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [template, sections.length])

  const add = useCallback((type) => {
    const section = newSection(type, catalog)
    setSections((prev) => addSection(prev, section))
    if (type !== "alerts" && type !== "underperforming_ads") setOpenKey(section._key)
  }, [catalog])

  const movable = sections.filter((s) => s.type !== "birdy_take")
  const take = sections.find((s) => s.type === "birdy_take")
  const rowProps = (section, index) => ({
    section, index, count: movable.length, catalog, catalogById, clientsById, clients,
    open: openKey === section._key,
    onToggle: () => setOpenKey((k) => (k === section._key ? null : section._key)),
    onMove: (d) => setSections((prev) => moveSection(prev, section._key, d)),
    onRemove: () => setSections((prev) => removeSection(prev, section._key)),
    onChange: (patch) => setSections((prev) => updateSection(prev, section._key, patch)),
  })

  const canSave = sections.length > 0 && errors.length === 0 && !saving

  return (
    <div className="grid w-full grid-cols-1 gap-5 text-left lg:h-[min(620px,calc(100dvh-200px))] lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Sections */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-3">
          <Label htmlFor="report-title" className="text-xs font-semibold">Report name</Label>
          <Input
            id="report-title"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Birdy ${brief?.frequency === "weekly" ? "weekly" : "daily"} brief`}
            className="mt-1.5 h-[38px] max-w-[360px] text-[13px]"
          />
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.05em] text-pd-faint">
            SECTIONS · {sections.length}/{MAX_SECTIONS}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={sections.length >= MAX_SECTIONS}>
                <Plus className="size-3.5" /> Add section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[260px]">
              {SECTION_TYPES.map((t) => {
                const Icon = ICONS[t.type]
                return (
                  <DropdownMenuItem key={t.type} disabled={!canAdd(sections, t.type)} onSelect={() => add(t.type)} className="items-start gap-2.5 py-2">
                    <Icon className="mt-0.5 size-3.5 text-pd-primary" />
                    <div>
                      <div className="text-[13px] font-semibold">{t.label}</div>
                      <div className="text-[11.5px] text-pd-faint">{t.type === "birdy_take" && !canAdd(sections, t.type) ? "Already in the report" : t.hint}</div>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pd-scrolly min-h-[240px] flex-1 overflow-y-auto pr-1">
          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-pd-border px-4 py-8 text-center text-[13px] text-pd-subtle">
              No sections yet. Add one to start building the report.
            </div>
          ) : (
            <>
              <Reorder.Group
                axis="y"
                values={movable.map((s) => s._key)}
                onReorder={(keys) => setSections((prev) => applyOrder(prev, keys))}
                className="m-0 flex list-none flex-col gap-2 p-0"
              >
                {movable.map((s, i) => <SectionRow key={s._key} draggable {...rowProps(s, i)} />)}
              </Reorder.Group>
              {take && (
                <div className="mt-2">
                  <SectionRow {...rowProps(take, movable.length)} draggable={false} />
                  <p className="mt-1 pl-1 text-[11px] text-pd-faint">Birdy&apos;s take always closes the report.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.05em] text-pd-faint">LIVE PREVIEW</span>
          <span className="text-[11.5px] text-pd-subtle">{scheduleLabel(template)}</span>
        </div>
        <div className="pd-scrolly min-h-0 flex-1 overflow-y-auto">
          {sections.length === 0 ? (
            <SlackMessagePreview blocks={[]} time={template.time} />
          ) : (
            <SlackMessagePreview blocks={preview?.blocks} time={template.time} loading={previewLoading && !!preview} />
          )}
          {preview?.sample && (
            <p className="mt-2 text-[11.5px] text-pd-faint">Sample numbers until your clients have synced.</p>
          )}
          {errors.length > 0 && (
            <ul className="mt-2.5 list-disc space-y-0.5 pl-4 text-[12px] text-pd-danger" role="alert">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" onClick={() => onSave?.(template)} disabled={!canSave} className="h-auto py-[13px] text-[14.5px] disabled:opacity-40">
            {saving ? "Saving…" : "Save report"}
          </Button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="cursor-pointer p-1 text-center text-[12.5px] font-medium text-pd-subtle hover:text-pd-ink">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
