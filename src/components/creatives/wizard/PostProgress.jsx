"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Badge, Button, Frame, Input, Notice, Skeleton, Surface, fieldVariants } from "@/components/ds"
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
      <select aria-label={label} value={picked} onChange={(e) => setPicked(e.target.value)} className={fieldVariants({ size: "sm" })}>
        <option value="">Choose an ad set</option>
        {adsets.map((a) => (
          <option key={a.id} value={a.id} disabled={a.compatible === false}>
            {a.name}
          </option>
        ))}
      </select>
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
  const worked = created
  const posting = test.status === "posting"

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
          {created >= 1 && failed >= 1 && (
            <Button disabled={busy} onClick={() => run(() => goLiveCreativeTest(testId, { partialOk: true }))}>
              Go live with the {worked} that worked
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
