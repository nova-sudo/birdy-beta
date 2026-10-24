import ReportDesigner from "@/components/report-designer/ReportDesigner"
import { StepHeading } from "../parts"

export default function ReportCopilotStep({ selectedChannel, saveReport, savingReport, reportError }) {
  return (
    <div className="w-full max-w-[1120px]">
      <div className="mb-5 text-center">
        <StepHeading small>Let&apos;s design your Slack report.</StepHeading>
        <div className="mt-1.5 text-[13.5px] text-pd-faint">
          Birdy will post it to #{selectedChannel?.name || "your channel"}. Chat it through and watch it take shape.
        </div>
      </div>
      <ReportDesigner
        sessionKey="birdy_onboarding_report"
        ignoreCreditsGate
        onUse={saveReport}
        saving={savingReport}
        secondaryAction={
          <>
            {reportError && <div className="text-center text-[12px] text-pd-danger">{reportError}</div>}
            <button
              type="button"
              onClick={() => saveReport(null)}
              disabled={savingReport}
              className="cursor-pointer border-0 bg-transparent p-1 text-center text-[12.5px] font-medium text-pd-subtle underline-offset-2 hover:text-pd-ink hover:underline disabled:opacity-40"
            >
              Skip, use the standard daily report
            </button>
          </>
        }
      />
    </div>
  )
}
