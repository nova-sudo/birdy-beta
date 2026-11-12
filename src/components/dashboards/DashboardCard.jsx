"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { LayoutDashboard, Trash2 } from "lucide-react"
import { Button } from "@/components/ds"
import { HubCard } from "@/components/hub/HubCard"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * One saved dashboard as a compact hub card: title, when it last changed, and
 * the whole card opens it.
 *
 * The delete button is a sibling of the link (HubCard's `actions`), not a child,
 * since a button inside an anchor is invalid HTML. It shows on hover and focus,
 * and confirms before removing.
 */
export function DashboardCard({ dashboard, onRemove }) {
  const [confirming, setConfirming] = useState(false)
  const updated = dashboard.updatedAt ? new Date(dashboard.updatedAt) : null
  const hasDate = updated && !Number.isNaN(updated.getTime())

  return (
    <div className="group/dash">
      <HubCard
        href={`/hub/dashboards/${dashboard.id}`}
        icon={LayoutDashboard}
        title={dashboard.title}
        line={hasDate ? `Edited ${formatDistanceToNow(updated, { addSuffix: true })}` : "Not yet saved"}
        actionsInset="pr-8"
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${dashboard.title}`}
            onClick={() => setConfirming(true)}
            className="text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/dash:opacity-100 max-md:opacity-100"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        }
      />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${dashboard.title}" and its widgets will be permanently removed. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onRemove(dashboard.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
