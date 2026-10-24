import { User, Users } from "lucide-react"
import { Label } from "@/components/ds"
import {
  OptionCard,
  OptionGrid,
  STEP_COL,
  StepHeading,
  StepInput,
  SuccessRow,
  WizardFooter,
} from "../parts"

/** A numeric target box with an optional leading symbol and trailing unit. */
function TargetField({ id, label, prefix, suffix, hint, value, onChange, placeholder }) {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <StepInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={placeholder}
          inputMode="numeric"
          className={`${prefix ? "pl-8" : ""} ${suffix ? "pr-28" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function KpiTargetsStep({
  clientDisplayName,
  currencySymbol,
  cpa,
  setCpa,
  wins,
  setWins,
  convRate,
  setConvRate,
  next,
}) {
  return (
    <div className={STEP_COL}>
      <StepHeading
        description={`What are your KPI targets for ${clientDisplayName}? Birdy uses these to flag when something needs attention.`}
      >
        Now, let&apos;s set some targets for {clientDisplayName}.
      </StepHeading>
      <TargetField
        id="kpi-cpa"
        label="Cost per acquisition target"
        prefix={currencySymbol}
        hint={`Most agencies in your niche target ${currencySymbol}30–60.`}
        value={cpa}
        onChange={setCpa}
        placeholder="45"
      />
      <TargetField
        id="kpi-wins"
        label="Monthly wins target"
        suffix="clients closed"
        value={wins}
        onChange={setWins}
        placeholder="20"
      />
      <TargetField
        id="kpi-conv"
        label="Conversion rate target"
        suffix="%"
        value={convRate}
        onChange={setConvRate}
        placeholder="15"
      />
      <WizardFooter
        primary={{ label: "Apply targets", onClick: () => next({ kpi: { cpa, wins, conv_rate: convRate } }) }}
      />
    </div>
  )
}

export function KpiDefaultStep({ applyKpiTargets }) {
  return (
    <div className={STEP_COL}>
      <SuccessRow>Targets applied</SuccessRow>
      <StepHeading description="We'll pre-fill every new client with these numbers — you can always adjust per client later.">
        Save these as your defaults?
      </StepHeading>
      <OptionGrid label="Save as defaults">
        <OptionCard
          icon={<User strokeWidth={2} />}
          label="Just this client"
          selected={false}
          onClick={() => applyKpiTargets(false)}
        />
        <OptionCard
          icon={<Users strokeWidth={2} />}
          label="Yes, set as default"
          selected={false}
          onClick={() => applyKpiTargets(true)}
        />
      </OptionGrid>
    </div>
  )
}
