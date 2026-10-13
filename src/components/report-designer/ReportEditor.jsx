"use client"

// The Slack report, edited by hand as a real Block Kit message: the same JSON
// array of blocks the copilot writes and Slack receives. "Add block" appends a
// ready-made block of any kind a channel message allows — text, two-column
// numbers, cards, carousels, tables, data tables, native charts (line, bar,
// area, pie) — already wired to live data; "Insert live number" writes a
// {{placeholder}} at the caret. The preview on the right is the message Slack
// will receive, filled with real figures through /api/report-designer/preview,
// and anything Slack's rules won't accept is listed there before Save.
//
// The schedule is not edited here: it lives on the controls above the report
// card in Settings, and is carried through unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Braces, LayoutGrid, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { reportApi, scheduleLabel } from "@/lib/report-designer"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BLOCK_TEMPLATES, buildPlaceholder, insertAt, parseBlocks, toJson } from "@/lib/report-editor"
import SlackMessagePreview from "./SlackMessagePreview"

const ALL = "__all__"
const REPORT_WINDOW = "__report__"

const KINDS = [
  { id: "value", label: "A metric's value" },
  { id: "change", label: "Change vs last report" },
  { id: "vs_target", label: "On / off target" },
  { id: "target", label: "The target itself" },
  { id: "ranking", label: "Ranking of clients" },
  { id: "breakdown", label: "Per-client breakdown" },
  { id: "alerts", label: "Alerts" },
  { id: "flagged_ads", label: "Flagged ads" },
  { id: "birdy_take", label: "Birdy's take (written by AI)" },
  { id: "period", label: "Period name (e.g. Yesterday)" },
  { id: "date", label: "Today's date" },
  { id: "client_count", label: "Number of clients" },
]

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Pick({ value, onChange, children, id }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-[34px] w-full text-[13px]"><SelectValue /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

function MetricItems({ catalog, filter }) {
  const groups = new Map()
  for (const m of catalog.filter(filter || (() => true))) {
    if (!groups.has(m.source)) groups.set(m.source, [])
    groups.get(m.source).push(m)
  }
  return [...groups.entries()].map(([source, items]) => (
    <SelectGroup key={source}>
      <SelectLabel>{source}</SelectLabel>
      {items.map((m) => (
        <SelectItem key={m.id} value={m.id}>{m.label}{m.available === false ? " · not connected" : ""}</SelectItem>
      ))}
    </SelectGroup>
  ))
}

/** The "Insert live number" form. Calls onInsert(placeholderText). */
function InsertNumber({ catalog, clients, periods, onInsert }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState("value")
  const [metric, setMetric] = useState("spend")
  const [client, setClient] = useState(ALL)
  const [period, setPeriod] = useState(REPORT_WINDOW)
  const [order, setOrder] = useState("best")
  const [limit, setLimit] = useState("3")
  const [metrics, setMetrics] = useState(["spend", "leads"])
  const [show, setShow] = useState("summary")
  const [focus, setFocus] = useState("")

  const targeted = useMemo(() => catalog.filter((m) => m.has_target), [catalog])
  const needsTarget = kind === "vs_target" || kind === "target"
  const clientName = client === ALL ? null : clients.find((c) => c.id === client)?.name
  const periodOpt = period === REPORT_WINDOW ? null : period

  useEffect(() => {
    if (needsTarget && !targeted.some((m) => m.id === metric) && targeted[0]) setMetric(targeted[0].id)
  }, [needsTarget, targeted, metric])

  const text = useMemo(() => {
    switch (kind) {
      case "value": return buildPlaceholder(metric, { client: clientName, period: periodOpt })
      case "change": return buildPlaceholder(metric, { client: clientName, show: "change" })
      case "vs_target":
      case "target": return buildPlaceholder(metric, { client: clientName, period: periodOpt, show: kind })
      case "ranking": return buildPlaceholder("ranking", { metric, order, limit, period: periodOpt })
      case "breakdown": return buildPlaceholder("breakdown", { metrics: metrics.join(","), order: order === "worst" ? "worst" : null, limit: limit === "3" ? null : limit, period: periodOpt })
      case "alerts":
      case "flagged_ads": return buildPlaceholder(kind, { show: show === "summary" ? null : show })
      case "birdy_take": return buildPlaceholder("birdy_take", { focus: focus.trim() || null })
      default: return buildPlaceholder(kind)
    }
  }, [kind, metric, clientName, periodOpt, order, limit, metrics, show, focus])

  const multiline = kind === "breakdown" || (kind === "ranking" && limit !== "1") || ((kind === "alerts" || kind === "flagged_ads") && show === "list")
  const usesMetric = ["value", "change", "vs_target", "target", "ranking"].includes(kind)
  const usesClient = ["value", "change", "vs_target", "target"].includes(kind)
  const usesPeriod = ["value", "vs_target", "target", "ranking", "breakdown"].includes(kind)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> Insert live number
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] space-y-3">
        <Field label="What">
          <Pick value={kind} onChange={setKind}>
            {KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
          </Pick>
        </Field>
        {usesMetric && (
          <Field label="Metric">
            <Pick value={metric} onChange={setMetric}>
              <MetricItems catalog={catalog} filter={needsTarget ? (m) => m.has_target : null} />
            </Pick>
          </Field>
        )}
        {kind === "breakdown" && (
          <Field label={`Metrics (up to 4) · ${metrics.length} chosen`}>
            <div className="pd-scrolly max-h-[150px] space-y-0.5 overflow-y-auto rounded-xl border border-pd-border p-1.5">
              {catalog.map((m) => {
                const on = metrics.includes(m.id)
                return (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] hover:bg-pd-divider">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && metrics.length >= 4}
                      onChange={() => setMetrics((prev) => on ? prev.filter((x) => x !== m.id) : [...prev, m.id])}
                    />
                    {m.label}
                  </label>
                )
              })}
            </div>
          </Field>
        )}
        {usesClient && (
          <Field label="For">
            <Pick value={client} onChange={setClient}>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </Pick>
          </Field>
        )}
        {(kind === "ranking" || kind === "breakdown") && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Order">
              <Pick value={order} onChange={setOrder}>
                <SelectItem value="best">Best first</SelectItem>
                <SelectItem value="worst">Worst first</SelectItem>
              </Pick>
            </Field>
            <Field label="How many">
              <Pick value={limit} onChange={setLimit}>
                {["1", "2", "3", "5", "10", "25"].filter((n) => kind === "breakdown" || Number(n) <= 10)
                  .map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </Pick>
            </Field>
          </div>
        )}
        {usesPeriod && (
          <Field label="Period">
            <Pick value={period} onChange={setPeriod}>
              <SelectItem value={REPORT_WINDOW}>The report&apos;s own period</SelectItem>
              {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.label[0].toUpperCase() + p.label.slice(1)}</SelectItem>)}
            </Pick>
          </Field>
        )}
        {(kind === "alerts" || kind === "flagged_ads") && (
          <Field label="Show">
            <Pick value={show} onChange={setShow}>
              <SelectItem value="summary">Count and the latest one</SelectItem>
              <SelectItem value="count">Just the count</SelectItem>
              <SelectItem value="list">A bullet list</SelectItem>
            </Pick>
          </Field>
        )}
        {kind === "birdy_take" && (
          <Field label="Focus (optional)">
            <Input value={focus} maxLength={140} onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. which clients to push budget to" className="h-[34px] text-[13px]" />
          </Field>
        )}
        <code className="block break-all rounded-lg bg-pd-divider px-2.5 py-2 text-[11.5px] text-pd-body">{text}</code>
        <Button
          type="button"
          className="w-full"
          disabled={kind === "breakdown" && metrics.length === 0}
          onClick={() => { onInsert(text, multiline); setOpen(false) }}
        >
          Insert
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export default function ReportEditor({ brief, onSave, onCancel, saving = false }) {
  const [catalog, setCatalog] = useState([])
  const [clients, setClients] = useState([])
  const [periods, setPeriods] = useState([])
  const [json, setJson] = useState(() => toJson(brief?.blocks || []))
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const ticket = useRef(0)
  const area = useRef(null)

  useEffect(() => {
    reportApi.state()
      .then((s) => { setCatalog(s.catalog || []); setClients(s.clients || []); setPeriods(s.periods || []) })
      .catch(() => {})
  }, [])

  const parsed = useMemo(() => parseBlocks(json), [json])
  const template = useMemo(() => ({
    frequency: brief?.frequency || "daily",
    time: brief?.time || "9:00 AM",
    day: brief?.day ?? null,
    blocks: parsed.blocks || [],
  }), [brief, parsed])

  // Re-render the real message shortly after the last edit.
  useEffect(() => {
    if (parsed.error) {
      setErrors([parsed.error])
      return
    }
    if (!parsed.blocks.length) {
      setPreview(null)
      setErrors(["Add a block to start the report."])
      return
    }
    const mine = ++ticket.current
    setPreviewLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await reportApi.previewRaw(template)
        if (mine !== ticket.current) return
        if (res.status === 400) {
          const data = await res.json().catch(() => ({}))
          setErrors(data?.detail?.errors || ["Slack won't accept this message as it is."])
        } else if (res.ok) {
          setPreview(await res.json())
          setErrors([])
        }
      } catch { /* keep the last good preview */ } finally {
        if (mine === ticket.current) setPreviewLoading(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [template, parsed])

  const addBlock = (tpl) => {
    if (parsed.error) return
    const next = [...parsed.blocks, tpl.block()]
    setJson(toJson(next))
    requestAnimationFrame(() => {
      if (area.current) area.current.scrollTop = area.current.scrollHeight
    })
  }

  // A placeholder typed into the JSON lives inside a JSON string, so its quotes are escaped.
  const insertNumber = useCallback((text) => {
    const el = area.current
    const start = el ? el.selectionStart : json.length
    const end = el ? el.selectionEnd : json.length
    const out = insertAt(json, start, end, JSON.stringify(text).slice(1, -1))
    setJson(out.text)
    requestAnimationFrame(() => {
      if (!area.current) return
      area.current.focus()
      area.current.setSelectionRange(out.cursor, out.cursor)
    })
  }, [json])

  const charts = parsed.blocks?.filter((b) => b?.type === "data_visualization").length || 0
  const canSave = !parsed.error && parsed.blocks.length > 0 && errors.length === 0 && !saving

  return (
    <div className="grid w-full grid-cols-1 gap-5 text-left lg:h-[min(660px,calc(100dvh-200px))] lg:grid-cols-[minmax(0,1fr)_440px]">
      {/* The blocks */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={!!parsed.error}>
                <LayoutGrid className="size-3.5" /> Add block
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="pd-scrolly max-h-[420px] w-[290px] overflow-y-auto">
              {BLOCK_TEMPLATES.map((group) => (
                <div key={group.group}>
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-pd-faint">{group.group}</DropdownMenuLabel>
                  {group.items.map((tpl) => {
                    const blocked = tpl.chart && charts >= 2
                    return (
                      <DropdownMenuItem key={tpl.id} disabled={blocked} onSelect={() => addBlock(tpl)} className="flex-col items-start gap-0 py-1.5">
                        <span className="text-[13px] font-semibold">{tpl.label}</span>
                        <span className="text-[11.5px] text-pd-faint">{blocked ? "Slack allows 2 charts per message" : tpl.hint}</span>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" disabled={!!parsed.error}
              onClick={() => setJson(toJson(parsed.blocks))}>
              <Braces className="size-3.5" /> Tidy
            </Button>
            <InsertNumber catalog={catalog} clients={clients} periods={periods} onInsert={insertNumber} />
          </div>
        </div>
        <textarea
          ref={area}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          aria-label="Report blocks"
          className="pd-scrolly min-h-[300px] w-full flex-1 resize-none rounded-2xl border border-pd-border bg-pd-surface px-4 py-3 font-mono text-[12px] leading-relaxed text-pd-ink outline-none transition-[border-color,box-shadow] focus:border-pd-primary focus:ring-4 focus:ring-pd-primary/15"
        />
        <p className="mt-2 text-[11.5px] leading-relaxed text-pd-faint">
          Slack Block Kit, as Slack receives it. Live numbers go in <code className="text-pd-body">{"{{ }}"}</code> placeholders,
          or a <code className="text-pd-body">birdy_data</code> binding on charts, tables and carousels. Or ask Birdy to do it for you.
        </p>
      </div>

      {/* Preview */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.05em] text-pd-faint">LIVE PREVIEW</span>
          <span className="text-[11.5px] text-pd-subtle">{scheduleLabel(template)}</span>
        </div>
        <div className="pd-scrolly min-h-0 flex-1 overflow-y-auto">
          <SlackMessagePreview blocks={preview?.blocks} time={template.time} loading={previewLoading && !!preview} />
          {preview?.sample && (
            <p className="mt-2 text-[11.5px] text-pd-faint">Sample numbers until your clients have synced.</p>
          )}
          {errors.length > 0 && (
            <ul className="mt-2.5 list-disc space-y-0.5 pl-4 text-[12px] text-pd-danger" role="alert">
              {errors.map((e) => <li key={e} className="break-words">{e}</li>)}
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
