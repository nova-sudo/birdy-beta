"use client"

// The Slack report exactly as the renderer builds it, drawn as a Slack message
// in Slack's dark theme. Blocks come from /api/report-designer/preview, so what
// is shown is what will be posted. Every block a channel message can carry is
// drawn: header, section (text, two-column fields, image or button accessory),
// divider, image, context, actions, rich_text, markdown, table, data_table
// (sortable, paginated), data_visualization (SlackChart), card and carousel.

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronLeft, ChevronRight, ArrowDownUp } from "lucide-react"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { parseMrkdwn } from "@/lib/report-designer"
import { SLACK_PREVIEW_VARS } from "@/lib/brand-colors"
import SlackChart from "./SlackChart"

// ── Text ──────────────────────────────────────────────────────────────────────

function Seg({ s }) {
  if (s.bold) return <strong className="font-semibold text-white">{s.text}</strong>
  if (s.italic) return <em>{s.text}</em>
  if (s.strike) return <s>{s.text}</s>
  if (s.code) return <code className="rounded bg-white/10 px-1 py-px font-mono text-xs text-(--slack-code)">{s.text}</code>
  if (s.href) return <a href={s.href} target="_blank" rel="noreferrer" className="text-(--slack-link) hover:underline">{s.text}</a>
  return s.text
}

export function Mrkdwn({ text }) {
  const lines = parseMrkdwn(text)
  return lines.map((line, i) => {
    const content = line.segs.map((s, j) => <Seg key={j} s={s} />)
    if (line.quote) {
      return <div key={i} className="border-l-4 border-white/25 pl-2.5">{content.length ? content : " "}</div>
    }
    return (
      <Fragment key={i}>
        {content}
        {i < lines.length - 1 && !lines[i + 1]?.quote && <br />}
      </Fragment>
    )
  })
}

function Text({ obj }) {
  if (!obj) return null
  if (typeof obj === "string") return <Mrkdwn text={obj} />
  return obj.type === "plain_text" ? obj.text : <Mrkdwn text={obj.text} />
}

// Rich text: Slack's structured text (sections, lists, quotes, code).
function RichInline({ el }) {
  const st = el.style || {}
  let node = el.type === "link" ? (
    <a href={el.url} target="_blank" rel="noreferrer" className="text-(--slack-link) hover:underline">{el.text || el.url}</a>
  ) : el.type === "emoji" ? (el.unicode ? String.fromCodePoint(...el.unicode.split("-").map((h) => parseInt(h, 16))) : `:${el.name}:`)
    : el.type === "user" ? <span className="rounded bg-(--slack-link)/20 px-0.5 text-(--slack-link)">@user</span>
    : el.type === "channel" ? <span className="rounded bg-(--slack-link)/20 px-0.5 text-(--slack-link)">#channel</span>
    : (el.text ?? "")
  if (st.code) node = <code className="rounded bg-white/10 px-1 font-mono text-xs text-(--slack-code)">{node}</code>
  if (st.bold) node = <strong className="font-semibold text-white">{node}</strong>
  if (st.italic) node = <em>{node}</em>
  if (st.strike) node = <s>{node}</s>
  return node
}

function RichElement({ el }) {
  const inline = (els) => (els || []).map((e, i) => <RichInline key={i} el={e} />)
  if (el.type === "rich_text_section") return <div className="whitespace-pre-wrap">{inline(el.elements)}</div>
  if (el.type === "rich_text_quote") return <div className="whitespace-pre-wrap border-l-4 border-white/25 pl-2.5">{inline(el.elements)}</div>
  if (el.type === "rich_text_preformatted") {
    return <pre className="whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2 font-mono text-xs">{inline(el.elements)}</pre>
  }
  if (el.type === "rich_text_list") {
    const List = el.style === "ordered" ? "ol" : "ul"
    return (
      <List className={`${el.style === "ordered" ? "list-decimal" : "list-disc"} pl-5`} style={{ marginLeft: (el.indent || 0) * 16 }}>
        {(el.elements || []).map((item, i) => <li key={i}>{inline(item.elements)}</li>)}
      </List>
    )
  }
  return null
}

function cellText(c) {
  if (!c) return ""
  if (c.type === "raw_text" || c.type === "raw_number") return c.text ?? String(c.value ?? "")
  if (c.type === "rich_text") return (c.elements || []).flatMap((s) => (s.elements || []).map((e) => e.text || "")).join("")
  if (c.type === "action_cell") return c.element?.text?.text || ""
  return ""
}

