"use client"

import { useState } from "react"

import { Badge, Button, Frame, Notice } from "@/components/ds"

const SECTIONS = [
  ["comparison", "Comparison"],
  ["improved", "Improved or maintained"],
  ["decreased", "Decreased or still in red"],
  ["status_check", "Status check"],
  ["wins", "Wins"],
]

/** The playbook's weekly message, on the days it is due, with Post to Slack. */
export function WeeklyMessage({ weekly, runId, actions }) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const values = weekly.values

  const post = async () => {
    setPosting(true)
    setError(null)
    try {
      await actions.postWeekly(runId)
    } catch (err) {
      setError(err?.message || "Couldn't post it. Try again.")
    } finally {
      setPosting(false)
    }
  }

  const action = weekly.posted ? (
    <Badge tone="success" size="sm">Posted to Slack</Badge>
  ) : values ? (
    <Button size="sm" variant="primary" loading={posting} onClick={post}>Post to Slack</Button>
  ) : undefined

  return (
    <Frame title="Weekly message" description={values?.week} action={action} padded contentClassName="flex flex-col gap-3 text-sm">
      {error && <Notice tone="danger">{error}</Notice>}
      {weekly.post_error && !weekly.posted && <Notice tone="warning">{`The last post didn't go out: ${weekly.post_error}`}</Notice>}
      {values ? (
        SECTIONS.map(([key, label]) => (
          <div key={key}>
            <h3 className="font-semibold">{label}</h3>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{values[key]}</p>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground">Birdy couldn&apos;t build this week&apos;s message yet. It tries again by itself.</p>
      )}
    </Frame>
  )
}
