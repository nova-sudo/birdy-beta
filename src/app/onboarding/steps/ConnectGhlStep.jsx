import { Home } from "lucide-react"
import { IconChip, STEP_COL, StepHeading } from "../parts"
import ConnectStates from "./ConnectStates"

export default function ConnectGhlStep({ name, ghlStatus, setGhlStatus, startOAuth, oauthError, next }) {
  return (
    <div className={STEP_COL}>
      <IconChip className="bg-pd-primary-tint text-pd-primary"><Home className="h-[26px] w-[26px]" strokeWidth={2} /></IconChip>
      <div className="mb-[10px]">
        <StepHeading>Great{name ? `, ${name}` : ""} — let&apos;s get you connected to GHL.</StepHeading>
      </div>
      <div className="mb-7 text-[14px] leading-relaxed text-pd-body">
        Birdy will read your sub-accounts, contacts, and opportunity pipelines so it can
        track leads and conversions. We never modify your GHL data.
      </div>
      <ConnectStates
        status={ghlStatus}
        onConnect={() => startOAuth("/api/connect", setGhlStatus)}
        connectLabel="Connect GHL"
        connectingLabel="Connecting to GHL…"
        successLabel="GHL connected"
        errorTitle="Connection failed"
        errorBody="GHL didn't authorize the request — this usually means the popup was closed early. Let's try again."
        onContinue={() => next()}
        oauthError={oauthError}
      />
    </div>
  )
}
