import { useState } from "react"
import { Button, Notice } from "@/components/ds"
import ReportDesigner from "@/components/report-designer/ReportDesigner"
import { STEP_COL_FULL, StepHeading, WizardFooter } from "../parts"

export default function ReportCopilotStep({ selectedChannel, saveReport, savingReport, reportError }) {
  // The designer owns the preview; the footer needs its template to know
  // whether "Use this report" has anything to save.
  const [template, setTemplate] = useState(null)

  return (
    <div className={STEP_COL_FULL}>
      <StepHeading
        eyebrow="Notifications"
        description={`Birdy will post it to #${selectedChannel?.name || "your channel"}. Chat it through and watch it take shape.`}
      >
        Let&apos;s design your Slack report
      </StepHeading>
      {reportError && <Notice tone="danger" className="mb-4">{reportError}</Notice>}
      <ReportDesigner
        sessionKey="birdy_onboarding_report"
        ignoreCreditsGate
        hideActions
        onTemplateChange={setTemplate}
      />
      <WizardFooter
        primary={{
          label: savingReport ? "Saving…" : "Use this report",
          onClick: () => saveReport(template),
          disabled: savingReport || !template,
        }}
        secondary={
          <Button variant="ghost" size="lg" onClick={() => saveReport(null)} disabled={savingReport}>
            Skip, use the standard daily report
          </Button>
        }
      />
    </div>
  )
}
