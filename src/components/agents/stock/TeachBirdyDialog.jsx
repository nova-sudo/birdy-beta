"use client"

import { useCallback, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { Check, Sparkles } from "lucide-react"

import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import ChatConversation from "@/components/chat/ChatConversation"
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ds"
import { queryKeys } from "@/lib/query-keys"

export const LESSONS_PAGE = "stock_lessons"

/**
 * What a Teach Birdy tool changed (`agent_changes[].changed`), and the chip it leaves under Birdy's reply.
 * Keyed on `changed`, not the tool name: the BE's add tool is `save_lesson`, and only an ok result carries it.
 */
const LESSON_CHANGES = {
  lesson: "Lesson saved",
  lesson_edited: "Lesson changed",
  lesson_removed: "Lesson removed",
}

const lessonChanges = (message) => (message?.agent_changes ?? []).map((c) => c?.changed).filter((c) => LESSON_CHANGES[c])

/** The chips under one of Birdy's replies: what its tools changed. */
export function lessonChips(message) {
  return lessonChanges(message).map((c) => LESSON_CHANGES[c])
}

/**
 * Teach Birdy: a button that opens the `stock_lessons` chat in a dialog. Birdy restates what you tell it as a
 * lesson and can add, change or remove lessons. After any change the Lessons list re-reads.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {(changed: string) => void} [props.onChanged] Called after a reply whose tools changed a lesson
 * @param {"primary"|"outline"|"ghost"} [props.variant]
 */
export function TeachBirdyDialog({ agentId, onChanged, variant = "outline" }) {
  const [open, setOpen] = useState(false)
  const { mutate } = useSWRConfig()

  // A reply whose tools changed a lesson re-reads the Lessons list. Messages already there when the chat opened don't count.
  const seen = useRef(null)
  const onMessagesChange = useCallback(
    (messages) => {
      const from = seen.current ?? messages.length
      seen.current = messages.length
      const changes = messages.slice(from).filter((m) => m.role !== "user").flatMap(lessonChanges)
      if (!changes.length) return
      mutate(queryKeys.stockLessons(agentId))
      changes.forEach((c) => onChanged?.(c))
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
              onMessagesChange={onMessagesChange}
              renderAfterMessage={renderAfterMessage}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
