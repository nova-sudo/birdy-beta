"use client"

import { ChevronRight } from "lucide-react"

import {
  Badge,
  Button,
  Notice,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  confirm,
  toast,
} from "@/components/ds"
import { shortDay } from "@/lib/stock-agent-api"
import { usePress } from "./usePress"

/** Sources whose `source_ref` is a card: the lesson came out of what was said or done on that card. */
const CARD_SOURCES = new Set(["chat", "edit", "dismiss", "slack_mention"])

const LABEL = "text-xs font-medium text-muted-foreground"

/**
 * One lesson in full, in a side sheet: the text and where it came from, the last 5 times Birdy was given it,
 * and Keep, Overrule and Remove. Remove asks first and offers Undo, which keeps the lesson again.
 *
 * @param {object} props
 * @param {object|null} props.lesson The lesson shown; the sheet is open while there is one
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {ReturnType<import("@/lib/stock-agent-api").useStockActions>} props.actions
 * @param {(gid: string) => string} props.nameOf
 * @param {string} props.source The source wording (`sourceLabel`)
 * @param {(runId: string|null, gid: string) => void} [props.onOpenCard] Opens that client's card chat on the report
 */
export function LessonSheet({ lesson, onOpenChange, actions, nameOf, source, onOpenCard }) {
  const { busy, error, press } = usePress()
  const open = Boolean(lesson)
  const overruled = lesson?.status === "overruled"
  const uses = [...(lesson?.last_used ?? [])].reverse().slice(0, 5)
  const fromCard = lesson && CARD_SOURCES.has(lesson.source) && lesson.source_ref && lesson.client_group_id && onOpenCard

  const remove = async () => {
    const yes = await confirm({
      title: "Remove this lesson?",
      description: "Birdy stops using it from the next run.",
      confirmLabel: "Remove lesson",
    })
    if (!yes) return
    const id = lesson.id
    const done = await press("remove", async () => {
      await actions.removeLesson(id)
      return true
    })
    if (!done) return
    onOpenChange(false)
    toast("Lesson removed", { action: { label: "Undo", onClick: () => actions.keepLesson(id) } })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Lesson</SheetTitle>
          {lesson && (
            <SheetDescription>
              {[lesson.client_group_id ? nameOf(lesson.client_group_id) : "All clients", source, lesson.created_at ? shortDay(lesson.created_at) : null]
                .filter(Boolean)
                .join(" · ")}
            </SheetDescription>
          )}
        </SheetHeader>
        {lesson && (
          <SheetBody>
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold [overflow-wrap:anywhere]">{lesson.text}</p>
              <div className="flex flex-wrap items-center gap-2">
                {overruled && <Badge tone="neutral" size="sm">Overruled</Badge>}
                {lesson.kept && !overruled && <Badge tone="success" size="sm">Kept</Badge>}
                {fromCard && (
                  <Button variant="link" size="sm" onClick={() => onOpenCard(lesson.source_run_id ?? null, lesson.client_group_id)}>
                    Open the chat
                    <ChevronRight aria-hidden />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className={LABEL}>Last used</p>
              {uses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Birdy hasn&apos;t been given this one yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {uses.map((u, i) => {
                    const label = `${nameOf(u.client_group_id)} · ${shortDay(u.at)}`
                    return (
                      <li key={`${u.card_id}-${i}`} className="border-t first:border-t-0">
                        {onOpenCard ? (
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm tabular-nums hover:text-primary-ink"
                            onClick={() => onOpenCard(u.run_id, u.client_group_id)}
                          >
                            {label}
                            <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                          </button>
                        ) : (
                          <p className="py-2 text-sm tabular-nums">{label}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
          </SheetBody>
        )}
        {lesson && (
          <SheetFooter>
            <Button variant="ghost" loading={busy === "remove"} disabled={Boolean(busy)} onClick={remove}>
              Remove
            </Button>
            {!overruled && (
              <Button loading={busy === "overrule"} disabled={Boolean(busy)} onClick={() => press("overrule", () => actions.overruleLesson(lesson.id))}>
                Overrule
              </Button>
            )}
            {(overruled || !lesson.kept) && (
              <Button variant="primary" loading={busy === "keep"} disabled={Boolean(busy)} onClick={() => press("keep", () => actions.keepLesson(lesson.id))}>
                Keep
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
