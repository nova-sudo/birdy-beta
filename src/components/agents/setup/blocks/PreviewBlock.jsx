"use client"

import { DryRunSummary } from "@/components/agents/DryRunSummary"

/**
 * The first report preview: the 30-day dry run over real data. run_preview already ran the job inside the
 * chat turn and returned its `job_id`, so DryRunSummary polls that job rather than starting a second replay.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {{job_id?: string}} [props.entry] The run_preview block from agent_changes
 * @param {string} [props.currency]
 * @param {(result: object) => void} [props.onResult]
 */
export function PreviewBlock({ agentId, entry = null, currency = "$", onResult }) {
  return (
    <div data-slot="setup-preview">
      <DryRunSummary agentId={agentId} jobId={entry?.job_id ?? null} currency={currency} onResult={onResult} />
    </div>
  )
}
