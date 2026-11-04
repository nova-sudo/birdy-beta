"use client"

import { Badge, ErrorState, Frame, Skeleton } from "@/components/ds"
import { useLessons } from "@/lib/stock-agent-api"
import { Lesson } from "./LearnedFrame"

const EMPTY =
  "Nothing yet. When you edit a card, overrule Birdy or comment on a card in Slack, the lesson shows up here, dated and yours to remove."

/**
 * The Lessons tab: every lesson Birdy has learned, oldest first. Active ones reach the AI; an overruled one
 * stays listed below, where Keep brings it back.
 */
export function LessonsList({ agentId, actions, nameOf }) {
  const { lessons, error, isLoading, mutate } = useLessons(agentId)

  if (error && lessons.length === 0) {
    return <ErrorState title="Couldn't load the lessons" description={error.message} onRetry={() => mutate()} />
  }
  if (isLoading && lessons.length === 0) return <Skeleton className="h-40 w-full rounded-frame" />

  const active = lessons.filter((l) => l.status !== "overruled")
  const overruled = lessons.filter((l) => l.status === "overruled")

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Frame
        title="Lessons"
        description="Birdy uses these on every run. Overrule one and it stops."
        action={<Badge tone="neutral">{active.length}</Badge>}
      >
        {active.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">{EMPTY}</p>
        ) : (
          active.map((lesson) => <Lesson key={lesson.id} lesson={lesson} actions={actions} nameOf={nameOf} />)
        )}
      </Frame>
      {overruled.length > 0 && (
        <Frame
          title="Overruled"
          description="Birdy ignores these. Keep one to bring it back."
          action={<Badge tone="neutral">{overruled.length}</Badge>}
        >
          {overruled.map((lesson) => (
            <Lesson key={lesson.id} lesson={lesson} actions={actions} nameOf={nameOf} />
          ))}
        </Frame>
      )}
    </div>
  )
}
