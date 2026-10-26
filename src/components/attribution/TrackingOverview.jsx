"use client"

// Every client's tracking status on one screen.
//
// Onboarding imports sub-accounts in bulk, so an agency finishes the wizard with
// fourteen clients at once. Without this the only way to see which are actually
// live is to open fourteen portals one at a time, which means nobody checks and
// half the roster quietly reports nothing.
//
// Unconfigured clients sort to the top, because they are the ones that need
// somebody to make a decision.

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, ExternalLink, Users } from "lucide-react"
import { toast } from "sonner"

import { apiRequest } from "@/lib/api"
import { Badge, Button, EmptyState, ErrorState, Skeleton, Surface } from "@/components/ds"
import { leadSourceOption, needsPixel, normalizeLeadSource } from "@/lib/lead-sources"

const METHOD_TONE = {
  instant_form: "info",
  form_to_ghl: "info",
  landing_page: "primary",
  unknown: "neutral",
}

// `now` is taken when the data arrives, not while rendering, so a row's age is
// stable between renders.
function relative(iso, now) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const mins = Math.round((now - then) / 60000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function TrackingOverview() {
  const router = useRouter()
  const [clients, setClients] = useState(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("/attribution/overview")
      if (!res.ok) throw new Error(`Couldn't load tracking status (${res.status})`)
      const data = await res.json()
      setLoadedAt(Date.now())
      setClients(data.clients || [])
      setError(null)
    } catch (e) {
      setError(e.message || String(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const copyInstallLink = async (row) => {
    const url = `${window.location.origin.replace(/\/$/, "")}/install/${row.site_id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Install link copied")
    } catch {
      toast.error("Couldn't copy — open the client's setup to get the link")
    }
  }

  if (error) {
    return <ErrorState title="Couldn't load tracking" description={error} onRetry={load} />
  }

  if (clients === null) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading tracking status">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-80" />
        <Surface className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Surface>
      </div>
    )
  }

  if (clients.length === 0) {
    return <EmptyState icon={Users} title="No clients yet." />
  }

  const unset = clients.filter((c) => c.method === "unknown").length

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Lead tracking by client</p>
        <p className="mt-0.5 text-sm leading-normal text-body">
          Where each client&apos;s leads come from, and whether the tracking behind it
          is live.
          {unset > 0 && (
            <>
              {" "}
              <span className="font-medium text-foreground">
                {unset} {unset === 1 ? "client has" : "clients have"} no lead source set
              </span>{" "}
              — until one is chosen we can&apos;t tell a quiet month from a missing
              setup.
            </>
          )}
        </p>
      </div>

      <Surface padded={false} className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted text-xs font-medium text-muted-foreground">
              <th className="px-4 py-2.5">Client</th>
              <th className="px-3 py-2.5">Leads from</th>
              <th className="px-3 py-2.5">Script</th>
              <th className="px-3 py-2.5">Last hit</th>
              <th className="px-3 py-2.5 text-right">Captured</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {clients.map((row) => {
              const method = normalizeLeadSource(row.method)
              const needsScript = needsPixel(method)
              return (
                <tr key={row.group_id} className="border-b border-border text-sm last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{row.group_name}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={METHOD_TONE[method] || METHOD_TONE.unknown}>
                      {leadSourceOption(method).short}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {/* An em dash, not a cross: a client on Meta forms, or on a
                        form tool that sends to GoHighLevel, is not failing to
                        install anything. */}
                    {!needsScript ? (
                      <span className="text-muted-foreground">—</span>
                    ) : row.installed ? (
                      <span className="text-success-ink">Live</span>
                    ) : (
                      <span className="text-muted-foreground">Not seen</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-body">
                    {relative(row.last_seen_at, loadedAt) || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-body">
                    {needsScript ? row.tracked_leads : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {row.site_id && needsScript && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInstallLink(row)}
                          className="text-primary"
                          title="Copy the link to send to whoever owns the site"
                        >
                          <Copy aria-hidden className="size-3" /> Link
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/clients/${row.group_id}/tracking`)}
                        className="text-primary"
                      >
                        Set up <ExternalLink aria-hidden className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Surface>
    </div>
  )
}
