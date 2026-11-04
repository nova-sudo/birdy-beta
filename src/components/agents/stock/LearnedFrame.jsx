"use client"

import { useState } from "react"

import { Badge, Button, Frame, Notice } from "@/components/ds"
import { shortDay } from "@/lib/stock-agent-api"

const SOURCES = {
  edit: "From an edit",
  dismiss: "From a dismissed card",
  slack_mention: "From a Slack mention",
  overrule: "From an overrule",
  promoted: "From a rule you accepted",
}

function Lesson({ lesson, actions, nameOf }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const overruled = lesson.status === "overruled"
  const origin = [
    SOURCES[lesson.source],
    lesson.client_group_id ? nameOf(lesson.client_group_id) : null,
    lesson.created_at ? shortDay(lesson.created_at) : null,
  ].filter(Boolean).join(", ")

  const press = async (key, fn) => {
    setBusy(key)
    setError(null)
    try {
      await fn(lesson.id)
    } catch (err) {
      setError(err?.message || "That didn't work. Try again.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 text-xs">
          <p className="[overflow-wrap:anywhere]">&quot;{lesson.text}&quot;</p>
          {origin && <p className="text-muted-foreground">{origin}.</p>}
        </div>
        <span className="flex items-center gap-2">
          {overruled && <Badge tone="neutral" size="sm">Overruled</Badge>}
          {lesson.kept && !overruled && <Badge tone="success" size="sm">Kept</Badge>}
          {(overruled || !lesson.kept) && (
            <Button size="sm" loading={busy === "keep"} disabled={Boolean(busy)} onClick={() => press("keep", actions.keepLesson)}>Keep</Button>
          )}
          {!overruled && (
            <Button size="sm" loading={busy === "overrule"} disabled={Boolean(busy)} onClick={() => press("overrule", actions.overruleLesson)}>Overrule</Button>
          )}
        </span>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

/** The lessons made since the last report. Each is active until someone overrules it. */
export function LearnedFrame({ lessons, actions, nameOf }) {
  return (
    <Frame title="What I learned since last time" description="Lessons are yours to overrule" descriptionInline>
      {lessons.map((lesson) => (
        <Lesson key={lesson.id} lesson={lesson} actions={actions} nameOf={nameOf} />
      ))}
    </Frame>
  )
}
