"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { answerPractice, resolvePractice } from "@/lib/agents-api"
import { AlertDiscIcon, Badge, Button, CheckDiscIcon, HelpDiscIcon } from "@/components/ds"

/** The facts as one readable line: "Spend: €71, CPL: €71 vs €22 target". */
export const factsLine = (facts) =>
  (facts ?? [])
    .filter((f) => f && (f.label || f.value))
    .map((f) => (f.label ? `${f.label}: ${f.value}` : String(f.value)))
    .join(", ")

/** The training-chat message sent when the user says they were right about a case. */
export function followUpMessage(practiceCase, answer) {
  const facts = factsLine(practiceCase.facts)
  return `Practice case ${practiceCase.case_id}: I chose ${answer}.${facts ? ` ${facts}` : ""}`
}

/**
 * One real past case. The user decides first; only then does it show what Birdy
 * would have done (birdy_answer and why stay hidden until the answer is in).
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {object} props.case `{case_id, client_name, title, facts, options, birdy_answer, why}`
 * @param {(result: {agreed, birdy_answer, why}) => void} [props.onAnswered]
 * @param {(resolution: "birdy_right"|"user_right") => void} [props.onResolved]
 * @param {(practiceCase: object, answer: string) => void} [props.onAskFollowUp] Sends the follow-up to the training chat
 */
export function PracticeCase({ agentId, case: practiceCase, onAnswered, onResolved, onAskFollowUp, className }) {
  const [answer, setAnswer] = React.useState(null)
  const [result, setResult] = React.useState(null)
  const [resolution, setResolution] = React.useState(null)
  const [busy, setBusy] = React.useState(null)
  const [error, setError] = React.useState(null)

  const choose = async (option) => {
    setBusy(option)
    setError(null)
    try {
      const res = await answerPractice(agentId, practiceCase.case_id, option)
      setAnswer(option)
      setResult(res)
      onAnswered?.(res)
    } catch (err) {
      setError(err?.status === 409 ? "You've already answered this case." : `Couldn't save your answer: ${err.message}`)
    } finally {
      setBusy(null)
    }
  }

  const resolve = async (which) => {
    setBusy(which)
    setError(null)
    try {
      await resolvePractice(agentId, practiceCase.case_id, which)
      setResolution(which)
      onResolved?.(which)
      if (which === "user_right") onAskFollowUp?.(practiceCase, answer)
    } catch (err) {
      setError(err?.status === 409 ? "This case is already settled." : `Couldn't save that: ${err.message}`)
    } finally {
      setBusy(null)
    }
  }

  const agreed = result?.agreed === true
  const Icon = !result ? HelpDiscIcon : agreed || resolution === "birdy_right" ? CheckDiscIcon : AlertDiscIcon
  const iconTone = !result
    ? "text-subdued"
    : agreed || resolution === "birdy_right"
      ? "text-success"
      : resolution === "user_right"
        ? "text-primary"
        : "text-warning"
  const facts = (practiceCase.facts ?? []).filter((f) => f && (f.label || f.value))

  return (
    <div
      data-slot="practice-case"
      data-state={!result ? "open" : agreed ? "agreed" : resolution ?? "pending"}
      className={cn("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4", className)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", iconTone)} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            {practiceCase.client_name}
            <span className="text-muted-foreground"> · </span>
            {practiceCase.title}
          </p>
          {facts.length > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {facts.map((f, i) => (
                <React.Fragment key={i}>
                  {i > 0 && " · "}
                  {f.label ? `${f.label} ${f.value}` : f.value}
                </React.Fragment>
              ))}
            </p>
          )}
          {error && <p className="text-xs text-danger-ink">{error}</p>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 sm:max-w-[22rem] sm:items-end">
        {!result ? (
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            {(practiceCase.options ?? []).map((option) => (
              <Button
                key={option}
                size="sm"
                loading={busy === option}
                disabled={busy != null}
                onClick={() => choose(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        ) : agreed ? (
          <>
            <Badge size="sm" tone="success">
              Birdy agrees: {result.birdy_answer}
            </Badge>
            {result.why && <p className="text-xs text-muted-foreground sm:text-right">{result.why}</p>}
          </>
        ) : resolution ? (
          <Badge size="sm" tone={resolution === "user_right" ? "primary" : "success"}>
            {resolution === "user_right" ? "Birdy will ask about it in the chat" : `Noted: ${result.birdy_answer}`}
          </Badge>
        ) : (
          <>
            <Badge size="sm" tone="warning">
              Birdy would have: {result.birdy_answer}
            </Badge>
            <p className="text-xs text-muted-foreground sm:text-right">
              {result.why ? <span>{result.why}</span> : null} Who&apos;s right?
            </p>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              <Button
                size="sm"
                loading={busy === "birdy_right"}
                disabled={busy != null}
                onClick={() => resolve("birdy_right")}
              >
                Birdy is right
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={busy === "user_right"}
                disabled={busy != null}
                onClick={() => resolve("user_right")}
              >
                I am, update the rule
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
