import { ExternalLink, Eye, EyeOff, Home, Phone, PhoneOff, RotateCcw } from "lucide-react"
import {
  PrimaryButton,
  SpinnerRing,
  STEP_COL,
  STEP_COL_WIDE,
  StepHeading,
  SuccessRow,
} from "../parts"

export function SalesToolStep({ ghlStatus, salesTool, setSalesTool, next }) {
  return (
    <div className={STEP_COL_WIDE}>
      <div className="mb-2"><StepHeading>What do you use for sales?</StepHeading></div>
      <div className="mb-7 text-[14px] text-pd-faint">
        This decides where Birdy pulls call and close data from.
      </div>
      <div className="flex flex-col gap-[14px] sm:flex-row">
        {[
          {
            id: "ghl",
            label: "GHL",
            desc: ghlStatus === "success" ? "Already connected" : "Uses your GHL connection",
            icon: <Home className="h-[18px] w-[18px]" strokeWidth={2} />,
            chip: "bg-pd-primary-tint text-pd-primary",
          },
          {
            id: "hp",
            label: "Hot Prospector",
            desc: "Connect with an API key",
            icon: <Phone className="h-[18px] w-[18px]" strokeWidth={2} />,
            chip: "bg-pd-warning-bg text-pd-warning",
          },
          // The honest third answer. Without it, an agency that doesn't
          // call its leads had to claim a dialler it doesn't use, and
          // then every call-centre metric in the product reported a
          // confident 0 — indistinguishable from "you made no calls".
          // Answering "none" makes those read "not available" instead,
          // with a route to connect a tool later.
          {
            id: "none",
            label: "I don't call my leads",
            desc: "Skip call tracking for now",
            icon: <PhoneOff className="h-[18px] w-[18px]" strokeWidth={2} />,
            chip: "bg-pd-table-head text-pd-subtle",
          },
        ].map((opt) => (
          <div
            key={opt.id}
            onClick={() => { setSalesTool(opt.id); next({ sales_tool: opt.id }) }}
            className={`flex-1 cursor-pointer rounded-xl border-2 px-4 py-[22px] transition-colors ${
              salesTool === opt.id ? "border-pd-primary bg-pd-primary-tint" : "border-pd-border bg-white"
            }`}
          >
            <div className={`mx-auto mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-xl ${opt.chip}`}>
              {opt.icon}
            </div>
            <div className="mb-1 font-pd-display text-[14.5px] font-semibold text-pd-ink">{opt.label}</div>
            <div className="text-[11.5px] text-pd-faint">{opt.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HpKeyStep({
  hpStatus,
  hpUid,
  setHpUid,
  hpKey,
  setHpKey,
  hpVisible,
  setHpVisible,
  hpError,
  connectHp,
  next,
}) {
  return (
    <div className={STEP_COL}>
      <div className="mb-2"><StepHeading>Connect your Hot Prospector account.</StepHeading></div>
      <div className="mb-[22px] text-[14px] leading-normal text-pd-body">
        Paste your API UID and key below — both are in your Hot Prospector settings.
      </div>
      {hpStatus !== "success" && hpStatus !== "checking" && (
        <>
          <input
            value={hpUid}
            onChange={(e) => setHpUid(e.target.value)}
            placeholder="API UID"
            className="mb-2 w-full rounded-full border-[1.5px] border-pd-border px-[14px] py-[13px] font-mono text-[14px] text-pd-ink outline-none transition-colors placeholder:text-pd-faint focus:border-pd-primary"
          />
          <div className="relative mb-[14px]">
            <input
              value={hpKey}
              onChange={(e) => setHpKey(e.target.value)}
              type={hpVisible ? "text" : "password"}
              placeholder="API key"
              className="w-full rounded-full border-[1.5px] border-pd-border py-[13px] pl-[14px] pr-11 font-mono text-[14px] text-pd-ink outline-none transition-colors placeholder:text-pd-faint focus:border-pd-primary"
            />
            <button
              type="button"
              onClick={() => setHpVisible((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent text-pd-faint"
            >
              {hpVisible ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
            </button>
          </div>
        </>
      )}
      {/* Same reason as the OAuth steps: don't offer the key form
          before we know whether a key is already on file. */}
      {hpStatus === "checking" && (
        <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-faint">
          <SpinnerRing />
          Checking connection…
        </div>
      )}
      {hpStatus === "idle" && (
        <PrimaryButton disabled={!hpUid.trim() || !hpKey.trim()} onClick={connectHp} arrow={false}>
          Connect Hot Prospector
          <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2.4} />
        </PrimaryButton>
      )}
      {hpStatus === "connecting" && (
        <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-primary">
          <SpinnerRing />
          Verifying key…
        </div>
      )}
      {hpStatus === "error" && (
        <>
          <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-4 py-[14px] text-left text-[12.5px] leading-normal text-pd-body">
            <strong className="text-pd-danger">That key was rejected.</strong>{" "}
            {hpError || "Double check you copied the full UID and key from Hot Prospector settings, then try again."}
          </div>
          <PrimaryButton onClick={connectHp} arrow={false}>
            Try again
            <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
          </PrimaryButton>
        </>
      )}
      {hpStatus === "success" && (
        <>
          <SuccessRow>Hot Prospector connected</SuccessRow>
          <PrimaryButton onClick={() => next()}>Continue</PrimaryButton>
        </>
      )}
    </div>
  )
}
