"use client"

import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { useJobs } from "@/lib/jobs-store"
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "../overlays/tooltip"

function elapsedLabel(startedAt) {
  const s = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

/**
 * Background-jobs row for the sidebar footer. Renders nothing while idle; while
 * a job runs it shows a spinner and count, with a popover listing every job.
 * Same data (lib/jobs-store) and behaviour as the legacy SidebarJobs.
 */
export function SidebarJobs({ className }) {
  const jobs = useJobs()
  if (jobs.length === 0) return null

  const running = jobs.filter((j) => j.status === "running")
  const summary =
    running.length === 0
      ? "Finished"
      : running.length === 1
        ? running[0].label
        : `${running.length} tasks running`

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-ds="sidebar-jobs"
              aria-label="Background tasks"
              className={cn(
                "flex h-control w-full items-center gap-2 rounded-control px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:shadow-control-focus",
                className
              )}
            >
              {running.length > 0 ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="size-4 text-success" />
              )}
              <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
              {running.length > 0 && <span className="num text-xs text-muted-foreground">{running.length}</span>}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{summary}</TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="end" className="w-72 p-2">
        <p className="px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground">Background tasks</p>
        <ul className="space-y-1">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-start gap-2 rounded-control px-2 py-1.5 hover:bg-muted">
              {job.status === "running" && <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />}
              {job.status === "done" && <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />}
              {job.status === "error" && <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">{job.label}</span>
                {job.detail && <span className="block text-xs leading-snug text-muted-foreground">{job.detail}</span>}
              </span>
              {job.status === "running" && (
                <span className="num shrink-0 text-xs text-muted-foreground">{elapsedLabel(job.startedAt)}</span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
