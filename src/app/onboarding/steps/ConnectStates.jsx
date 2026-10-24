import { AlertCircle, ExternalLink, RotateCcw } from "lucide-react"
import { PrimaryButton, SpinnerRing, SuccessRow } from "../parts"

/**
 * The connect / checking / connecting / error / success states shared by the OAuth
 * steps. `oauthError`, when set, is what the server said and replaces `errorBody`.
 */
export default function ConnectStates({
  status,
  onConnect,
  onRetry,
  onContinue,
  connectLabel,
  connectingLabel,
  successLabel,
  errorTitle,
  errorBody,
  connectDisabled,
  oauthError,
}) {
  return (
    <>
      {/* Boot hasn't finished asking whether this is already connected. Show
          the wait rather than a Connect button we may be about to replace —
          the button was live and pressable for the whole round-trip, so
          returning from an OAuth hop invited a second, pointless one. */}
      {status === "checking" && (
        <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-faint">
          <SpinnerRing />
          Checking connection…
        </div>
      )}
      {status === "idle" && (
        <PrimaryButton onClick={onConnect} disabled={connectDisabled} arrow={false}>
          {connectLabel}
          <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2.4} />
        </PrimaryButton>
      )}
      {status === "connecting" && (
        <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-primary">
          <SpinnerRing />
          {connectingLabel}
        </div>
      )}
      {status === "error" && (
        <>
          <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-[18px] py-4 text-left">
            <div className="mb-[6px] flex items-center gap-2">
              <AlertCircle className="h-[15px] w-[15px] text-pd-danger" strokeWidth={2.2} />
              <span className="font-pd-display text-[13.5px] font-semibold text-pd-danger">{errorTitle}</span>
            </div>
            <div className="text-[12.5px] leading-normal text-pd-body">{oauthError || errorBody}</div>
          </div>
          <PrimaryButton onClick={onRetry || onConnect} arrow={false}>
            Try again
            <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
          </PrimaryButton>
        </>
      )}
      {status === "success" && (
        <>
          <SuccessRow>{successLabel}</SuccessRow>
          <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
        </>
      )}
    </>
  )
}
