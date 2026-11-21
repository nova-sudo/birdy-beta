"use client"

import { useState } from "react"

import { Button, Frame } from "@/components/ds"
import { playbookRules, ruleSentence } from "@/lib/rule-copy"

export { ruleSentence, playbookRules } from "@/lib/rule-copy"

/**
 * The playbook Birdy drafted, as a numbered list, with "Yes, that's it" / "Change something".
 * The answer goes back to Birdy as a message; Birdy confirms it with confirm_playbook.
 */
export function PlaybookBlock({ entry, currency = "$", active, onSend }) {
  const rules = playbookRules(entry?.playbook)
  const [answered, setAnswered] = useState(false)
  const answer = async (text) => {
    setAnswered(true)
    if ((await onSend(text)) === false) setAnswered(false)
  }

  return (
    <div data-slot="setup-playbook" className="flex flex-col gap-3">
      <Frame title={`Its playbook · ${rules.length} ${rules.length === 1 ? "rule" : "rules"}`} titleAs="h3" padded>
        {rules.length ? (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-foreground marker:text-muted-foreground">
            {rules.map((r, i) => (
              <li key={`${r.kind}-${i}`}>{ruleSentence(r, currency)}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No rules switched on yet.</p>
        )}
      </Frame>
      {active && !answered && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => answer("Yes, that's it")}>
            Yes, that&apos;s it
          </Button>
          <Button size="sm" onClick={() => answer("Change something")}>
            Change something
          </Button>
        </div>
      )}
    </div>
  )
}