function Cell({ c }) {
  if (c?.type === "rich_text") return (c.elements || []).map((el, i) => <RichElement key={i} el={el} />)
  return cellText(c)
}

// ── Elements ──────────────────────────────────────────────────────────────────

function Button({ el, small = false }) {
  const style = el.style === "primary" ? "border-(--slack-primary) bg-(--slack-primary) text-white"
    : el.style === "danger" ? "border-(--slack-danger) text-(--slack-danger)"
      : "border-white/30 text-white/90"
  return (
    <a href={el.url} target="_blank" rel="noreferrer"
      className={`inline-flex items-center rounded-md border font-semibold transition-colors hover:bg-white/10 ${small ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"} ${style}`}>
      {el.text?.text}
    </a>
  )
}

function Img({ el, className }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={el.image_url} alt={el.alt_text || ""} className={className} />
}

function Card({ c, fixed = false }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border border-white/12 bg-white/[0.04] ${fixed ? "w-[230px] shrink-0" : ""}`}>
      {c.hero_image && <Img el={c.hero_image} className="h-[110px] w-full object-cover" />}
      <div className="flex flex-1 flex-col gap-1 p-3">
        {(c.title || c.subtitle) && (
          <div className="flex items-start gap-2">
            {c.icon && <Img el={c.icon} className="size-7 shrink-0 rounded" />}
            <div className="min-w-0">
              {c.title && <div className="text-sm font-semibold text-white"><Text obj={c.title} /></div>}
              {c.subtitle && <div className="text-xs text-white/55"><Text obj={c.subtitle} /></div>}
            </div>
          </div>
        )}
        {c.body && <div className="text-xs text-white/85"><Text obj={c.body} /></div>}
        {c.subtext && <div className="text-xs text-white/50"><Text obj={c.subtext} /></div>}
        {c.actions?.length > 0 && (
          <div className="mt-auto flex flex-wrap justify-end gap-1.5 pt-2">
            {c.actions.map((a, i) => <Button key={i} el={a} small />)}
          </div>
        )}
      </div>
    </div>
  )
}

function DataTable({ b }) {
  const [header, ...data] = b.rows || []
  const pageSize = b.page_size || 5
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState(null) // { col, dir }
  const sorted = useMemo(() => {
    if (!sort) return data
    const numeric = data.every((r) => r[sort.col]?.type === "raw_number")
    return [...data].sort((a, z) => {
      const x = numeric ? a[sort.col].value : cellText(a[sort.col]).toLowerCase()
      const y = numeric ? z[sort.col].value : cellText(z[sort.col]).toLowerCase()
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir
    })
  }, [data, sort])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const shown = sorted.slice(page * pageSize, page * pageSize + pageSize)
  return (
    <div className="overflow-hidden rounded-lg border border-white/12">
      {b.caption && <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-white">{b.caption}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              {(header || []).map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-1.5 font-semibold text-white/80">
                  <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-white"
                    onClick={() => setSort((s) => ({ col: i, dir: s?.col === i ? -s.dir : -1 }))}>
                    {cellText(h)} <ArrowDownUp className="size-3 opacity-50" aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.06] last:border-0">
                {r.map((c, j) => (
                  <td key={j} className={`px-3 py-1.5 text-white/85 ${c?.type === "raw_number" ? "text-right tabular-nums" : ""}`}><Cell c={c} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-3 py-1.5 text-xs text-white/60">
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="cursor-pointer disabled:opacity-30"><ChevronLeft className="size-4" /></button>
          {page + 1} / {pages}
          <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="cursor-pointer disabled:opacity-30"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </div>
  )
}

function Table({ b }) {
  const settings = b.column_settings || []
  return (
    <div className="overflow-x-auto rounded-lg border border-white/12">
      <table className="w-full text-xs">
        <tbody>
          {(b.rows || []).map((r, i) => (
            <tr key={i} className={`border-b border-white/[0.08] last:border-0 ${i === 0 ? "bg-white/[0.04] font-semibold text-white" : "text-white/85"}`}>
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-1.5 ${settings[j]?.is_wrapped ? "" : "whitespace-nowrap"}`}
                  style={{ textAlign: settings[j]?.align || (c?.type === "raw_number" && i > 0 ? "right" : "left") }}>
                  <Cell c={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Blocks ────────────────────────────────────────────────────────────────────

export function Block({ b }) {
  switch (b.type) {
    case "header":
      return <div className="text-lg font-bold leading-snug text-white">{b.text?.text}</div>
    case "section":
      return (
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {b.text && <div className="whitespace-pre-wrap break-words"><Text obj={b.text} /></div>}
            {b.fields?.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {b.fields.map((f, i) => <div key={i} className="whitespace-pre-wrap break-words"><Text obj={f} /></div>)}
              </div>
            )}
          </div>
          {b.accessory?.type === "image" && <Img el={b.accessory} className="size-[72px] shrink-0 rounded-lg object-cover" />}
          {b.accessory?.type === "button" && <div className="shrink-0"><Button el={b.accessory} /></div>}
        </div>
      )
    case "divider":
      return <hr className="border-0 border-t border-white/15" />
    case "image":
      return (
        <figure>
          {b.title && <figcaption className="mb-1 text-xs text-white/70">{b.title.text}</figcaption>}
          <Img el={b} className="max-h-[260px] max-w-full rounded-lg" />
        </figure>
      )
    case "context":
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55">
          {(b.elements || []).map((e, i) => e.type === "image"
            ? <Img key={i} el={e} className="size-4 rounded-sm" />
            : <span key={i} className="whitespace-pre-wrap"><Text obj={e} /></span>)}
        </div>
      )
    case "actions":
      return <div className="flex flex-wrap gap-2">{(b.elements || []).map((e, i) => <Button key={i} el={e} />)}</div>
    case "rich_text":
      return <div className="space-y-1">{(b.elements || []).map((el, i) => <RichElement key={i} el={el} />)}</div>
    case "markdown":
      return (
        <div className="slack-md space-y-2 break-words [&_a]:text-(--slack-link) [&_blockquote]:border-l-4 [&_blockquote]:border-white/25 [&_blockquote]:pl-2.5 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-(--slack-code) [&_h1]:font-bold [&_h1]:text-white [&_h2]:font-bold [&_h2]:text-white [&_h3]:font-bold [&_h3]:text-white [&_hr]:border-white/15 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-white [&_table]:w-full [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.text || ""}</ReactMarkdown>
        </div>
      )
    case "table":
      return <Table b={b} />
    case "data_table":
      return <DataTable b={b} />
    case "data_visualization":
      return <SlackChart block={b} />
    case "card":
      return <div className="max-w-[360px]"><Card c={b} /></div>
    case "carousel":
      return (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {(b.elements || []).map((c, i) => <Card key={i} c={c} fixed />)}
        </div>
      )
    default:
      return null
  }
}

