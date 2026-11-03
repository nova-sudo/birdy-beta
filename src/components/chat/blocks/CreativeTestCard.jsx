"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button, Surface } from "@/components/ds"

/**
 * Confirm card for a drafted creative test, from a :::creative block.
 *
 * data: { test_id, code, name, thumbnail, origin, accounts:[{name, adset_name}],
 *         targets_text, destination_text, warnings:[str], posts_as, n_accounts?, ready? }
 * Each button works once per card; a missing `ready` counts as ready (older cards).
 */
export default function CreativeTestCard({ data, onSend }) {
  const router = useRouter()
  const [used, setUsed] = useState({})
  if (!data || typeof data !== "object" || !data.test_id || !data.code) return null

  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(w => typeof w === "string") : []
  const n = Number.isInteger(data.n_accounts) && data.n_accounts > 0 ? data.n_accounts : accounts.length
  const ready = data.ready !== false
  const postLabel = `Post to ${n} accounts`

  const send = (key, text) => {
    if (used[key] || !onSend) return
    setUsed(u => ({ ...u, [key]: true }))
    onSend(text)
  }

  return (
    <Surface className="my-3 space-y-3" data-testid="creative-card">
      <div className="flex gap-3">
        {data.thumbnail && (
          <img src={data.thumbnail} alt="" className="size-16 shrink-0 rounded-control-sm object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium tabular-nums text-muted-foreground">{data.code}</div>
          {data.name && <div className="truncate text-sm font-semibold">{data.name}</div>}
          {data.destination_text && <div className="text-xs text-muted-foreground">{data.destination_text}</div>}
          {data.targets_text && <div className="text-xs text-muted-foreground">{data.targets_text}</div>}
        </div>
      </div>

      {accounts.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {accounts.map((a, i) => (
            <li key={i}>
              {a?.name}
              {a?.adset_name && <span className="text-muted-foreground"> · {a.adset_name}</span>}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {data.posts_as && <div className="text-xs text-muted-foreground">{data.posts_as}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!ready || used.post}
          onClick={() => send("post", `Yes, post ${data.code} to ${n} accounts.`)}
        >
          {postLabel}
        </Button>
        <Button variant="outline" size="sm" onClick={() => router.push(`/campaigns/creatives/${data.test_id}/edit`)}>
          Open in wizard
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={used.targets}
          onClick={() => send("targets", `Change the targets for ${data.code}.`)}
        >
          Change targets
        </Button>
      </div>
      {!ready && (
        <div className="text-xs text-muted-foreground">An account still needs an ad set, page or lead form.</div>
      )}
    </Surface>
  )
}
