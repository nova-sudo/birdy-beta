"use client"

import { Fragment } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TriggerButton,
} from "@/components/ds"
import { runLabel, useRuns } from "@/lib/stock-agent-api"

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** "2026-11-03" as "2026-11". */
export const monthKey = (iso) => String(iso ?? "").slice(0, 7)

/** "2026-11" as "November 2026". */
export function monthName(key) {
  const [y, m] = String(key).split("-").map(Number)
  return y && m >= 1 && m <= 12 ? `${MONTH_NAMES[m - 1]} ${y}` : String(key)
}

/** A run's label in the picker: its day and batch, and "Today" when it is the newest. */
export const pickerLabel = (run, latestId, batches) => `${runLabel(run, batches)}${run.id === latestId ? " · Today" : ""}`

/**
 * The report picker in the page header (spec §2.1): runs grouped under their month, newest first,
 * then "Whole months" with each month that has runs. "Older reports" pages further back.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {{run?: string, month?: string}} props.value What is on screen
 * @param {(pick: {run?: string, month?: string}) => void} props.onPick
 * @param {object} [props.current] The run on screen, listed even when it's older than the loaded pages (a Slack link)
 * @param {string} [props.latestId] The newest run's id, marked "Today"
 * @param {{id: string, name: string}[]} [props.batches]
 */
export function ReportPicker({ agentId, value = {}, onPick, current, latestId, batches = [] }) {
  const { runs, hasOlder, loadOlder, error, isLoading, mutate } = useRuns(agentId)
  const options = current && !runs.some((r) => r.id === current.id) ? [current, ...runs] : runs
  const newest = latestId ?? options[0]?.id
  const months = [...new Set(options.map((r) => monthKey(r.local_date)).filter(Boolean))]

  const label = value.month
    ? `${monthName(value.month)} · Whole month`
    : current
      ? pickerLabel(current, newest, batches)
      : "Pick a report"
  const selected = value.month ? `month:${value.month}` : current ? `run:${current.id}` : ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TriggerButton aria-label={`Report: ${label}`} className="max-w-full">
          <span className="truncate">{label}</span>
        </TriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuRadioGroup
          value={selected}
          onValueChange={(v) => {
            const [kind, id] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)]
            onPick(kind === "month" ? { month: id } : { run: id })
          }}
        >
          {options.map((r, i) => {
            const head = monthKey(r.local_date) !== monthKey(options[i - 1]?.local_date) ? monthName(monthKey(r.local_date)) : null
            return (
              <Fragment key={r.id}>
                {head && <DropdownMenuLabel>{head}</DropdownMenuLabel>}
                <DropdownMenuRadioItem value={`run:${r.id}`}>{pickerLabel(r, newest, batches)}</DropdownMenuRadioItem>
              </Fragment>
            )
          })}
          {months.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Whole months</DropdownMenuLabel>
              {months.map((m) => (
                <DropdownMenuRadioItem key={m} value={`month:${m}`}>{monthName(m)}</DropdownMenuRadioItem>
              ))}
            </>
          )}
        </DropdownMenuRadioGroup>
        {/* With nothing listed the menu would open as an empty sliver: say why instead. */}
        {options.length === 0 && !error && (
          <DropdownMenuItem disabled>{isLoading ? "Loading reports…" : "No reports yet"}</DropdownMenuItem>
        )}
        {hasOlder && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                loadOlder()
              }}
            >
              Older reports
            </DropdownMenuItem>
          </>
        )}
        {error && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              mutate()
            }}
          >
            Couldn&apos;t load past reports. Retry
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
