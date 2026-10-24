"use client"

// The Slack report copilot: Birdy interviews the user on the left and keeps a
// live preview of the report on the right, filled with their real numbers.
//
// Used by the onboarding wizard (report_copilot step) and by Settings
// ("Redesign with Birdy"). The conversation runs on /api/chat with
// page="report_designer"; every change Birdy makes goes through its
// propose_report tool, which stores a validated draft server-side — so the
// preview here is re-fetched whenever that tool runs, never parsed out of the
// chat text. Nothing is saved as the live report until the user presses the
// primary button; the caller decides what that does.

import { useCallback, useEffect, useRef, useState } from "react"
import { CalendarClock, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import ChatConversation from "@/components/chat/ChatConversation"
import { Button, ErrorState } from "@/components/ds"
import { getChat, resetChat } from "@/lib/chat-store"
import { REPORT_OPENER, REPORT_PAGE, reportApi, scheduleLabel } from "@/lib/report-designer"
import SlackMessagePreview from "./SlackMessagePreview"

/** Index of the first block that differs between two block lists, or -1. */
export function firstChange(before, after) {
  const n = Math.max(before.length, after.length)
  for (let i = 0; i < n; i++) {
    if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) return Math.min(i, Math.max(0, after.length - 1))
  }
  return -1
}

export default function ReportDesigner({
  sessionKey = "birdy_report_designer",
  onUse,
  saving = false,
  primaryLabel = "Use this report",
  secondaryAction = null,     // optional node under the primary button (e.g. "Skip for now")
  heightClass = "lg:h-[min(640px,calc(100dvh-230px))]",
  // Onboarding runs before billing and the server lets this page through
  // while onboarding is incomplete; everywhere else the usual gate applies.
  ignoreCreditsGate = false,
}) {
  const [ready, setReady] = useState(false)
  const [chatGen, setChatGen] = useState(0)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState(false)
  const latest = useRef(0)
  const shownBlocks = useRef(null) // the template blocks currently on screen, to find what changed
  const [focus, setFocus] = useState(null)

  const refreshPreview = useCallback(async () => {
    const ticket = ++latest.current
    setPreviewLoading(true)
    try {
      const data = await reportApi.preview()
      if (ticket === latest.current) {
        const before = shownBlocks.current
        const after = data?.template?.blocks || []
        if (before) {
          const changed = firstChange(before, after)
          if (changed !== -1) setFocus({ index: changed, count: Math.max(1, after.length - before.length + 1), key: Date.now() })
        }
        shownBlocks.current = after
        setPreview(data)
        setPreviewError(false)
      }
    } catch {
      if (ticket === latest.current) setPreviewError(true)
    } finally {
      if (ticket === latest.current) setPreviewLoading(false)
    }
  }, [])

  // A brand-new conversation starts from the saved report (or the default);
  // a resumed one (refresh, OAuth hop) keeps the draft it already built.
  useEffect(() => {
    let cancelled = false
    const resumed =
      (typeof window !== "undefined" && sessionStorage.getItem(sessionKey)) ||
      getChat(sessionKey).messages.length > 0
    ;(async () => {
      if (!resumed) {
        try { await reportApi.seedDraft() } catch { /* preview falls back to the default */ }
      }
      if (cancelled) return
      setReady(true)
      refreshPreview()
    })()
    return () => { cancelled = true }
  }, [sessionKey, refreshPreview])

  const onToolUsed = useCallback((tool) => {
    if (tool === "propose_report") refreshPreview()
  }, [refreshPreview])

  const startOver = useCallback(async () => {
    resetChat(sessionKey)
    if (typeof window !== "undefined") sessionStorage.removeItem(sessionKey)
    setReady(false)
    try { await reportApi.seedDraft() } catch { /* ignore */ }
    setChatGen((g) => g + 1)
    setReady(true)
    refreshPreview()
  }, [sessionKey, refreshPreview])

  const use = useCallback(() => {
    if (!preview?.template) return
    onUse?.(preview.template)
  }, [preview, onUse])

  const template = preview?.template

  return (
    <div className={`grid w-full grid-cols-1 gap-5 text-left lg:grid-cols-[minmax(0,1fr)_400px] ${heightClass}`}>
      {/* Conversation */}
      <div className="flex h-[480px] min-h-0 flex-col overflow-hidden rounded-frame border border-border bg-background lg:h-full">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <div className="text-base font-semibold text-foreground">Design your report with Birdy</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Answer a few questions, or just say what you want.</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={startOver} className="shrink-0 text-muted-foreground">
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Start over
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {ready && (
            <ChatConversation
              key={chatGen}
              sessionKey={sessionKey}
              page={REPORT_PAGE}
              initialMessage={REPORT_OPENER}
              hideInitialMessage
              showScopePicker={false}
              ignoreCreditsGate={ignoreCreditsGate}
              showSlowNotice={false}
              onToolUsed={onToolUsed}
              composerCompact
              showQuickActions={false}
              bubbleWidthClass="max-w-[92%]"
              composerPlaceholder="e.g. Just spend and leads per client, every Monday at 8"
              emptyStateTitle="Let's design your report"
              emptyStateSubtitle="Birdy is getting your clients and metrics ready…"
            />
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold tracking-[0.05em] text-muted-foreground">LIVE PREVIEW</span>
          {template && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {scheduleLabel(template)}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SlackMessagePreview blocks={preview?.blocks} time={template?.time} loading={previewLoading && !!preview} focus={focus} />
          {preview?.sample && (
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              Sample numbers for now. Your real figures appear here once your first client finishes syncing.
            </p>
          )}
          {previewError && (
            <ErrorState
              className="mt-2.5"
              title="Couldn't refresh the preview."
              description="The report is as it was at the last refresh."
              onRetry={refreshPreview}
            />
          )}
        </div>
        <div className="mt-4 flex flex-col items-stretch gap-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => {
              if (!template) {
                toast.error("The preview hasn't loaded yet")
                return
              }
              use()
            }}
            disabled={saving || !template}
          >
            {saving ? "Saving…" : primaryLabel}
          </Button>
          {secondaryAction}
        </div>
      </div>
    </div>
  )
}
