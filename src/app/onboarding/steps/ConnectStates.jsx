import { ExternalLink, RotateCcw } from "lucide-react"
import { Button, Notice, Spinner } from "@/components/ds"
import { SuccessRow, WizardFooter } from "../parts"

/**
 * The connect / checking / connecting / error / success states shared by the OAuth
 * steps. `oauthError`, when set, is what the server said and replaces `errorBody`.
 * The Connect button stays in the body (it leaves the page); once connected the
 * Continue goes to the wizard footer.
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
        <div className="inline-flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
          <Spinner />
          Checking connection…
        </div>
      )}
      {status === "idle" && (
        <Button variant="primary" size="lg" onClick={onConnect} disabled={connectDisabled}>
          {connectLabel}
          <ExternalLink aria-hidden="true" />
        </Button>
      )}
      {status === "connecting" && (
        <div className="inline-flex items-center gap-2.5 text-sm font-medium text-primary">
          <Spinner />
          {connectingLabel}
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <Notice tone="danger" title={errorTitle} className="w-full">
            {oauthError || errorBody}
          </Notice>
          <Button variant="primary" size="lg" onClick={onRetry || onConnect}>
            Try again
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      )}
      {status === "success" && (
        <>
          <SuccessRow>{successLabel}</SuccessRow>
          <WizardFooter primary={{ label: "Continue", onClick: onContinue }} />
        </>
      )}
    </>
  )
}
