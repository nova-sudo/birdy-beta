import { RotateCcw } from "lucide-react"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button, Notice } from "@/components/ds"
import { Pop, Stagger, StaggerItem } from "@/components/motion"
import { FakeProgressBar, STEP_COL, StepHeading } from "../parts"

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
    <Stagger className={`${STEP_COL} text-center`} gap={0.06}>
      <Pop delay={0.1} className="mx-auto mb-6 w-fit">
        <BirdyAvatar size={136} tone="white" state={birdyState} />
      </Pop>
      <StaggerItem>
        <StepHeading
          description={`Here's everything Birdy just connected${agency ? ` for ${agency}` : ""}. We'll keep importing the rest in the background.`}
        >
          You&apos;re all set{name ? `, ${name}` : ""}.
        </StepHeading>
      </StaggerItem>

      {/* Last chance to notice that the background creation failed.
          Everything after client_currency ran without needing the
          group, so this is the first point where "you have no first
          client" actually costs the user something — they'd land on an
          empty Clients page with no idea why. Offered as a retry, not
          a wall: if GHL is down, trapping them in the wizard helps
          nobody, so they can still go in without it. */}
      {creationState === "error" && (
        <Notice tone="danger" title={`${clientDisplayName} wasn't added`} className="mb-5 flex-col items-stretch text-left">
          <div className="mb-3">
            {creationError || "Something went wrong setting up your first client."}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => startFirstClientCreation()}>
              Try again
              <RotateCcw aria-hidden="true" />
            </Button>
            <Button onClick={finish}>Continue without it</Button>
          </div>
        </Notice>
      )}

      {creationState === "creating" && (
        <div className="mb-5">
          <FakeProgressBar expectedMs={18000} caption={`Still adding ${clientDisplayName} — you can go on in.`} />
        </div>
      )}

      {creationState !== "error" && (
        <StaggerItem>
          <Button variant="primary" size="lg" onClick={finish} disabled={completing}>
            {completing ? "Opening Birdy…" : "Take a look at Birdy"}
          </Button>
        </StaggerItem>
      )}
    </Stagger>
  )
}
