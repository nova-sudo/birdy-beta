"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LayoutDashboard, Plus } from "lucide-react"
import { Button, EmptyState, ErrorState, Skeleton, Surface } from "@/components/ds"
import { DashboardCard } from "@/components/dashboards/DashboardCard"
import { NewDashboardDialog } from "@/components/dashboards/NewDashboardDialog"
import { useDashboards } from "@/components/dashboards/useDashboards"

/**
 * The saved-dashboards list with its "New dashboard" dialog. Opening a card goes
 * to /hub/dashboards/<id>; creating one saves an empty document first so the
 * detail page always has something to load, then hands over any brief in the URL.
 *
 * The caller owns the dialog's open state so its own "New dashboard" button
 * (page header, section header) can open it.
 *
 * @param {object} props
 * @param {boolean} props.creating Whether the new-dashboard dialog is open
 * @param {(open: boolean) => void} props.onCreatingChange
 */
export function DashboardList({ creating, onCreatingChange }) {
  const router = useRouter()
  const { items, isLoading, error, create, remove, retry } = useDashboards()

  const handleCreate = async ({ title, brief }) => {
    const id = await create({ title, brief })
    router.push(brief ? `/hub/dashboards/${id}?brief=${encodeURIComponent(brief)}` : `/hub/dashboards/${id}`)
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
        <ErrorState title="Couldn't load your dashboards." description="Try again." onRetry={retry} />
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
            <Button variant="outline" onClick={() => onCreatingChange(true)}>
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
    <>
      {body}
      <NewDashboardDialog open={creating} onOpenChange={onCreatingChange} onCreate={handleCreate} />
    </>
  )
}
