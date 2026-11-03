"use client"

import { Plus, RotateCcw } from "lucide-react"

import {
  Frame,
  Input,
  Label,
  Notice,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SegmentedTabs,
  Surface,
  Textarea,
} from "@/components/ds"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/creative-naming"
import { MediaDrop } from "./MediaDrop"
import { RevivePicker } from "./RevivePicker"

export const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn more" },
  { value: "SIGN_UP", label: "Sign up" },
  { value: "GET_QUOTE", label: "Get quote" },
  { value: "APPLY_NOW", label: "Apply now" },
  { value: "CONTACT_US", label: "Contact us" },
  { value: "BOOK_NOW", label: "Book now" },
]

const DESTINATIONS = [
  { value: "lead_form", label: "Lead form" },
  { value: "website", label: "Website URL" },
  { value: "whatsapp", label: "WhatsApp" },
]

const SLUG_MAX = 40

/** Lenient while typing (a trailing dash stays); the server slugifies for good. */
function typingSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
}

/** Whether "Continue" is allowed on step 1. */
export function creativeStepValid(draft) {
  const c = draft?.creative ?? {}
  const hasCreative = draft?.origin === "revive" ? !!draft.source?.ad_id : !!c.media?.blob_url
  if (!hasCreative) return false
  if (!c.primary_text?.trim()) return false
  if (!c.destination) return false
  if (c.destination === "website" && !c.website_url?.trim()) return false
  return true
}

/** The creative fields a revived ad hands over. */
export function reviveChanges(ad, draft) {
  const video = !!ad.video_id
  const source = { ad_id: ad.ad_id, ad_account_id: ad.ad_account_id }
  if (ad.image) source.image_url = ad.image
  if (video) source.video_id = ad.video_id
  if (ad.thumbnail) source.thumbnail_url = ad.thumbnail
  return {
    origin: "revive",
    source,
    ...(draft.name ? {} : { name: ad.name || "" }),
    "creative.format": video ? "video" : "image",
    "creative.media": video ? { video_id: ad.video_id, thumbnail_url: ad.thumbnail ?? null } : { image_url: ad.image ?? ad.thumbnail },
    "creative.primary_text": ad.body ?? "",
    "creative.headline": ad.title ?? "",
  }
}

function PathCard({ icon: Icon, title, text, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col gap-1 rounded-frame bg-background p-4 text-left shadow-surface focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
        selected && "ring-2 ring-primary"
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon aria-hidden className="size-4" />
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </button>
  )
}

function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Wizard step 1: choose the path, then the creative itself.
 *
 * @param {object} props
 * @param {object} props.draft From `useCreativeDraft`
 * @param {(path: string, value: any) => void} props.setField
 * @param {(changes: object, opts?: { silent?: boolean }) => void} props.setFields
 */
export function StepCreative({ draft, setField, setFields }) {
  const revive = draft.origin === "revive"
  const c = draft.creative
  const locked = !!draft.id // origin and source are fixed once the draft exists
  const source = draft.source
  const thumb = source?.thumbnail_url || source?.image_url || c.media?.thumbnail_url || c.media?.image_url

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <PathCard
          icon={Plus}
          title="Create a new ad"
          text="Upload media, write the copy and test it."
          selected={!revive}
          disabled={locked && revive}
          onClick={() => setFields({ origin: "new" }, { silent: true })}
        />
        <PathCard
          icon={RotateCcw}
          title="Test an ad you already have"
          text="Pick a running ad and test it in other accounts."
          selected={revive}
          disabled={locked && !revive}
          onClick={() => setFields({ origin: "revive" }, { silent: true })}
        />
      </div>

      <Frame title="Creative" description="Name is generated from the code and the name slug." padded>
        <div className="flex flex-col gap-4">
          {revive ? (
            source ? (
              <div className="flex flex-col gap-2">
                <Label>Source ad</Label>
                <Surface className="flex items-center gap-3 p-3">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-14 rounded-control object-cover" />
                  ) : (
                    <span className="size-14 rounded-control bg-muted" />
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{draft.name || source.ad_id}</p>
                    <p className="text-muted-foreground">{source.ad_account_id}</p>
                  </div>
                </Surface>
                {source.video_id && (
                  <Notice tone="info">To post this video to other ad accounts, upload the file.</Notice>
                )}
              </div>
            ) : (
              <RevivePicker onPick={(ad) => setFields(reviveChanges(ad, draft))} />
            )
          ) : (
            <MediaDrop
              media={c.media}
              onChange={(media, format) => setFields({ "creative.media": media, "creative.format": format })}
            />
          )}

          <Field id="creative-primary-text" label="Primary text">
            <Textarea id="creative-primary-text" value={c.primary_text} onChange={(e) => setField("creative.primary_text", e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="creative-headline" label="Headline">
              <Input id="creative-headline" value={c.headline} onChange={(e) => setField("creative.headline", e.target.value)} />
            </Field>
            <Field id="creative-cta" label="Call to action">
              <Select value={c.cta_type} onValueChange={(v) => setField("creative.cta_type", v)}>
                <SelectTrigger id="creative-cta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CTA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="creative-description" label="Description">
            <Input id="creative-description" value={c.description} onChange={(e) => setField("creative.description", e.target.value)} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label>Destination</Label>
            <SegmentedTabs
              ariaLabel="Destination"
              value={c.destination}
              onValueChange={(v) => setField("creative.destination", v)}
              items={DESTINATIONS}
            />
            <p className="text-xs text-muted-foreground">Lead forms belong to a Facebook Page, so you pick the form per account in the next step.</p>
          </div>

          {c.destination === "website" && (
            <Field id="creative-website-url" label="Website URL">
              <Input
                id="creative-website-url"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={c.website_url}
                onChange={(e) => setField("creative.website_url", e.target.value)}
              />
            </Field>
          )}

          <Field id="creative-name" label="Internal name" hint="Shown in Birdy. The Meta ad name follows the convention below.">
            <Input id="creative-name" value={draft.name} onChange={(e) => setField("name", e.target.value)} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="creative-slug">Meta ad name</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-control bg-muted px-2.5 py-2 font-mono text-sm text-muted-foreground">{`${draft.code ?? "CT-xxxx"} | `}</span>
              <Input
                id="creative-slug"
                aria-label="Ad name slug"
                value={draft.slug}
                onChange={(e) => setField("slug", typingSlug(e.target.value))}
                onBlur={() => setField("slug", slugify(draft.slug))}
                placeholder="untitled"
              />
            </div>
            <p className="text-xs text-muted-foreground">The code and separator are fixed. Same name in every account.</p>
          </div>
        </div>
      </Frame>
    </div>
  )
}
