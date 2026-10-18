"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Check, Eye, Loader2, Pencil, Redo2, RotateCw, Undo2 } from "lucide-react"
import { summarize } from "dashkit/core"
import {
  Canvas,
  ComponentsProvider,
  DashboardDataProvider,
  DashboardRenderer,
  EditorProvider,
  JsonView,
  Palette,
  PropertyPanel,
  Toolbar,
  useDashboardEditor,
} from "dashkit/react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/saleshub/SalesHubShell"
import { PdCard } from "@/components/portfolio/PdCard"
import { PdSegmented } from "@/components/portfolio/PdSegmented"
import { Skeleton } from "@/components/ui/skeleton"
import ChatConversation from "@/components/chat/ChatConversation"
import { pdFontClass } from "@/lib/pd-fonts"
import { registry, components } from "@/lib/dashkit/registry"
import { dataSource } from "@/lib/dashkit/data-source"
import { applyIncomingOps } from "@/lib/dashboard-ops"
import { useDashboardCatalog, useDashboardDoc } from "./useDashboardDoc"

// ─── One dashboard ──────────────────────────────────────────────────────────
// The composition root for /dashboards/<id>: the dashboard (read-only view or
// dashkit's editor) on the left, Ask Birdy on the right.
//
// The page composes dashkit's editor itself, around ONE useDashboardEditor
// shared by both modes: the edit mode renders the editor's toolbar, palette,
// canvas and property panel over it, the view mode renders the same doc
// read-only. So every change (the user's, and the ops Birdy sends back in
// either mode) goes through the one undo history, and switching modes keeps
// it. The editor needs the catalog for its pickers and validation, so the
// workspace waits for both the doc and the catalog before it mounts.

const MODES = [
  { key: "view", label: "View", icon: Eye },
  { key: "edit", label: "Edit", icon: Pencil },
]

export default function DashboardWorkspace({ id }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { doc, isLoading, error, save } = useDashboardDoc(id)
  const { catalog, error: catalogError } = useDashboardCatalog()

  // The brief typed in the list page's New dialog arrives as ?brief=. Read it
  // once and clean the URL, so a reload doesn't send it to Birdy again.
  const [brief] = useState(() => searchParams.get("brief") || null)
  const briefConsumed = useRef(false)
  useEffect(() => {
    if (!brief || briefConsumed.current) return
    briefConsumed.current = true
    router.replace(`/dashboards/${id}`)
  }, [brief, id, router])

  const ready = Boolean(doc && catalog)
  const failed = !ready && Boolean((error && !doc) || (catalogError && !catalog))

  // Until the workspace mounts (and publishes its own), hold the bar with the
  // section name so the header doesn't flash back to the wordmark.
  const loadingHeader = useMemo(
    () => ({ title: <SalesHubHeaderTitle title={isLoading ? "" : "Dashboard"} subtitle="My dashboards" /> }),
    [isLoading],
  )
  usePageHeader(ready ? null : loadingHeader)

  if (ready) return <LoadedWorkspace id={id} initialDoc={doc} catalog={catalog} save={save} brief={brief} />

  return (
    <WorkspaceLayout
      board={
        failed ? (
          <div className="px-6 py-[22px]">
            <PdCard>
              <p className="text-[13px] text-pd-muted">
                Couldn&apos;t load this dashboard.{" "}
                <Link href="/dashboards" className="font-semibold text-pd-primary underline-offset-2 hover:underline">
                  Back to My dashboards
                </Link>
              </p>
            </PdCard>
          </div>
        ) : (
          <BoardSkeleton />
        )
      }
      chat={
        failed ? (
          <p className="p-5 text-[13px] text-pd-muted">Birdy can help once this dashboard loads.</p>
        ) : (
          <div className="space-y-3 p-5" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )
      }
    />
  )
}

