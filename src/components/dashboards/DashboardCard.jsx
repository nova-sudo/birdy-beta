"use client"

import { useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { LayoutDashboard, Trash2 } from "lucide-react"
import { Button, Surface } from "@/components/ds"
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
 * One saved dashboard: title, when it last changed, click through to open it.
 *
 * The delete button is a sibling of the link, not a child — a button inside an
 * anchor is invalid HTML and makes both unreliable to click or tab to. It is
 * laid over the card's top-right corner instead, and confirms before removing.
 */
export function DashboardCard({ dashboard, onRemove }) {
  const [confirming, setConfirming] = useState(false)
  const updated = dashboard.updatedAt ? new Date(dashboard.updatedAt) : null
  const hasDate = updated && !Number.isNaN(updated.getTime())

  return (
    <div className="group relative">
      <Surface className="transition-shadow duration-200 group-hover:shadow-floating motion-reduce:transition-none">
        <Link
          href={`/hub/dashboards/${dashboard.id}`}
          className="flex items-start gap-3 rounded-control outline-none focus-visible:shadow-control-focus"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
            <LayoutDashboard className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 pr-8">
            <span className="block truncate text-base font-semibold text-foreground">
              {dashboard.title}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {hasDate ? `Updated ${formatDistanceToNow(updated, { addSuffix: true })}` : "Not yet saved"}
            </span>
          </span>
        </Link>
      </Surface>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${dashboard.title}`}
        onClick={() => setConfirming(true)}
        className="absolute right-3 top-3 text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
      >
        <Trash2 aria-hidden="true" />
      </Button>

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
