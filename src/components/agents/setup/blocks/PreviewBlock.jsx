"use client"

import { DryRunSummary } from "@/components/agents/DryRunSummary"

/**
 * The first report preview: the 30-day dry run over real data. run_preview already started the job;
 * DryRunSummary rejoins it (the server reuses a job for identical rules), polls, then shows the totals.
 */
export function PreviewBlock({ agentId, currency = "$", onResult }) {
  return (
    <div data-slot="setup-preview">
      <DryRunSummary agentId={agentId} currency={currency} onResult={onResult} />
    </div>
  )
}
