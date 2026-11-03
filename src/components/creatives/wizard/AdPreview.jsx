"use client"

import { useState } from "react"

import { Button, Frame, SegmentedTabs } from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { useCreativePages } from "@/lib/creatives-api"
import { cn } from "@/lib/utils"

const CTA_LABEL = {
  LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up",
  GET_QUOTE: "Get quote",
  APPLY_NOW: "Apply now",
  CONTACT_US: "Contact us",
  BOOK_NOW: "Book now",
}
const PLACEMENTS = [
  { value: "feed", label: "Feed" },
  { value: "reels", label: "Reels" },
  { value: "stories", label: "Stories" },
]
const TEXT_LIMIT = 125

/** The hostname of a URL without "www."; "" for anything that isn't a URL. */
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/** Resolves the Page name for one account row (fetches that account's Pages). */
function usePageName(row) {
  const { pages } = useCreativePages(row?.ad_account_id)
  return pages.find((p) => p.id === row?.page_id)?.name ?? ""
}

function AccountChip({ row, active, onSelect }) {
  const name = usePageName(row)
  return (
    <Button size="sm" variant={active ? "secondary" : "ghost"} aria-pressed={active} onClick={onSelect}>
      {name || row.ad_account_id}
    </Button>
  )
}

function PageHeader({ row }) {
  const name = usePageName(row)
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span aria-hidden className="size-8 shrink-0 rounded-full bg-primary-soft" />
      <div className="flex min-w-0 flex-col">
        <b data-testid="preview-page-name" className="truncate text-[13px] font-semibold">
          {name || "Your Page"}
        </b>
        <span className="text-[11px] text-muted-foreground">Sponsored</span>
      </div>
    </div>
  )
}

function ViewOnMeta({ ad }) {
  const [state, setState] = useState("idle")
  async function open() {
    setState("loading")
    try {
      const res = await apiRequest(`/api/facebook/ad-preview/${ad.meta.ad_id}`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.preview_url) throw new Error("no preview")
      window.open(d.preview_url, "_blank", "noopener,noreferrer")
      setState("idle")
    } catch {
      setState("error")
    }
  }
  const label = ad.account_name ?? ad.ad_account_id
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <Button size="sm" variant="outline" disabled={state === "loading"} onClick={open}>
        {state === "error" ? "Preview unavailable, retry" : `View on Meta`}
        <span className="sr-only"> for {label}</span>
      </Button>
    </div>
  )
}

function Media({ creative, source, placement }) {
  const media = creative?.media
  const video = media?.blob_url && media?.mime?.startsWith("video/")
  const src = media?.blob_url || media?.image_url || media?.thumbnail_url || source?.image_url || source?.thumbnail_url
  const tall = placement !== "feed"
  return (
    <div
      data-testid="preview-media"
      className={cn("w-full overflow-hidden bg-muted", tall ? "mx-auto aspect-[9/16] max-h-[420px]" : "aspect-square")}
    >
      {video ? (
        <video src={media.blob_url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Ad media" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-xs text-muted-foreground">Your media shows here</div>
      )}
    </div>
  )
}

/**
 * The wizard's sticky live ad preview: the user's own media and copy in a feed/reels/stories frame.
 *
 * @param {object} props
 * @param {object} props.creative `draft.creative`
 * @param {object[]} [props.accounts] Selected account rows `{ad_account_id, page_id}`; the Page name follows the chosen one
 * @param {object} [props.source] Revive source `{image_url, thumbnail_url}` used when there is no local media
 * @param {object[]} [props.postedAds] After posting: test ads (`meta.ad_id`) that get a "View on Meta" button
 */
export function AdPreview({ creative, accounts = [], source, postedAds = [] }) {
  const [placement, setPlacement] = useState("feed")
  const [picked, setPicked] = useState(null)
  const c = creative ?? {}
  const row = accounts.find((a) => a.ad_account_id === picked) ?? accounts[0] ?? null

  const text = c.primary_text ?? ""
  const [expanded, setExpanded] = useState(false)
  const clipped = !expanded && text.length > TEXT_LIMIT
  const shown = clipped ? text.slice(0, TEXT_LIMIT).trimEnd() : text

  const whatsapp = c.destination === "whatsapp"
  const cta = whatsapp ? "Send message" : (CTA_LABEL[c.cta_type] ?? "")
  const caption = c.destination === "website" ? domainOf(c.website_url) : ""
  const live = postedAds.filter((a) => a.meta?.ad_id)

  return (
    <Frame
      title="Preview"
      titleAs="h3"
      padded
      action={<SegmentedTabs size="sm" ariaLabel="Placement" value={placement} onValueChange={setPlacement} items={PLACEMENTS} />}
      footer="Posts paused first, then goes live together."
    >
      <div className="flex flex-col gap-3">
        {accounts.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Preview as account">
            {accounts.map((a) => (
              <AccountChip key={a.ad_account_id} row={a} active={a.ad_account_id === row?.ad_account_id} onSelect={() => setPicked(a.ad_account_id)} />
            ))}
          </div>
        )}
        <div className="overflow-hidden rounded-xl bg-background text-[13px] shadow-sm">
          <PageHeader row={row} />
          <p data-testid="preview-text" className="whitespace-pre-wrap px-3 pb-2.5 text-body">
            {shown}
            {clipped && (
              <>
                {" "}
                <button type="button" className="text-muted-foreground" onClick={() => setExpanded(true)}>
                  …more
                </button>
              </>
            )}
          </p>
          <Media creative={c} source={source} placement={placement} />
          <div className="flex items-center justify-between gap-2 bg-muted px-3 py-2.5">
            <div className="flex min-w-0 flex-col">
              <span data-testid="preview-caption" className="truncate text-[11px] uppercase text-muted-foreground">
                {c.destination === "lead_form" ? "FORM ON FACEBOOK" : caption}
              </span>
              <b className="truncate text-[13px] font-semibold">{c.headline}</b>
            </div>
            {cta && (
              <span className="shrink-0 rounded-md bg-background px-3 py-1.5 text-xs font-medium shadow-sm">{cta}</span>
            )}
          </div>
        </div>
        {live.length > 0 && (
          <div className="flex flex-col gap-2">
            {live.map((ad) => (
              <ViewOnMeta key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </Frame>
  )
}
