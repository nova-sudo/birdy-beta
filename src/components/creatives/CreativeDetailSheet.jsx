"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import {
  Badge,
  BirdyRead,
  Button,
  Frame,
  MetricGroup,
  SegmentedTabs,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  ConfirmHost,
  confirm,
  toast,
} from "@/components/ds"
import { currencySymbol } from "@/lib/chat-viz"
import { archiveCreativeTest, refreshCreativeTest, useCreativeTest } from "@/lib/creatives-api"
import { formatCpl, floorProgress, scoreTone } from "@/lib/creative-verdict"
import { AccountLinesChart } from "./AccountLinesChart"
import { VerdictBadge } from "./VerdictBadge"

const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)
const money = (v, cur) => `${currencySymbol(cur)}${Math.round(num(v) ?? 0).toLocaleString("en-US")}`
// CTR and hook rate arrive as percentages (1.9 = 1.9%).
const pct = (v) => (num(v) == null ? "—" : `${Number(v).toFixed(1).replace(/\.0$/, "")}%`)
const fmtDate = (iso) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null
}

const SCORE_LABEL = { pass: "Pass", fail: "Fail", scoring: "Scoring", removed: "Removed in Meta" }
const DEST = { lead_form: "Lead form", website: "Website", whatsapp: "WhatsApp" }

function adBadge(ad) {
  if (ad.post_state === "failed") return { label: "Failed", tone: "danger" }
  if (ad.post_state === "removed" || ad.score?.state === "removed") return { label: "Removed in Meta", tone: "muted" }
  if (ad.post_state === "pending" || ad.post_state === "uploading") return { label: "Posting", tone: "neutral" }
  const state = ad.score?.state ?? "scoring"
  return { label: SCORE_LABEL[state] ?? "Scoring", tone: scoreTone(state) }
}

/** Ascending CPL; ads without a CPL (no leads, removed) last, original order kept among ties. */
export function sortByCpl(ads) {
  return ads
    .map((ad, i) => ({ ad, i, cpl: num(ad.score?.cpl) }))
    .sort((a, b) => (a.cpl == null) - (b.cpl == null) || (a.cpl ?? 0) - (b.cpl ?? 0) || a.i - b.i)
    .map((x) => x.ad)
}

const OPS = { lte: "≤", gte: "≥" }

/** "target ≤ £35" for the metric under `key`, per the test's mode. */
function targetCaption(targets, key, fmt) {
  if (!targets) return undefined
  if (targets.mode === "baseline") {
    return key === "cpl" || key === "ctr" ? `beat account by ${targets.baseline_pct ?? 15}%` : undefined
  }
  if (targets.mode === "cpl_only" && key !== "cpl") return undefined
  const spec = targets.metrics?.[key]
  if (!spec || num(spec.value) == null) return undefined
  const op = OPS[spec.op ?? (key === "cpl" ? "lte" : "gte")]
  return `target ${op} ${fmt(spec.value)}`
}

function Kpis({ test, currency }) {
  const s = test.summary ?? {}
  const t = test.targets
  const counted = (test.ads ?? []).filter((a) => a.post_state !== "removed").length
  const needed = num(t?.min_spend) != null && counted > 0 ? t.min_spend * counted : null
  const items = [
    {
      key: "spend",
      label: "Spend",
      value: money(s.spend, currency),
      caption: needed != null ? `of ${money(needed, currency)} needed` : undefined,
    },
    { key: "leads", label: "Leads", value: num(s.leads) ?? 0 },
    {
      key: "cpl",
      label: "CPL",
      value: formatCpl(s, currency),
      caption: targetCaption(t, "cpl", (v) => `${currencySymbol(currency)}${v}`),
    },
  ]
  if (test.creative?.format === "image") {
    items.push({ key: "ctr", label: "CTR", value: pct(s.ctr), caption: targetCaption(t, "ctr", (v) => `${v}%`) })
  } else {
    items.push({
      key: "hook",
      label: "Hook rate",
      value: pct(s.hook_rate),
      caption: targetCaption(t, "hook_rate", (v) => `${v}%`),
    })
  }
  return <MetricGroup items={items} />
}

