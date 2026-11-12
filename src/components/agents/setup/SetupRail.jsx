"use client"

import { useState } from "react"
import useSWR from "swr"
import { Check, ChevronDown } from "lucide-react"

import { Button, ProgressBar, Surface } from "@/components/ds"
import { ConfidenceMeter } from "@/components/agents/ConfidenceMeter"
import { READY_SCORE, isReady } from "@/components/agents/AgentTraining"
import { useAgentRules } from "@/lib/agents-api"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { SETUP_STEPS, currentStep, stepAnswer, stepsDone } from "./steps"

/**
 * Slack is the one step that can't always be answered (no workspace connected), so Turn on
 * waits for the other five and the server's own `ready`.
 */
export function canTurnOn(steps, confidence) {
  const done = steps ?? {}
  return isReady(confidence) && SETUP_STEPS.every((s) => s.key === "slack" || done[s.key])
}

function StepRow({ step, done, now, answer, onChange, disabled }) {
  return (
    <li aria-label={step.label} aria-current={now ? "step" : undefined} className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden>
        {done ? (
          <Check className="size-4 text-success" />
        ) : now ? (
          <span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
        ) : (
          <span className="size-2.5 rounded-full border border-muted-foreground/50" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm", done || now ? "font-medium text-foreground" : "text-muted-foreground")}>
          {step.label}
        </span>
        {done && answer && <span className="truncate text-xs text-muted-foreground">{answer}</span>}
        {now && <span className="text-xs font-medium text-primary">Asking now</span>}
      </span>
      {done && (
        <Button
          variant="ghost"
          size="sm"
          className="-my-1 shrink-0 text-muted-foreground"
          disabled={disabled}
          aria-label={`Change ${step.label.toLowerCase()}`}
          onClick={() => onChange?.(step.key)}
        >
          Change
        </Button>
      )}
    </li>
  )
}

/**
 * The setup's right rail: how far along it is, each step with its answer, the confidence score,
 * and Turn on. Below 1024px it folds into a bar above the chat that opens on a tap.
 *
 * @param {object} props
 * @param {object} props.agent The draft agent (`training.steps`, scope, permissions, description)
 * @param {object|null} props.confidence From `useAgentConfidence`
 * @param {(key: string) => void} props.onChange A step's Change was pressed
 * @param {() => void} props.onTurnOn
 * @param {boolean} [props.turningOn]
 * @param {boolean} [props.busy] Birdy is answering: hold the Change buttons
 */
export function SetupRail({ agent, confidence, onChange, onTurnOn, turningOn = false, busy = false, className }) {
  const [open, setOpen] = useState(false)
  const steps = agent?.training?.steps ?? {}
  const now = currentStep(steps)
  const done = stepsDone(steps)
  const ready = canTurnOn(steps, confidence)

  const { rules } = useAgentRules(agent?.id)
  const slackId = agent?.scope?.slack_channel_id
  const { data: channelData } = useSWR(slackId ? queryKeys.slackChannels() : null, fetcher)
  const ctx = { rules: steps.playbook ? rules : undefined, channels: channelData?.channels }

  return (
    <Surface padded={false} aria-label="Setup status" className={cn("flex flex-col overflow-hidden", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left lg:pointer-events-none"
        aria-expanded={open}
        aria-controls="setup-rail-body"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-medium text-foreground">Setup</span>
        <ProgressBar
          value={(done / SETUP_STEPS.length) * 100}
          tone="primary"
          label="Steps done"
          aria-valuemax={SETUP_STEPS.length}
          aria-valuenow={done}
          className="h-1 flex-1 shadow-none"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {done} of {SETUP_STEPS.length}
        </span>
        <ChevronDown aria-hidden className={cn("size-4 text-muted-foreground transition-transform lg:hidden", open && "rotate-180")} />
      </button>

      <div id="setup-rail-body" className={cn("flex-col border-t border-border", open ? "flex" : "hidden lg:flex")}>
        <ol className="flex flex-col px-4 py-2">
          {SETUP_STEPS.map((step) => (
            <StepRow
              key={step.key}
              step={step}
              done={Boolean(steps[step.key])}
              now={step.key === now}
              answer={stepAnswer(agent, step.key, ctx)}
              onChange={onChange}
              disabled={busy}
            />
          ))}
        </ol>

        {confidence && steps.playbook && (
          <div className="border-t border-border p-3">
            <ConfidenceMeter
              score={confidence.score}
              parts={confidence.parts}
              threshold={READY_SCORE}
              missing={confidence.missing}
              ready={confidence.ready}
              className="gap-y-3 p-3 shadow-none md:grid-cols-1"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border p-4">
          <Button variant="primary" className="w-full" disabled={!ready} loading={turningOn} onClick={() => onTurnOn?.()}>
            Turn on
          </Button>
          {!ready && <p className="text-center text-xs text-muted-foreground">Unlocks once I&apos;ve asked everything</p>}
        </div>
      </div>
    </Surface>
  )
}
