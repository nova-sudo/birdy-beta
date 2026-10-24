import { FacebookGlyph, IconChip, STEP_COL, StepHeading } from "../parts"
import ConnectStates from "./ConnectStates"

export default function ConnectMetaStep({ metaStatus, setMetaStatus, startOAuth, oauthError, next }) {
  return (
    <div className={STEP_COL}>
      <IconChip className="bg-pd-info-bg text-pd-info"><FacebookGlyph /></IconChip>
      <div className="mb-[10px]"><StepHeading>Next up, let&apos;s connect Meta.</StepHeading></div>
      <div className="mb-7 text-[14px] leading-relaxed text-pd-body">
        Birdy reads ad spend, impressions and results from your ad accounts so it can
        calculate cost-per-lead and flag underperforming ads. We can&apos;t post or spend
        on your behalf.
      </div>
      <ConnectStates
        status={metaStatus}
        onConnect={() => startOAuth("/api/connect/facebook", setMetaStatus)}
        connectLabel="Connect Meta"
        connectingLabel="Connecting to Meta…"
        successLabel="Meta connected"
        errorTitle="Connection failed"
        errorBody="Meta didn't authorize the request — this usually means the popup was closed early. Let's try again."
        onContinue={() => next()}
        oauthError={oauthError}
      />
    </div>
  )
}
