import { Home } from "lucide-react"
import { IconChip, STEP_COL, StepHeading } from "../parts"
import ConnectStates from "./ConnectStates"

export default function ConnectGhlStep({ name, ghlStatus, setGhlStatus, startOAuth, oauthError, next }) {
  return (
    <div className={STEP_COL}>
      <IconChip tone="primary"><Home className="size-6" strokeWidth={2} /></IconChip>
      <StepHeading
        description="Birdy will read your sub-accounts, contacts, and opportunity pipelines so it can track leads and conversions. We never modify your GHL data."
      >
        Great{name ? `, ${name}` : ""} — let&apos;s get you connected to GHL.
      </StepHeading>
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
