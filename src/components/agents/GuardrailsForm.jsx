"use client"

import * as React from "react"
import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { Frame, Input, Switch } from "@/components/ds"

const PERMISSIONS = [
  { key: "ads", title: "Turn ads on and off", detail: "Pause losers, revive old winners" },
  { key: "adsets", title: "Turn ad sets on and off", detail: "When every ad in the set is failing" },
  { key: "campaigns", title: "Turn campaigns on and off", detail: "Off by default. Big blast radius." },
  { key: "budgets", title: "Change budgets", detail: "Coming later", locked: true },
]

function Row({ icon: Icon, title, detail, control, className }) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3.5", className)}>
      {Icon && <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />}
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-foreground">{title}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  )
}

/** A text field inside a sentence that reports its value on blur or Enter. */
function BlurField({ value, onCommit, className, ...props }) {
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])
  return (
    <Input
      size="sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
      className={cn("mx-1 inline-flex h-7 px-2 align-middle font-mono text-sm", className)}
      {...props}
    />
  )
}

/**
 * What the agent may touch in Meta and the hard limits it can never cross. Guardrails sit outside
 * the learnable rules, so learning cannot loosen them. Controlled: the page saves on Next.
 *
 * @param {object} props
 * @param {{ads: boolean, adsets: boolean, campaigns: boolean, budgets: boolean}} props.permissions
 * @param {{max_pauses_per_client_day: number, protect_last_live_ad: boolean, protected_tags: string[]}} props.guardrails
 * @param {(patch: {permissions?: object, guardrails?: object}) => void} props.onChange Only the changed keys
 */
export function GuardrailsForm({ permissions = {}, guardrails = {}, onChange, className }) {
  const maxPauses = guardrails.max_pauses_per_client_day ?? 3
  const tags = (guardrails.protected_tags ?? []).join(", ")

  return (
    <div className={cn("flex flex-col gap-7", className)}>
      <Frame title="What is it allowed to do in Meta?" titleAs="h3">
        <div className="divide-y divide-divider">
          {PERMISSIONS.map((p) => (
            <Row
              key={p.key}
              title={p.title}
              detail={p.detail}
              control={
                <Switch
                  aria-label={p.title}
                  checked={p.locked ? false : permissions[p.key] === true}
                  disabled={p.locked}
                  onCheckedChange={(on) => onChange({ permissions: { [p.key]: on } })}
                />
              }
            />
          ))}
        </div>
      </Frame>

      <Frame title="Safety limits" titleAs="h3">
        <div className="divide-y divide-divider">
          <Row
            icon={ShieldCheck}
            title={
              <span className="leading-8">
                Never pause more than
                <BlurField
                  aria-label="Max pauses per client per day"
                  inputMode="numeric"
                  value={String(maxPauses)}
                  onCommit={(raw) => {
                    const n = Number(raw)
                    if (raw.trim() !== "" && Number.isInteger(n) && n >= 0) {
                      onChange({ guardrails: { max_pauses_per_client_day: n } })
                    }
                  }}
                  className="w-12 text-right"
                />
                ads per client per day
              </span>
            }
          />
          <Row
            icon={ShieldCheck}
            title="Never pause the last live ad in an ad set"
            control={
              <Switch
                aria-label="Protect the last live ad"
                checked={guardrails.protect_last_live_ad !== false}
                onCheckedChange={(on) => onChange({ guardrails: { protect_last_live_ad: on } })}
              />
            }
          />
          <Row
            icon={ShieldCheck}
            title={
              <span className="leading-8">
                Never touch ads tagged
                <BlurField
                  aria-label="Protected tags"
                  placeholder="Evergreen"
                  value={tags}
                  onCommit={(raw) =>
                    onChange({
                      guardrails: {
                        protected_tags: raw
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  className="w-40"
                />
              </span>
            }
            detail="Matches part of the ad name. Separate tags with commas."
          />
        </div>
      </Frame>
    </div>
  )
}
