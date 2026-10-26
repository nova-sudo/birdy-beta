import { STEP_COL, StepHeading, SuccessRow, WizardFooter } from "../parts"
import { CONFETTI_COLORS } from "../wizard"

export default function SyncPromptStep({ clientDisplayName, acceptSync }) {
  return (
    <>
      {/* confetti — the keyframes are switched off under prefers-reduced-motion
          in globals.css */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0"
            style={{
              left: `${(i * 41 + 7) % 100}%`,
              width: 6 + (i % 3) * 3,
              height: 6 + (i % 3) * 3,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              borderRadius: i % 2 ? 2 : "50%",
              animation: `ob-confetti ${(1.6 + (i % 5) * 0.25).toFixed(2)}s ease-in ${((i % 7) * 0.09).toFixed(2)}s 1 both`,
            }}
          />
        ))}
      </div>
      <div className={STEP_COL}>
        <SuccessRow>{clientDisplayName} connected</SuccessRow>
        <StepHeading
          description="Whilst we finish onboarding, Birdy can add the rest of your clients for you in the background."
        >
          Congratulations! You connected your first client.
        </StepHeading>
        <WizardFooter primary={{ label: "Continue onboarding", onClick: acceptSync }} />
      </div>
    </>
  )
}
