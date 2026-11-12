"use client"

import { useMemo, useState } from "react"
import { BookOpen, CalendarDays, ChevronRight, DollarSign, Euro, PoundSterling, RefreshCw, TriangleAlert } from "lucide-react"

import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ds"
import { cn } from "@/lib/utils"
import { parseServerDate, shortDay, useLessons } from "@/lib/stock-agent-api"
import { LessonSheet } from "./LessonSheet"
import { TeachBirdyDialog } from "./TeachBirdyDialog"

const SOURCE_WORDS = {
  chat: "You told Birdy in chat",
  edit: "You edited a card",
  slack_mention: "Your comment in Slack",
  promoted: "From your results",
  chat_edit: "You changed it in chat",
}

/**
 * Where a lesson came from, in the words of spec §4.1. A dismiss names the client it was on.
 *
 * @param {{source?: string, client_group_id?: string}} lesson
 * @param {(gid: string) => string} nameOf
 */
export function sourceLabel(lesson, nameOf) {
  if (lesson?.source === "dismiss") {
    return lesson.client_group_id ? `You overruled a change on ${nameOf(lesson.client_group_id)}` : "You overruled a change"
  }
  return SOURCE_WORDS[lesson?.source] ?? "Added by Birdy"
}

const REVIVE = /\b(revive|reviv\w*|turn(ed|ing)? (it |them |an ad |ads )?back on|bring (it |them )?back|switch(ed)? back on|restart)\b/i
const REMOVE = /\b(remov\w*|paus\w*|stop\w*|turn(ed|ing)? off|kill\w*|switch(ed)? off)\b/i
const WEEKDAY = /\b(weekends?|weekdays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|daily|each day)\b/i
const MONEY = /[£$€]|\b(cpl|cost|costs|spend|budget|per lead|a lead|target|price)\b/i

/**
 * The icon for a lesson's row: remove/pause, revive, schedule, money, or a book for anything else.
 * It reads `kind`, `filter.weekdays` and the words of the text, in that order.
 */
export function lessonIcon(lesson) {
  const kind = String(lesson?.kind ?? "").toLowerCase()
  const text = String(lesson?.text ?? "")
  if (kind === "revive" || REVIVE.test(text)) return RefreshCw
  if (kind === "remove" || kind === "pause" || REMOVE.test(text)) return TriangleAlert
  if (lesson?.filter?.weekdays?.length || WEEKDAY.test(text)) return CalendarDays
  if (MONEY.test(text)) return text.includes("$") ? DollarSign : text.includes("€") ? Euro : PoundSterling
  return BookOpen
}

const ICON_TONE = new Map([
  [TriangleAlert, "bg-primary-soft text-primary-ink"],
  [RefreshCw, "bg-success-soft text-success-ink"],
  [CalendarDays, "bg-info-soft text-info-ink"],
  [PoundSterling, "bg-warning-soft text-warning-ink"],
  [DollarSign, "bg-warning-soft text-warning-ink"],
  [Euro, "bg-warning-soft text-warning-ink"],
  [BookOpen, "bg-purple-soft text-purple-ink"],
])

const newestFirst = (a, b) => (parseServerDate(b.created_at)?.getTime() ?? 0) - (parseServerDate(a.created_at)?.getTime() ?? 0)

function LessonRow({ lesson, nameOf, onOpen }) {
  const Icon = lessonIcon(lesson)
  const uses = Number(lesson.uses) || 0
  const meta = [lesson.client_group_id ? nameOf(lesson.client_group_id) : "All clients", sourceLabel(lesson, nameOf), lesson.created_at ? shortDay(lesson.created_at) : null]
    .filter(Boolean)
    .join(" · ")
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(lesson.id)}
        className="flex w-full items-center gap-4 rounded-frame bg-background px-4 py-3.5 text-left shadow-surface transition-colors hover:bg-row-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      >
        <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-control", ICON_TONE.get(Icon))}>
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm text-muted-foreground">{meta}</span>
          <span className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">{lesson.text}</span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {uses > 0 ? (
            <>
              <b className="font-display font-semibold text-foreground">{uses}×</b> used
            </>
          ) : (
            "Not used yet"
          )}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}

/**
 * The Lessons tab: what Birdy has been told, newest first, each with where it came from and how often Birdy
 * was given it. A row opens the lesson in a sheet; Teach Birdy opens a chat that adds, changes or removes them.
 * Overruled lessons wait behind "Show N overruled"; removed ones aren't listed.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {ReturnType<import("@/lib/stock-agent-api").useStockActions>} props.actions
 * @param {(gid: string) => string} props.nameOf
 * @param {(runId: string|null, gid: string) => void} [props.onOpenCard] Opens a client's card chat on the report
 */
export function LessonsTab({ agentId, actions, nameOf, onOpenCard }) {
  const { lessons, error, isLoading, mutate } = useLessons(agentId)
  const [openId, setOpenId] = useState(null)
  const [showOverruled, setShowOverruled] = useState(false)

  const { active, overruled } = useMemo(() => {
    const sorted = [...lessons].sort(newestFirst)
    return {
      // Overrule sets `active: false` too, so the status decides; a removed lesson is active: false and not overruled.
      active: sorted.filter((l) => l.status !== "overruled" && l.active !== false),
      overruled: sorted.filter((l) => l.status === "overruled"),
    }
  }, [lessons])
  const opened = openId ? [...active, ...overruled].find((l) => l.id === openId) ?? null : null

  if (error && lessons.length === 0) {
    return <ErrorState title="Couldn't load the lessons" description={error.message} onRetry={() => mutate()} />
  }
  if (isLoading && lessons.length === 0) return <Skeleton className="h-40 w-full rounded-frame" />

  const sheet = (
    <LessonSheet
      lesson={opened}
      onOpenChange={(open) => !open && setOpenId(null)}
      actions={actions}
      nameOf={nameOf}
      source={opened ? sourceLabel(opened, nameOf) : null}
      onOpenCard={
        onOpenCard &&
        ((runId, gid) => {
          setOpenId(null)
          onOpenCard(runId, gid)
        })
      }
    />
  )

  if (active.length === 0 && overruled.length === 0) {
    return (
      <EmptyState
        variant="surface"
        icon={BookOpen}
        title="No lessons yet"
        description="Tell Birdy what to do differently and it follows that on every run."
        action={<TeachBirdyDialog agentId={agentId} variant="primary" />}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {active.length === 1 ? "1 lesson" : `${active.length} lessons`}. Birdy uses these on every run.
        </p>
        <TeachBirdyDialog agentId={agentId} />
      </div>
      {active.length > 0 && (
        <ul aria-label="Lessons" className="flex flex-col gap-2.5">
          {active.map((l) => (
            <LessonRow key={l.id} lesson={l} nameOf={nameOf} onOpen={setOpenId} />
          ))}
        </ul>
      )}
      {overruled.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <Button variant="ghost" size="sm" className="self-start" aria-expanded={showOverruled} onClick={() => setShowOverruled((v) => !v)}>
            {showOverruled ? `Hide ${overruled.length} overruled` : `Show ${overruled.length} overruled`}
          </Button>
          {showOverruled && (
            <ul aria-label="Overruled lessons" className="flex flex-col gap-2.5 opacity-70">
              {overruled.map((l) => (
                <LessonRow key={l.id} lesson={l} nameOf={nameOf} onOpen={setOpenId} />
              ))}
            </ul>
          )}
        </div>
      )}
      {sheet}
    </div>
  )
}
