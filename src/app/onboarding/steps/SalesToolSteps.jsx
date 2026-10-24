import { Eye, EyeOff, Home, Phone, PhoneOff } from "lucide-react"
import { Button, Notice, Spinner } from "@/components/ds"
import {
  OptionCard,
  OptionGrid,
  STEP_COL,
  STEP_COL_WIDE,
  StepHeading,
  StepInput,
  SuccessRow,
  WizardFooter,
} from "../parts"

export function SalesToolStep({ ghlStatus, salesTool, setSalesTool, next }) {
  const options = [
    {
      id: "ghl",
      label: "GHL",
      desc: ghlStatus === "success" ? "Already connected" : "Uses your GHL connection",
      icon: <Home strokeWidth={2} />,
    },
    {
      id: "hp",
      label: "Hot Prospector",
      desc: "Connect with an API key",
      icon: <Phone strokeWidth={2} />,
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
      icon: <PhoneOff strokeWidth={2} />,
    },
  ]

  return (
    <div className={STEP_COL_WIDE}>
      <StepHeading description="This decides where Birdy pulls call and close data from.">
        What do you use for sales?
      </StepHeading>
      <OptionGrid label="Sales tool">
        {options.map((opt) => (
          <OptionCard
            key={opt.id}
            icon={opt.icon}
            label={opt.label}
            hint={opt.desc}
            selected={salesTool === opt.id}
            onClick={() => { setSalesTool(opt.id); next({ sales_tool: opt.id }) }}
          />
        ))}
      </OptionGrid>
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
  // The footer's primary follows the connection: Connect while the key is being
  // typed, Try again after a rejection, Continue once it is on file.
  const primary =
    hpStatus === "success"
      ? { label: "Continue", onClick: () => next() }
      : hpStatus === "error"
        ? { label: "Try again", onClick: connectHp }
        : {
            label: "Connect Hot Prospector",
            onClick: connectHp,
            disabled: hpStatus !== "idle" || !hpUid.trim() || !hpKey.trim(),
            loading: hpStatus === "connecting",
          }

  return (
    <div className={STEP_COL}>
      <StepHeading description="Paste your API UID and key below — both are in your Hot Prospector settings.">
        Connect your Hot Prospector account.
      </StepHeading>
      {hpStatus !== "success" && hpStatus !== "checking" && (
        <div className="mb-4 flex flex-col gap-2">
          <StepInput
            value={hpUid}
            onChange={(e) => setHpUid(e.target.value)}
            placeholder="API UID"
            className="font-mono"
          />
          <div className="relative">
            <StepInput
              value={hpKey}
              onChange={(e) => setHpKey(e.target.value)}
              type={hpVisible ? "text" : "password"}
              placeholder="API key"
              className="pr-11 font-mono"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setHpVisible((v) => !v)}
              aria-label={hpVisible ? "Hide API key" : "Show API key"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {hpVisible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
      )}
      {/* Same reason as the OAuth steps: don't offer the key form
          before we know whether a key is already on file. */}
      {hpStatus === "checking" && (
        <div className="inline-flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
          <Spinner />
          Checking connection…
        </div>
      )}
      {hpStatus === "connecting" && (
        <div className="inline-flex items-center gap-2.5 text-sm font-medium text-primary">
          <Spinner />
          Verifying key…
        </div>
      )}
      {hpStatus === "error" && (
        <Notice tone="danger" title="That key was rejected.">
          {hpError || "Double check you copied the full UID and key from Hot Prospector settings, then try again."}
        </Notice>
      )}
      {hpStatus === "success" && <SuccessRow>Hot Prospector connected</SuccessRow>}
      <WizardFooter primary={primary} />
    </div>
  )
}
