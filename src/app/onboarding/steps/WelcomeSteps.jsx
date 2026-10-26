import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button } from "@/components/ds"
import { Pop, Stagger, StaggerItem } from "@/components/motion"
import { STEP_COL, StepHeading, StepInput, WizardFooter } from "../parts"

export function WelcomeStep({ next, birdyState }) {
  return (
    <Stagger className={`${STEP_COL} text-center`} gap={0.06}>
      <Pop delay={0.1} className="mx-auto mb-6 w-fit">
        <BirdyAvatar size={80} tone="white" state={birdyState} />
      </Pop>
      <StaggerItem>
        <StepHeading description="We'll get you set up with your first client in under 10 minutes.">
          Welcome to Birdy!
        </StepHeading>
      </StaggerItem>
      <StaggerItem>
        <Button variant="primary" size="lg" onClick={() => next()}>Get started</Button>
      </StaggerItem>
    </Stagger>
  )
}

export function WelcomeNameStep({ name, setName, next }) {
  return (
    <Stagger className={STEP_COL} gap={0.06}>
      <StaggerItem><StepHeading>What should we call you?</StepHeading></StaggerItem>
      <StaggerItem>
        <StepInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoFocus
        />
      </StaggerItem>
      <WizardFooter primary={{ label: "Continue", disabled: !name.trim(), onClick: () => next({ name: name.trim() }) }} />
    </Stagger>
  )
}

export function AgencyStep({ name, agency, setAgency, next }) {
  return (
    <Stagger className={STEP_COL} gap={0.06}>
      <StaggerItem>
        <StepHeading description={<>This is how it&apos;ll show up across Birdy, {name || "friend"}.</>}>
          What&apos;s your agency called?
        </StepHeading>
      </StaggerItem>
      <StaggerItem>
        <StepInput
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Agency name"
        />
      </StaggerItem>
      <WizardFooter primary={{ label: "Continue", disabled: !agency.trim(), onClick: () => next({ agency: agency.trim() }) }} />
    </Stagger>
  )
}