/**
 * focus: { index, key } — scroll block `index` into view and flash it, once per
 * new key. The designer and editor pass the first block that changed, so an
 * addition below the fold is never mistaken for nothing happening.
 */
export default function SlackMessagePreview({ blocks, time, loading = false, focus = null }) {
  const root = useRef(null)
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (!focus || focus.index == null || !blocks?.length) return
    const el = root.current?.querySelector(`[data-block-index="${Math.min(focus.index, blocks.length - 1)}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    setFlash(focus.key)
    const t = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, blocks])
  return (
    <div ref={root} style={SLACK_PREVIEW_VARS} className="rounded-xl bg-(--slack-surface) px-4 py-[14px] text-left shadow-[0_14px_30px_-16px_rgba(20,14,50,0.55)]">
      <div className="flex gap-[10px]">
        <BirdyAvatar size={34} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-[7px]">
            <span className="text-sm font-bold text-white">Birdy</span>
            <span className="rounded-[3px] bg-white/10 px-[4px] text-xs font-semibold uppercase tracking-wide text-white/60">App</span>
            {time && <span className="text-xs text-white/50">{time}</span>}
          </div>
          <div className={`mt-1.5 space-y-2.5 text-xs leading-[1.6] text-white/85 transition-opacity duration-300 ${loading ? "opacity-40" : ""}`}>
            {(blocks || []).map((b, i) => (
              <div
                key={i}
                data-block-index={i}
                className={`scroll-my-3 rounded-lg transition-shadow duration-500 ${
                  flash && focus && i >= focus.index && i < focus.index + (focus.count || 1)
                    ? "shadow-[0_0_0_2px_var(--slack-flash),0_0_0_6px_rgba(144,133,233,0.25)]" : ""}`}
              >
                <Block b={b} />
              </div>
            ))}
            {!blocks?.length && (
              <div className="space-y-2">
                {[70, 92, 84, 60].map((w) => (
                  <div key={w} className="h-3 animate-pulse rounded bg-white/10" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
