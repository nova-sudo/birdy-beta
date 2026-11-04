"use client"

import { useState } from "react"

import { Badge, Frame, FrameAction, Notice } from "@/components/ds"

const SECTIONS = [
  ["comparison", "Comparison"],
  ["improved", "Improved or maintained"],
  ["decreased", "Decreased or still in red"],
  ["status_check", "Status check"],
  ["wins", "Wins"],
]

/** The playbook's weekly message, on the days it is due, with Post to Slack. Says so when a due one couldn't be built. */
export function WeeklyMessage({ weekly, run, actions }) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  if (!weekly) {
    if (!run.weekly_error) return null
    return (
      <Frame title="Weekly message" padded contentClassName="text-sm">
        <p className="text-muted-foreground">
          {run.weekly_pending ? "Birdy couldn't build this week's message yet. It tries again by itself." : "Birdy couldn't build this week's message."}
        </p>
      </Frame>
    )
  }

  const post = async () => {
    setPosting(true)
    setError(null)
    try {
      await actions.postWeekly(run.id)
    } catch (err) {
      setError(err?.message || "Couldn't post it. Try again.")
    } finally {
      setPosting(false)
    }
  }

  const action = weekly.posted ? (
    <Badge tone="success" size="sm">Posted to Slack</Badge>
  ) : (
    <FrameAction disabled={posting} onClick={post}>Post to Slack</FrameAction>
  )
  const values = weekly.values ?? {}
  // A refused post is also stored as post_error, so what this press said covers it.
  const problem = error ?? (weekly.posted ? null : weekly.post_error)

  return (
    <Frame title="Weekly message" description={values.week} action={action} padded contentClassName="flex flex-col gap-3 text-sm">
      {problem && <Notice tone="warning">{problem}</Notice>}
      {SECTIONS.map(([key, label]) => (
        <div key={key}>
          <h3 className="font-semibold">{label}</h3>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{values[key]}</p>
        </div>
      ))}
    </Frame>
  )
}
