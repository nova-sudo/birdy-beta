"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button, Notice, Surface } from "@/components/ds"

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
  const [imgFailed, setImgFailed] = useState(false)
  if (!data || typeof data !== "object" || !data.test_id || !data.code) return null

  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(w => typeof w === "string") : []
  const n = Number.isInteger(data.n_accounts) && data.n_accounts > 0 ? data.n_accounts : accounts.length
  const ready = data.ready !== false
  const noun = n === 1 ? "account" : "accounts"
  const postLabel = `Post to ${n} ${noun}`

  const send = (key, text) => {
    if (used[key] || !onSend) return
    setUsed(u => ({ ...u, [key]: true }))
    onSend(text)
  }

  const rows = [
    ["Targets", data.targets_text],
    ["Winner when", data.winner_text],
    ["Destination", data.destination_text],
    ["Posts as", data.posts_as],
  ].filter(([, v]) => typeof v === "string" && v)

  return (
    <Surface className="my-3 space-y-3" data-testid="creative-card">
      <div className="flex items-center gap-3">
        {data.thumbnail && !imgFailed && (
          <img src={data.thumbnail} alt="" onError={() => setImgFailed(true)} className="size-12 shrink-0 rounded-control-sm object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium tabular-nums text-muted-foreground">{data.code}</div>
          {data.name && <div className="truncate text-sm font-semibold">{data.name}</div>}
        </div>
      </div>

      {rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <tbody className="divide-y divide-divider">
            {rows.map(([label, value]) => (
              <tr key={label} className="align-top">
                <th scope="row" className="w-28 py-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
                  {label}
                </th>
                <td className="py-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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

      {warnings.map((w, i) => (
        <Notice key={i} tone="warning" icon={AlertTriangle} className="text-xs">
          {w}
        </Notice>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!onSend || !ready || used.post}
          onClick={() => send("post", `Yes, post ${data.code} to ${n} ${noun}.`)}
        >
          {postLabel}
        </Button>
        <Button variant="outline" size="sm" onClick={() => router.push(`/campaigns/creatives/${data.test_id}/edit`)}>
          Open in wizard
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!onSend || used.targets}
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