/** The workspace once the saved doc and the catalog are both here. */
function LoadedWorkspace({ id, initialDoc, catalog, save, brief }) {
  const [mode, setMode] = useState("view")
  const [view, setView] = useState("canvas") // the editor's canvas / JSON toggle
  const [saveState, setSaveState] = useState("idle") // idle | saving | saved | error

  // The live doc, as state (to render the title) and as a ref (for the unmount
  // save, which runs when the editor's state is already being torn down).
  // onChange keeps both in step with the editor after every op, undo and redo.
  const [liveDoc, setLiveDoc] = useState(initialDoc)
  const liveDocRef = useRef(initialDoc)
  const lastSavedRef = useRef(initialDoc)
  const updateLiveDoc = useCallback((next) => {
    liveDocRef.current = next
    setLiveDoc(next)
  }, [])

  const editor = useDashboardEditor(liveDoc, { registry, catalog, onChange: updateLiveDoc })
  // Stable for the editor's lifetime (they close over its history).
  const { getDoc, applyAll: editorApplyAll, undo, redo, markSaved, canUndo, canRedo } = editor

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Saves run one after another, so an older PUT can never land after a newer
  // one and overwrite it. `queuedRef` is the newest doc sent and not yet
  // failed, so the unmount save doesn't PUT the same doc twice.
  const saveQueue = useRef(Promise.resolve())
  const inFlight = useRef(0)
  const queuedRef = useRef(null)
  const retryRef = useRef(() => {})
  const persist = useCallback(
    (next, { fromToolbar = false } = {}) => {
      inFlight.current += 1
      queuedRef.current = next
      if (mountedRef.current) setSaveState("saving")
      const run = saveQueue.current.then(() => save(next))
      saveQueue.current = run.catch(() => {})
      return run.then(
        (saved) => {
          inFlight.current -= 1
          lastSavedRef.current = next
          // Edits made while this was in flight were not sent: leave them dirty.
          if (getDoc() === next) markSaved()
          if (mountedRef.current && inFlight.current === 0) setSaveState("saved")
          return saved
        },
        (err) => {
          inFlight.current -= 1
          if (queuedRef.current === next) queuedRef.current = null
          if (mountedRef.current) setSaveState("error")
          // The dashkit toolbar shows its own inline "Save failed"; a toast on
          // top would say it twice. Every other save (Birdy's ops, leaving
          // edit mode, an undo in view mode) has no other voice, so it gets
          // one with a way out.
          if (!fromToolbar) {
            toast.error("Couldn't save this dashboard", {
              description: "Your changes are still here.",
              action: mountedRef.current ? { label: "Retry", onClick: () => retryRef.current() } : undefined,
            })
          }
          // Rethrown so the editor's own Save button keeps the doc marked unsaved.
          throw err
        },
      )
    },
    [save, getDoc, markSaved],
  )

  // Unsaved: the live doc is neither the last one saved nor one on its way.
  const isUnsaved = useCallback(
    (current) => Boolean(current) && current !== lastSavedRef.current && current !== queuedRef.current,
    [],
  )

  // Retry saves the doc as it is now, not the one that failed: any edits made
  // since then go along with it.
  const retrySave = useCallback(() => {
    persist(getDoc()).catch(() => {})
  }, [getDoc, persist])
  useEffect(() => {
    retryRef.current = retrySave
  }, [retrySave])

  const saveFromToolbar = useCallback((next) => persist(next, { fromToolbar: true }), [persist])

  // Leaving the page (a route change, or the key={id} remount) counts as
  // leaving edit mode: save what is there. Safe after unmount, since save only
  // touches the global SWR cache.
  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  }, [persist])
  useEffect(() => {
    return () => {
      const current = liveDocRef.current
      if (isUnsaved(current)) persistRef.current(current).catch(() => {})
    }
  }, [isUnsaved])

  // A closing tab can't wait for a save, so ask the browser to confirm instead.
  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!isUnsaved(getDoc())) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [getDoc, isUnsaved])

  const changeMode = useCallback(
    (next) => {
      if (next === mode) return
      // Leaving the editor saves whatever it has; the view shows the same doc.
      if (mode === "edit") {
        const current = getDoc()
        if (isUnsaved(current)) persist(current).catch(() => {})
      }
      setMode(next)
    },
    [mode, getDoc, isUnsaved, persist],
  )

  // Undo / redo outside the editor's toolbar (the view-mode header, the
  // chat's Undo) have no Save button next to them, so they save at once.
  const stepAndSave = useCallback(
    (step) => {
      const before = getDoc()
      step()
      const after = getDoc()
      if (after === before) return false
      persist(after).catch(() => {})
      return true
    },
    [getDoc, persist],
  )
  const undoAndSave = useCallback(() => stepAndSave(undo), [stepAndSave, undo])
  const redoAndSave = useCallback(() => stepAndSave(redo), [stepAndSave, redo])

  // Birdy's ops land on the editor's history in both modes, as one undo step
  // authored "ai" (applyIncomingOps has already dry-run them). The hook's
  // applyAll reports success as a boolean; applyIncomingOps wants the doc.
  const opsTarget = useMemo(
    () => ({
      getDoc,
      applyAll(ops, author) {
        editorApplyAll(ops, author)
        return getDoc()
      },
    }),
    [getDoc, editorApplyAll],
  )

  const handleDashboardOps = useCallback(
    (ops, data) => {
      // The reply can outlive the page (chat-store keeps the request going).
      // The doc it was meant for is gone, so say so rather than guess.
      if (!mountedRef.current) {
        return { applied: false, diff: [], error: "The dashboard was closed before these changes arrived." }
      }
      const result = applyIncomingOps(opsTarget, ops, {
        dashboardId: data?.dashboard_id,
        currentId: id,
        registry,
        catalog,
      })
      if (result.applied) persist(result.doc).catch(() => {})
      return result
    },
    [id, catalog, opsTarget, persist],
  )

  // The chat's Undo under a reply. It steps back the latest change, so it only
  // does so while that change is still Birdy's: once the user has edited on
  // top, undoing would take back their edit instead.
  const handleUndoDashboardOps = useCallback(() => {
    if (!mountedRef.current || !canUndo) return false
    if (getDoc().meta?.lastAuthor !== "ai") return false
    return undoAndSave()
  }, [canUndo, getDoc, undoAndSave])

  // Read at send time: the backend checks Birdy's ops against this outline.
  const getDashboardSummary = useCallback(() => summarize(getDoc()), [getDoc])

  // Memoised because publishing sets state on the provider above: a fresh
  // object every render would republish every render. See usePageHeader.
  const title = liveDoc.title || "Dashboard"
  const header = useMemo(
    () => ({
      title: <SalesHubHeaderTitle title={title} subtitle="My dashboards" />,
      controls: (
        <div className="flex items-center gap-3">
          <SaveStatus state={saveState} onRetry={retrySave} />
          {/* The editor's toolbar has its own Undo / Redo. */}
          {mode === "view" && (canUndo || canRedo) && (
            <div className="flex items-center gap-1">
              {canUndo && <HeaderButton icon={Undo2} label="Undo" onClick={undoAndSave} />}
              {canRedo && <HeaderButton icon={Redo2} label="Redo" onClick={redoAndSave} />}
            </div>
          )}
          <PdSegmented
            label="Dashboard mode"
            options={MODES}
            value={mode}
            onChange={changeMode}
            itemClassName="px-3 py-[5px] text-[12px]"
          />
        </div>
      ),
    }),
    [title, saveState, mode, changeMode, retrySave, canUndo, canRedo, undoAndSave, redoAndSave],
  )
  usePageHeader(header)

  const board =
    mode === "edit" ? (
      // dashkit's DashboardEditor, composed here so it runs on the page's
      // editor state instead of its own (keep in step with dashkit's
      // src/react/editor/editor.tsx).
      <DashboardDataProvider dataSource={dataSource} registry={registry}>
        <ComponentsProvider value={components}>
          <EditorProvider editor={editor} registry={registry} catalog={catalog}>
            <div className="dk-root dk-editor h-full" data-view={view}>
              <Toolbar onSave={saveFromToolbar} view={view} onViewChange={setView} />
              <Palette />
              {view === "json" ? <JsonView /> : <Canvas />}
              <PropertyPanel />
            </div>
          </EditorProvider>
        </ComponentsProvider>
      </DashboardDataProvider>
    ) : (
      <div className="px-6 py-[22px]">
        <DashboardDataProvider dataSource={dataSource} registry={registry}>
          <ComponentsProvider value={components}>
            <DashboardRenderer doc={editor.doc} registry={registry} catalog={catalog} mode="view" />
          </ComponentsProvider>
        </DashboardDataProvider>
      </div>
    )

  return (
    <WorkspaceLayout
      board={board}
      chat={
        <ChatConversation
          page="dashboards"
          sessionKey={`birdy_dashboard_${id}`}
          dashboardId={id}
          getDashboardSummary={getDashboardSummary}
          onDashboardOps={handleDashboardOps}
          onUndoDashboardOps={handleUndoDashboardOps}
          initialMessage={brief}
          hideInitialMessage={false}
          showScopePicker={false}
          showQuickActions={false}
          composerCompact
          bubbleWidthClass="max-w-[90%]"
          emptyStateTitle="Build this dashboard with Birdy"
          emptyStateSubtitle="Ask for the numbers you want to see, or how to lay them out."
        />
      }
    />
  )
}

