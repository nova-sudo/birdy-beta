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
import { Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { apiRequest } from "@/lib/api"
import { cn } from "@/lib/utils"

const METHOD_LABEL = {
  instant_form: "Meta forms",
  landing_page: "Landing page",
  external_form: "Form tool",
  unknown: "Not set",
}

const METHOD_TONE = {
  instant_form: "bg-pd-info-bg text-pd-info",
  landing_page: "bg-pd-primary-tint text-pd-primary",
  external_form: "bg-pd-primary-tint text-pd-primary",
  unknown: "bg-pd-divider text-pd-faint",
}

function relative(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function TrackingOverview() {
  const router = useRouter()
  const [clients, setClients] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("/attribution/overview")
      if (!res.ok) throw new Error(`Couldn't load tracking status (${res.status})`)
      const data = await res.json()
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
    return (
      <div className="rounded-[14px] border border-pd-border bg-pd-surface p-5">
        <p className="text-[13px] text-pd-danger">{error}</p>
        <button onClick={load} className="mt-2 text-[12.5px] text-pd-primary">
          Try again
        </button>
      </div>
    )
  }

  if (clients === null) {
    return (
      <div className="rounded-[14px] border border-pd-border bg-pd-surface p-5 text-[13px] text-pd-faint">
        Loading tracking status…
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-[14px] border border-pd-border bg-pd-surface p-5 text-[13px] text-pd-faint">
        No clients yet.
      </div>
    )
  }

  const unset = clients.filter((c) => c.method === "unknown").length

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[13px] font-semibold text-pd-ink">Lead tracking by client</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-pd-body">
          Where each client&apos;s leads come from, and whether the tracking behind it
          is live.
          {unset > 0 && (
            <>
              {" "}
              <span className="font-medium text-pd-ink">
                {unset} {unset === 1 ? "client has" : "clients have"} no lead source set
              </span>{" "}
              — until one is chosen we can&apos;t tell a quiet month from a missing
              setup.
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-pd-border bg-pd-surface">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-pd-row-border bg-pd-table-head text-[10.5px] font-semibold uppercase tracking-wide text-pd-faint">
              <th className="px-4 py-2.5">Client</th>
              <th className="px-3 py-2.5">Leads from</th>
              <th className="px-3 py-2.5">Script</th>
              <th className="px-3 py-2.5">Last hit</th>
              <th className="px-3 py-2.5 text-right">Captured</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {clients.map((row, index) => {
              const needsScript = row.method === "landing_page" || row.method === "external_form"
              return (
                <tr
                  key={row.group_id}
                  className={cn(
                    "border-b border-pd-row-border last:border-b-0 text-[12.5px]",
                    index % 2 === 1 && "bg-pd-row-zebra",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-pd-ink">{row.group_name}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        METHOD_TONE[row.method] || METHOD_TONE.unknown,
                      )}
                    >
                      {METHOD_LABEL[row.method] || row.method}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {/* An em dash, not a cross: a client on Meta forms is not
                        failing to install anything. */}
                    {!needsScript ? (
                      <span className="text-pd-faint">—</span>
                    ) : row.installed ? (
                      <span className="text-pd-success">Live</span>
                    ) : (
                      <span className="text-pd-faint">Not seen</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-pd-body">
                    {relative(row.last_seen_at) || <span className="text-pd-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-pd-body">
                    {needsScript ? row.tracked_leads : <span className="text-pd-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {row.site_id && needsScript && (
                        <button
                          onClick={() => copyInstallLink(row)}
                          className="flex items-center gap-1 text-[12px] text-pd-primary hover:underline"
                          title="Copy the link to send to whoever owns the site"
                        >
                          <Copy className="size-3" /> Link
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/clients/${row.group_id}/tracking`)}
                        className="flex items-center gap-1 text-[12px] text-pd-primary hover:underline"
                      >
                        Set up <ExternalLink className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
