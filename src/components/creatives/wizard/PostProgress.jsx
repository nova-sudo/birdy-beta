"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  Badge,
  Button,
  Frame,
  Input,
  Notice,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Surface,
} from "@/components/ds"
import { goLiveCreativeTest, retryCreativeAd, useCreativeAdsets, useCreativeTest } from "@/lib/creatives-api"

const STATE = {
  pending: { label: "Posting", tone: "neutral" },
  created: { label: "Created, paused", tone: "info" },
  active: { label: "Live", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  removed: { label: "Removed in Meta", tone: "muted" },
}

/** The fix for a failed ad that needs a choice before it can be retried. */
function AdsetFix({ ad, destination, onRetry, busy }) {
  const { adsets, isLoading } = useCreativeAdsets(ad.ad_account_id, destination)
  const [picked, setPicked] = useState("")
  const label = `Ad set for ${ad.account_name ?? ad.ad_account_id}`
  if (isLoading) return <Skeleton className="h-8 w-48" />
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={picked} onValueChange={setPicked}>
        <SelectTrigger aria-label={label} size="sm" className="w-56">
          <SelectValue placeholder="Choose an ad set" />
        </SelectTrigger>
        <SelectContent>
          {adsets.map((a) => (
            <SelectItem key={a.id} value={a.id} disabled={a.compatible === false}>
              <span className="flex flex-col">
                <span>{a.name}</span>
                {a.compatible === false && a.reason && <span className="text-xs text-muted-foreground">{a.reason}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!picked || busy}
        onClick={() => onRetry({ adset_id: picked, adset_name: adsets.find((a) => a.id === picked)?.name })}
      >
        Retry with this ad set
      </Button>
    </div>
  )
}

function WebsiteFix({ hasUrl, onRetry, busy }) {
  const [url, setUrl] = useState("")
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasUrl && <Input size="sm" aria-label="Website URL" placeholder="https://" className="w-56" value={url} onChange={(e) => setUrl(e.target.value)} />}
      <Button size="sm" disabled={busy || (!hasUrl && !url.trim())} onClick={() => onRetry(hasUrl ? { destination: "website" } : { destination: "website", website_url: url.trim() })}>
        Use website URL instead
      </Button>
    </div>
  )
}

function AdRow({ ad, test, retry, busy }) {
  const state = STATE[ad.post_state] ?? STATE.pending
  const err = ad.post_error
  const label = ad.account_name ?? ad.ad_account_id
  return (
    <Surface className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{ad.ad_account_id}</span>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>
      {ad.post_state === "created" && err?.message && <p className="text-sm text-danger-ink">{err.message}</p>}
      {ad.post_state === "failed" && err && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-danger-ink">{err.message}</p>
          {err.fix === "use_website_url" && <WebsiteFix hasUrl={!!test.creative?.website_url} busy={busy} onRetry={(p) => retry(ad, p)} />}
          {err.fix === "pick_adset" && <AdsetFix ad={ad} destination={test.creative?.destination} busy={busy} onRetry={(p) => retry(ad, p)} />}
          {err.fix === "reconnect_meta" && (
            <Button size="sm" variant="outline" onClick={() => (window.location.href = "/settings")}>
              Reconnect Meta
            </Button>
          )}
          {(err.fix === "retry_later" || !err.fix) && (
            <div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => retry(ad)}>
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </Surface>
  )
}

/**
 * Per-account posting progress. Polls every 3 s while the test is `posting`.
 * Every ad is created paused; they go live together, or partially when some failed.
 *
 * @param {object} props
 * @param {string} props.testId
 */
export function PostProgress({ testId }) {
  const router = useRouter()
  const { test, isLoading } = useCreativeTest(testId, { pollWhilePosting: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!test) return isLoading ? <Skeleton data-testid="post-progress" className="h-40 w-full" /> : null
  const ads = test.ads ?? []
  const count = (s) => ads.filter((a) => a.post_state === s).length
  const created = count("created")
  const failed = count("failed")
  const waiting = count("pending") + count("uploading")
  const posting = test.status === "posting"
  // Every ad is done trying and some are created but not live: the automatic go-live did not happen
  // (or failed), so the test would sit in "posting". Offer it by hand, partially when some failed.
  const canGoLive = posting && created >= 1 && waiting === 0

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const goLive = () =>
    run(async () => {
      const res = await goLiveCreativeTest(testId, { partialOk: failed >= 1 })
      if (res?.errors?.length) {
        const e = new Error(`Couldn't set ${res.errors.length} ${res.errors.length === 1 ? "ad" : "ads"} live: ${res.errors.map((x) => x.message).filter(Boolean).join("; ")}`)
        throw e
      }
    })
  const retry = (ad, patch) => run(() => retryCreativeAd(testId, ad.id, patch))

  return (
    <Frame
      title={posting ? "Posting your creative" : "Posted"}
      description={posting ? "Every ad is created paused first, then they go live together." : "Your ads are created."}
      padded
    >
      <div data-testid="post-progress" className="flex flex-col gap-3">
        {error && <Notice tone="danger">{error.message}</Notice>}
        {ads.map((ad) => (
          <AdRow key={ad.id} ad={ad} test={test} retry={retry} busy={busy} />
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canGoLive && (
            <Button disabled={busy} onClick={goLive}>
              {failed >= 1 ? `Go live with the ${created} that worked` : "Go live"}
            </Button>
          )}
          {(!posting || count("active") > 0) && (
            <Button variant="outline" onClick={() => router.push(`/campaigns?tab=creatives&creative=${test.code}`)}>
              Open test
            </Button>
          )}
        </div>
      </div>
    </Frame>
  )
}