/** The dashboard on the left, Ask Birdy on the right. */
function WorkspaceLayout({ board, chat }) {
  return (
    // Bleeds off the layout's padding like SalesHubShell, but the height is
    // bounded here so the dashboard (or the editor's palette, canvas and
    // property panel) and the chat each scroll on their own.
    <div className={`${pdFontClass} -m-4 flex h-full min-h-0 flex-1 flex-col overflow-y-auto md:-m-6 lg:flex-row lg:overflow-hidden`}>
      {/* Stacked below lg: the page scrolls and the board takes its natural
          height, rather than flex-shrinking to nothing above the chat. */}
      <section aria-label="Dashboard" className="min-w-0 shrink-0 lg:min-h-0 lg:flex-1 lg:shrink lg:overflow-auto">
        {board}
      </section>

      <aside
        aria-label="Ask Birdy"
        className="flex h-[560px] min-h-0 w-full shrink-0 flex-col overflow-auto border-t border-pd-border bg-pd-surface lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0"
      >
        <div className="shrink-0 border-b border-pd-divider px-5 py-4">
          <div className="font-pd-display text-[15px] font-semibold text-pd-ink">Ask Birdy</div>
          <div className="mt-0.5 text-[12px] text-pd-faint">Describe a change and Birdy makes it on the dashboard.</div>
        </div>
        {/* The chat mounts with the workspace, once the doc is here, so the
            first message (the brief) goes out with a real summary. */}
        <div className="min-h-0 flex-1">{chat}</div>
      </aside>
    </div>
  )
}

/** A quiet pill button for the header bar (Undo / Redo in view mode). */
function HeaderButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-pd-muted transition-colors hover:bg-pd-divider hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 px-6 py-[22px] sm:grid-cols-2" aria-busy="true" aria-label="Loading dashboard">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[140px] rounded-2xl" />
      ))}
    </div>
  )
}

/**
 * The quiet "Saving… / Saved / Save failed" beside the mode toggle. A failure
 * carries its own Retry: in view mode there is no other Save control.
 */
function SaveStatus({ state, onRetry }) {
  if (state === "idle") return <span aria-live="polite" />
  const { Icon, label, tone } = {
    saving: { Icon: Loader2, label: "Saving…", tone: "text-pd-faint" },
    saved: { Icon: Check, label: "Saved", tone: "text-pd-faint" },
    error: { Icon: AlertTriangle, label: "Save failed", tone: "text-pd-danger" },
  }[state]
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${tone}`}>
      <Icon className={`size-3.5 ${state === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
      {label}
      {state === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-pd-divider px-2 py-0.5 text-[11.5px] font-semibold text-pd-ink transition-colors hover:bg-pd-primary-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
        >
          <RotateCw className="size-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </span>
  )
}
