"use client"

import { Surface } from "@/components/ds"
import { PracticeCase, followUpMessage } from "@/components/agents/PracticeCase"

/**
 * One real past case from ask_practice_case. Answers and resolutions use the practice routes,
 * so the confidence maths is unchanged; each outcome goes back to Birdy so it asks the next one.
 */
export function PracticeBlock({ agentId, entry, onSend, onAnswered }) {
  const practiceCase = entry?.case
  if (!practiceCase?.case_id) return null
  return (
    <Surface padded={false} data-slot="setup-practice">
      <PracticeCase
        agentId={agentId}
        case={practiceCase}
        onAnswered={(res) => {
          onAnswered?.()
          if (res?.agreed) onSend(`Practice case ${practiceCase.case_id}: we agreed. Next one.`)
        }}
        onResolved={(which) => {
          onAnswered?.()
          if (which === "birdy_right") onSend(`Practice case ${practiceCase.case_id}: you were right. Next one.`)
        }}
        onAskFollowUp={(c, answer) => onSend(followUpMessage(c, answer))}
      />
    </Surface>
  )
}
