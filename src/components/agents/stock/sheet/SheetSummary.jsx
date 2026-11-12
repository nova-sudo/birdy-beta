"use client"

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds"

const list = (names) => new Intl.ListFormat("en-GB", { type: "conjunction" }).format(names)

function Moved({ moves }) {
  if (!moves || (moves.better.length === 0 && moves.worse.length === 0)) return null
  const tip = [moves.better.length > 0 && `Better: ${list(moves.better)}.`, moves.worse.length > 0 && `Worse: ${list(moves.worse)}.`].filter(Boolean).join(" ")
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-default underline decoration-dotted underline-offset-4 outline-none focus-visible:shadow-focus">
          {moves.better.length} better, {moves.worse.length} worse
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

/** Joins the parts of the line with a middle dot, leaving out the empty ones. */
function Parts({ children }) {
  const parts = children.filter(Boolean)
  return parts.flatMap((part, i) => (i === 0 ? [part] : [<span key={`sep-${i}`} aria-hidden> · </span>, part]))
}

/**
 * The line to the right of the Report tabs (spec §2.1). Today: what's left to decide, stopped and
 * stopping-soon ads, who got better or worse; each part only when it isn't zero. A past run or a
 * month: Read-only, its range, the moves, and the way back to today.
 *
 * @param {object} props
 * @param {"today"|"past"|"month"} props.view
 * @param {{toDecide: number, stopped: number, soon: number}} [props.summary]
 * @param {{better: string[], worse: string[]}} [props.moves]
 * @param {string} [props.range]
 * @param {() => void} [props.onToday]
 */
export function SheetSummary({ view, summary, moves, range, onToday }) {
  const moved = moves && (moves.better.length > 0 || moves.worse.length > 0) ? <Moved key="moved" moves={moves} /> : null
  if (view !== "today") {
    return (
      <p data-testid="sheet-summary" className="text-sm tabular-nums text-muted-foreground">
        <Parts>
          {[
            <b key="ro" className="font-semibold text-foreground">Read-only</b>,
            range ? <span key="range">{range}</span> : null,
            moved,
            <Button key="today" variant="link" size="sm" className="h-auto p-0 align-baseline" onClick={onToday}>
              Back to today&apos;s report
            </Button>,
          ]}
        </Parts>
      </p>
    )
  }
  const s = summary ?? { toDecide: 0, stopped: 0, soon: 0 }
  return (
    <p data-testid="sheet-summary" className="text-sm tabular-nums text-muted-foreground">
      <Parts>
        {[
          <b key="decide" className="font-semibold text-foreground">{s.toDecide > 0 ? `${s.toDecide} to decide` : "Nothing left to decide"}</b>,
          s.stopped > 0 ? <span key="stopped">{s.stopped} ads stopped</span> : null,
          s.soon > 0 ? <span key="soon">{s.soon} {s.soon === 1 ? "stops" : "stop"} soon</span> : null,
          moved,
        ]}
      </Parts>
    </p>
  )
}
