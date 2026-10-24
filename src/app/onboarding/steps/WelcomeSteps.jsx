import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Pop, Stagger, StaggerItem } from "@/components/motion"
import { PrimaryButton, STEP_COL, StepHeading, UnderlineInput } from "../parts"

export function WelcomeStep({ next, birdyState }) {
  return (
    <Stagger className={STEP_COL} gap={0.06}>
      <Pop delay={0.1} className="mx-auto mb-[26px] w-fit">
        <BirdyAvatar size={80} tone="white" state={birdyState} />
      </Pop>
      <StaggerItem className="mb-3"><StepHeading>Welcome to Birdy!</StepHeading></StaggerItem>
      <StaggerItem className="mb-[30px] text-[15px] leading-relaxed text-pd-body">
        We&apos;ll get you set up with your first client in under 10 minutes.
      </StaggerItem>
      <StaggerItem>
        <PrimaryButton onClick={() => next()}>Get started</PrimaryButton>
      </StaggerItem>
    </Stagger>
  )
}

export function WelcomeNameStep({ name, setName, next }) {
  return (
    <Stagger className={STEP_COL} gap={0.06}>
      <StaggerItem className="mb-3"><StepHeading>What should we call you?</StepHeading></StaggerItem>
      <StaggerItem>
        <UnderlineInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoFocus
        />
      </StaggerItem>
      <StaggerItem>
        <PrimaryButton disabled={!name.trim()} onClick={() => next({ name: name.trim() })}>
          Continue
        </PrimaryButton>
      </StaggerItem>
    </Stagger>
  )
}

export function AgencyStep({ name, agency, setAgency, next }) {
  return (
    <Stagger className={STEP_COL} gap={0.06}>
      <StaggerItem className="mb-2"><StepHeading>What&apos;s your agency called?</StepHeading></StaggerItem>
      <StaggerItem className="mb-[26px] text-[14px] text-pd-faint">
        This is how it&apos;ll show up across Birdy, {name || "friend"}.
      </StaggerItem>
      <StaggerItem>
        <UnderlineInput
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Agency name"
        />
      </StaggerItem>
      <StaggerItem>
        <PrimaryButton disabled={!agency.trim()} onClick={() => next({ agency: agency.trim() })}>
          Continue
        </PrimaryButton>
      </StaggerItem>
    </Stagger>
  )
}
