import {
  PrimaryButton,
  SecondaryButton,
  STEP_COL,
  StepHeading,
  SuccessRow,
} from "../parts"

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
    <div className={`${STEP_COL} text-left`}>
      <div className="mb-[10px] text-center">
        <StepHeading small>Now, let&apos;s set some targets for {clientDisplayName}.</StepHeading>
      </div>
      <div className="mb-[26px] text-center text-[14px] leading-normal text-pd-body">
        What are your KPI targets for {clientDisplayName}? Birdy uses these to flag when
        something needs attention.
      </div>
      <div className="mb-[18px]">
        <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Cost per acquisition target</div>
        <div className="flex items-center rounded-full border-[1.5px] border-pd-border px-[14px] focus-within:border-pd-primary">
          <span className="mr-[6px] text-[14px] text-pd-faint">{currencySymbol}</span>
          <input
            value={cpa}
            onChange={(e) => setCpa(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="45"
            inputMode="numeric"
            className="flex-1 border-0 py-3 text-[15px] text-pd-ink outline-none placeholder:text-pd-faint"
          />
        </div>
        <div className="mt-[5px] text-[11px] text-pd-faint">Most agencies in your niche target {currencySymbol}30–60.</div>
      </div>
      <div className="mb-[18px]">
        <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Monthly wins target</div>
        <div className="flex items-center rounded-full border-[1.5px] border-pd-border px-[14px] focus-within:border-pd-primary">
          <input
            value={wins}
            onChange={(e) => setWins(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="20"
            inputMode="numeric"
            className="flex-1 border-0 py-3 text-[15px] text-pd-ink outline-none placeholder:text-pd-faint"
          />
          <span className="text-[14px] text-pd-faint">clients closed</span>
        </div>
      </div>
      <div className="mb-[26px]">
        <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Conversion rate target</div>
        <div className="flex items-center rounded-full border-[1.5px] border-pd-border px-[14px] focus-within:border-pd-primary">
          <input
            value={convRate}
            onChange={(e) => setConvRate(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="15"
            inputMode="numeric"
            className="flex-1 border-0 py-3 text-[15px] text-pd-ink outline-none placeholder:text-pd-faint"
          />
          <span className="text-[14px] text-pd-faint">%</span>
        </div>
      </div>
      <div className="text-center">
        <PrimaryButton onClick={() => next({ kpi: { cpa, wins, conv_rate: convRate } })}>
          Apply targets
        </PrimaryButton>
      </div>
    </div>
  )
}

export function KpiDefaultStep({ applyKpiTargets }) {
  return (
    <div className={STEP_COL}>
      <SuccessRow>Targets applied</SuccessRow>
      <div className="mb-3"><StepHeading>Save these as your defaults?</StepHeading></div>
      <div className="mb-[30px] text-[14.5px] leading-relaxed text-pd-body">
        We&apos;ll pre-fill every new client with these numbers — you can always adjust per
        client later.
      </div>
      <div className="flex justify-center gap-3">
        <SecondaryButton onClick={() => applyKpiTargets(false)}>Just this client</SecondaryButton>
        <PrimaryButton onClick={() => applyKpiTargets(true)} className="px-6 py-3">
          Yes, set as default
        </PrimaryButton>
      </div>
    </div>
  )
}
