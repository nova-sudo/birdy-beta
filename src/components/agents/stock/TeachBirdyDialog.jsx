"use client"

import { useCallback, useState } from "react"
import { useSWRConfig } from "swr"
import { Check, Sparkles } from "lucide-react"

import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import ChatConversation from "@/components/chat/ChatConversation"
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ds"
import { queryKeys } from "@/lib/query-keys"

export const LESSONS_PAGE = "stock_lessons"

/** The Teach Birdy tools that change a lesson, and the chip each one leaves under Birdy's reply. */
const LESSON_CHANGES = {
  add_lesson: "Lesson saved",
  edit_lesson: "Lesson changed",
  remove_lesson: "Lesson removed",
}

/** The chips under one of Birdy's replies: what its tools changed. */
export function lessonChips(message) {
  return (message?.agent_changes ?? []).map((c) => LESSON_CHANGES[c?.tool]).filter(Boolean)
}

/**
 * Teach Birdy: a button that opens the `stock_lessons` chat in a dialog. Birdy restates what you tell it as a
 * lesson and can add, change or remove lessons. After any change the Lessons list re-reads.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {() => void} [props.onChanged] Called after a reply whose tools changed a lesson
 * @param {"primary"|"outline"|"ghost"} [props.variant]
 */
export function TeachBirdyDialog({ agentId, onChanged, variant = "outline" }) {
  const [open, setOpen] = useState(false)
  const { mutate } = useSWRConfig()

  const onToolUsed = useCallback(
    (tool) => {
      if (!LESSON_CHANGES[tool]) return
      mutate(queryKeys.stockLessons(agentId))
      onChanged?.(tool)
    },
    [agentId, mutate, onChanged]
  )

  const renderAfterMessage = useCallback((message) => {
    const chips = lessonChips(message)
    if (!chips.length) return null
    return (
      <div className="flex flex-wrap gap-1.5 pl-9">
        {chips.map((line, i) => (
          <Badge key={i} size="sm" tone="primary" icon={Check}>
            {line}
          </Badge>
        ))}
      </div>
    )
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          <Sparkles aria-hidden />
          Teach Birdy
        </Button>
      </DialogTrigger>
      <DialogContent size="lg" className="h-[min(85vh,720px)]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <BirdyAvatar size={32} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle>Teach Birdy</DialogTitle>
              <DialogDescription>Say it the way you&apos;d tell your team. Birdy follows it from the next run.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="gap-0 overflow-hidden p-0">
          {open && (
            <ChatConversation
              page={LESSONS_PAGE}
              agentId={agentId}
              sessionKey={`${LESSONS_PAGE}:${agentId}`}
              showScopePicker={false}
              showSlowNotice={false}
              composerCompact
              bubbleWidthClass="max-w-[85%]"
              composerPlaceholder="Tell Birdy what to do differently…"
              emptyStateTitle="What should Birdy do differently?"
              emptyStateSubtitle="Like “Don't remove ads during a client's launch week”. You can also change or remove a lesson here."
              showQuickActions={false}
              onToolUsed={onToolUsed}
              renderAfterMessage={renderAfterMessage}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
