"use client"

// Background-jobs indicator for the sidebar rail, sitting above the credits
// icon. Invisible while nothing is running; while a job runs (a call being
// analyzed, a long Birdy chat analysis) it shows a spinning icon with a count
// badge — hover for a summary, click for the job list. Fed by
// lib/jobs-store.js, which anything long-running registers with.

import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { useJobs } from "@/lib/jobs-store"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function elapsedLabel(startedAt) {
  const s = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function SidebarJobs() {
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
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <SidebarMenuButton className="relative" aria-label="Background tasks">
                  {running.length > 0 ? (
                    <Loader2 className="animate-spin text-purple-600" />
                  ) : (
                    <CheckCircle2 className="text-emerald-600" />
                  )}
                  {running.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-purple-600 text-[9px] font-semibold text-white">
                      {running.length}
                    </span>
                  )}
                </SidebarMenuButton>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{summary}</TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="end" className="w-72 p-2">
            <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-gray-500">
              Background tasks
            </p>
            <ul className="space-y-1">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
                  {job.status === "running" && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-purple-600" />}
                  {job.status === "done" && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  {job.status === "error" && <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-gray-800">{job.label}</span>
                    {job.detail && (
                      <span className="block text-[11px] leading-snug text-gray-500">{job.detail}</span>
                    )}
                  </span>
                  {job.status === "running" && (
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                      {elapsedLabel(job.startedAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
