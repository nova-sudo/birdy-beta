"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LayoutDashboard, Plus } from "lucide-react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { PdCard } from "@/components/portfolio/PdCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardCard } from "@/components/dashboards/DashboardCard"
import { NewDashboardDialog } from "@/components/dashboards/NewDashboardDialog"
import { useDashboards } from "./useDashboards"

// ─── My dashboards ──────────────────────────────────────────────────────────
// The user's saved, AI-assisted dashboards. Opening one goes to
// /dashboards/<id>; creating one saves an empty document first so the detail
// page always has something to load, then hands over any brief in the URL.

export default function DashboardsPage() {
  const router = useRouter()
  const { items, isLoading, error, create, remove } = useDashboards()
  const [creating, setCreating] = useState(false)

  // Memoised because publishing sets state on the provider above: a fresh
  // object every render would republish every render. See usePageHeader.
  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle title="My dashboards" subtitle="Dashboards you and Birdy have built" />
      ),
      controls: (
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New dashboard
        </Button>
      ),
    }),
    [],
  )
  usePageHeader(header)

  const handleCreate = async ({ title, brief }) => {
    const id = await create({ title, brief })
    router.push(brief ? `/dashboards/${id}?brief=${encodeURIComponent(brief)}` : `/dashboards/${id}`)
  }

  const handleRemove = async (id) => {
    try {
      await remove(id)
      toast.success("Dashboard deleted")
    } catch {
      // useDashboards has already rolled the list back and shown the error.
    }
  }

  let body
  if (isLoading) {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading dashboards">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
    )
  } else if (error && items.length === 0) {
    body = (
      <PdCard>
        <p className="text-[13px] text-pd-muted">Couldn&apos;t load your dashboards. Refresh to try again.</p>
      </PdCard>
    )
  } else if (items.length === 0) {
    body = (
      <PdCard className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-pd-muted">
          <LayoutDashboard className="size-5" aria-hidden="true" />
        </span>
        <h2 className="font-pd-display text-[15px] font-semibold text-pd-ink">No dashboards yet</h2>
        <p className="max-w-sm text-[13px] text-pd-muted">
          Describe the numbers you care about and Birdy will lay them out for you.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New dashboard
        </Button>
      </PdCard>
    )
  } else {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((d) => (
          <DashboardCard key={d.id} dashboard={d} onRemove={handleRemove} />
        ))}
      </div>
    )
  }

  return (
    <SalesHubShell>
      {body}
      <NewDashboardDialog open={creating} onOpenChange={setCreating} onCreate={handleCreate} />
    </SalesHubShell>
  )
}
