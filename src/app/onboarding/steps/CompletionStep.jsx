import { AlertCircle, RotateCcw } from "lucide-react"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Pop, Stagger, StaggerItem } from "@/components/motion"
import {
  FakeProgressBar,
  PrimaryButton,
  SecondaryButton,
  STEP_COL,
  StepHeading,
} from "../parts"

export default function CompletionStep({
  name,
  agency,
  birdyState,
  clientDisplayName,
  creationState,
  creationError,
  startFirstClientCreation,
  finish,
  completing,
}) {
  return (
    <Stagger className={STEP_COL} gap={0.06}>
      <Pop delay={0.1} className="mx-auto mb-[22px] w-fit">
        <BirdyAvatar size={136} tone="white" state={birdyState} />
      </Pop>
      <StaggerItem className="mb-2"><StepHeading>You&apos;re all set{name ? `, ${name}` : ""}.</StepHeading></StaggerItem>
      <StaggerItem className="mb-[26px] text-[14px] text-pd-faint">
        Here&apos;s everything Birdy just connected{agency ? ` for ${agency}` : ""}. We&apos;ll
        keep importing the rest in the background.
      </StaggerItem>

      {/* Last chance to notice that the background creation failed.
          Everything after client_currency ran without needing the
          group, so this is the first point where "you have no first
          client" actually costs the user something — they'd land on an
          empty Clients page with no idea why. Offered as a retry, not
          a wall: if GHL is down, trapping them in the wizard helps
          nobody, so they can still go in without it. */}
      {creationState === "error" && (
        <div className="mb-5 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-[18px] py-4 text-left">
          <div className="mb-[6px] flex items-center gap-2">
            <AlertCircle className="h-[15px] w-[15px] text-pd-danger" strokeWidth={2.2} />
            <span className="font-pd-display text-[13.5px] font-semibold text-pd-danger">
              {clientDisplayName} wasn&apos;t added
            </span>
          </div>
          <div className="mb-[14px] text-[12.5px] leading-normal text-pd-body">
            {creationError || "Something went wrong setting up your first client."}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => startFirstClientCreation()} arrow={false}>
              Try again
              <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
            </PrimaryButton>
            <SecondaryButton onClick={finish}>Continue without it</SecondaryButton>
          </div>
        </div>
      )}

      {creationState === "creating" && (
        <div className="mb-5">
          <FakeProgressBar expectedMs={18000} caption={`Still adding ${clientDisplayName} — you can go on in.`} />
        </div>
      )}

      {creationState !== "error" && (
        <StaggerItem>
          <PrimaryButton onClick={finish} disabled={completing}>
            {completing ? "Opening Birdy…" : "Take a look at Birdy"}
          </PrimaryButton>
        </StaggerItem>
      )}
    </Stagger>
  )
}