function AccountsTable({ test, currency }) {
  const ads = sortByCpl(test.ads ?? [])
  const isImage = test.creative?.format === "image"
  return (
    <Frame
      title={
        <span className="flex items-center gap-2">
          Accounts <Badge tone="neutral" size="sm">{ads.length}</Badge>
        </span>
      }
      description="Sorted by CPL"
      contentClassName="overflow-x-auto"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Account</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 text-right font-medium">Spend</th>
            <th className="px-2 py-2 text-right font-medium">Leads</th>
            <th className="px-2 py-2 text-right font-medium">CPL</th>
            <th className="px-2 py-2 text-right font-medium">{isImage ? "CTR" : "Hook"}</th>
            <th className="px-4 py-2 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {ads.map((ad) => {
            const cur = ad.currency ?? currency
            const b = adBadge(ad)
            const fp = ad.score?.state === "scoring" ? floorProgress(ad.score, test.targets, cur) : null
            return (
              <tr key={ad.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{ad.account_name ?? ad.ad_account_id}</div>
                  <div className="text-xs text-muted-foreground">{ad.ad_account_id}</div>
                </td>
                <td className="px-2 py-2.5">
                  <Badge tone={b.tone} size="sm">{b.label}</Badge>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{money(ad.score?.spend, cur)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{num(ad.score?.leads) ?? 0}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatCpl(ad.score, cur)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {isImage ? pct(ad.score?.ctr) : pct(ad.score?.hook_rate)}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{fp ? fp.label : ""}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Frame>
  )
}

const WIZARD = "/campaigns/creatives/new"

/**
 * The detail sheet for one creative test: header, KPIs vs targets, per-account lines,
 * accounts, Birdy's read and the footer actions.
 */
export function CreativeDetailSheet({ testId, open, onOpenChange, onAddAccounts, onEditTargets }) {
  const router = useRouter()
  const { test, isLoading } = useCreativeTest(open ? testId : null)
  const [metric, setMetric] = React.useState("cpl")
  const [busy, setBusy] = React.useState(null)

  const isImage = test?.creative?.format === "image"
  const active = isImage && metric === "hook" ? "cpl" : metric
  const currency = test?.summary?.currency ?? "GBP"

  const tabs = [
    { value: "cpl", label: "CPL" },
    { value: "ctr", label: "CTR" },
    ...(isImage ? [] : [{ value: "hook", label: "Hook" }]),
    { value: "leads", label: "Leads" },
  ]

  const addAccounts = () => (onAddAccounts ? onAddAccounts(test) : router.push(`${WIZARD}?test=${testId}&step=accounts`))
  const editTargets = () => (onEditTargets ? onEditTargets(test) : router.push(`${WIZARD}?test=${testId}&step=targets`))

  const refresh = async () => {
    setBusy("refresh")
    try {
      await refreshCreativeTest(testId)
    } catch (err) {
      toast.error("Couldn't refresh", { description: err?.message })
    } finally {
      setBusy(null)
    }
  }

  const archive = async () => {
    const ok = await confirm({
      title: "Archive this test?",
      description: "It leaves the active list and tracking stops. Its ads stay in Meta.",
      confirmLabel: "Archive test",
    })
    if (!ok) return
    setBusy("archive")
    try {
      await archiveCreativeTest(testId)
      onOpenChange?.(false)
    } catch (err) {
      toast.error("Couldn't archive", { description: err?.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {/* No ConfirmHost is mounted app-wide yet, so the archive question brings its own. */}
      <ConfirmHost />
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg">
        <SheetHeader
          actions={
            test && (
              <Button variant="ghost" size="sm" loading={busy === "refresh"} onClick={refresh}>
                <RefreshCw aria-hidden />
                Refresh
              </Button>
            )
          }
        >
          <SheetTitle>{test?.name ?? "Creative test"}</SheetTitle>
          <SheetDescription>
            {test
              ? [test.code, test.origin === "revive" ? "revived ad" : "new ad", fmtDate(test.created_at) && `posted ${fmtDate(test.created_at)}`, `${test.ads?.length ?? 0} accounts`]
                  .filter(Boolean)
                  .join(" · ")
              : "Loading"}
          </SheetDescription>
          {test && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <VerdictBadge status={test.status} />
              <Badge tone="neutral" size="sm">{isImage ? "Image" : "Video"}</Badge>
              {DEST[test.creative?.destination] && <Badge tone="neutral" size="sm">{DEST[test.creative.destination]}</Badge>}
            </div>
          )}
        </SheetHeader>

        <SheetBody className="flex flex-col gap-4 p-4">
          {isLoading || !test ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Kpis test={test} currency={currency} />
              <Frame
                title="Per account"
                description="One line per account, cumulative · dashed = target"
                action={<SegmentedTabs size="sm" ariaLabel="Chart metric" value={active} onValueChange={setMetric} items={tabs} />}
                padded
              >
                <AccountLinesChart days={test.days ?? {}} ads={test.ads ?? []} targets={test.targets} metric={active} currency={currency} />
              </Frame>
              <AccountsTable test={test} currency={currency} />
              <BirdyRead
                findings={[]}
                prompt={`Tell me about creative test ${test.code}`}
                empty="Nothing to flag on this test yet."
              />
            </>
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="ghost" size="sm" disabled={!test} onClick={addAccounts}>Add accounts</Button>
          <Button variant="ghost" size="sm" disabled={!test} onClick={editTargets}>Edit targets</Button>
          {/* "Pause everywhere" arrives with the Phase 2 pause endpoint. */}
          <Button variant="ghost" size="sm" className="ml-auto text-danger-ink" disabled={!test} loading={busy === "archive"} onClick={archive}>
            Archive
          </Button>
        </SheetFooter>
      </SheetContent>
      </Sheet>
    </>
  )
}
