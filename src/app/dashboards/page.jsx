"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LayoutDashboard, Plus } from "lucide-react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { Button, EmptyState, ErrorState, Skeleton, Surface } from "@/components/ds"
import { DashboardCard } from "@/components/dashboards/DashboardCard"
import { NewDashboardDialog } from "@/components/dashboards/NewDashboardDialog"
import { useDashboards } from "./useDashboards"

// ─── My dashboards ──────────────────────────────────────────────────────────
// The user's saved, AI-assisted dashboards. Opening one goes to
// /dashboards/<id>; creating one saves an empty document first so the detail
// page always has something to load, then hands over any brief in the URL.

export default function DashboardsPage() {
  const router = useRouter()
  const { items, isLoading, error, create, remove, retry } = useDashboards()
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
          <Skeleton key={i} className="h-22 rounded-surface" />
        ))}
      </div>
    )
  } else if (error && items.length === 0) {
    body = (
      <Surface>
        <ErrorState
          title="Couldn't load your dashboards"
          description="Refresh to try again."
          onRetry={retry}
        />
      </Surface>
    )
  } else if (items.length === 0) {
    body = (
      <Surface>
        <EmptyState
          icon={LayoutDashboard}
          title="No dashboards yet"
          description="Describe the numbers you care about and Birdy will lay them out for you."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              New dashboard
            </Button>
          }
        />
      </Surface>
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
