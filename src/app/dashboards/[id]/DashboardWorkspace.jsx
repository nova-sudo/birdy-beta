"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Check, Eye, Loader2, MessageCircle, Monitor, Pencil, Plus, Redo2, RotateCw, Undo2, X } from "lucide-react"
import { summarize } from "dashkit/core"
import {
  BriefingProvider,
  Canvas,
  ComponentsProvider,
  DashboardDataProvider,
  DashboardRenderer,
  EDITOR_MIN_WIDTH,
  EditorProvider,
  JsonView,
  Palette,
  PortalContainerProvider,
  PropertyPanel,
  Toolbar,
  useDashboardEditor,
} from "dashkit/react"
import { usePageHeader } from "@/components/page-header"
import { PdCard } from "@/components/portfolio/PdCard"
import { PdSegmented } from "@/components/portfolio/PdSegmented"
import { Skeleton } from "@/components/ui/skeleton"
import ChatConversation from "@/components/chat/ChatConversation"
import { EmptyStarters } from "@/components/dashboards/EmptyStarters"
import { WidgetPicker } from "@/components/dashboards/WidgetPicker"
import { pdFontClass } from "@/lib/pd-fonts"
import { registry, components } from "@/lib/dashkit/registry"
import { dataSource } from "@/lib/dashkit/data-source"
import { fetchBriefing } from "@/lib/dashkit/briefing"
import { applyIncomingOps } from "@/lib/dashboard-ops"
import { addWidgetOps, starterOps } from "@/lib/dashboard-starters"
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
//
// The page header is the dashboard's title: the top bar's breadcrumb back to
// the list ends in it. dashkit draws no page title of its own (no hero); a
// level-1 heading widget is the board's title when the doc has one (the
// starters add one to an empty dashboard). The editor has its own title
// field in its toolbar.
//
// Docs arrive as dashkit v3 (useDashboardDoc migrates stored v1 and v2 ones,
// with the catalog), a flat list of widgets on a 12-column grid, with headings
// in place of sections, each data widget carrying one query.
//
// Both modes sit inside one BriefingProvider: briefing widgets ask
// POST /api/dashboards/<id>/briefing for their text (lib/dashkit/briefing).
//
// Ways in for a new dashboard: view mode's "Add widget" (the palette's grid in
// a dialog, which drops into the editor with the widget selected), one-click
// starters while the dashboard has no widgets, and quick starters in the chat.
// In edit mode the chat folds into a rail on desktop so the canvas has room.

const MODES = [
  { key: "view", label: "View", icon: Eye },
  { key: "edit", label: "Edit", icon: Pencil },
]

// Ask Birdy's quick starters on this page: one per kind of change it can make.
const CHAT_STARTERS = [
  "Add a table of spend by client",
  "Add a page title heading",
  "Add a note explaining this dashboard",
].map((label) => ({ label, prompt: label }))

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
  // breadcrumb so the header doesn't flash back to the wordmark.
  const loadingHeader = useMemo(
    () => ({ title: <DashboardBreadcrumb title={isLoading ? null : "Dashboard"} /> }),
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const editorRootRef = useRef(null)
  // The editor's .dk-root, as state: dashkit's popovers, selects and menus
  // portal into it (DashboardEditor does this for itself). In document.body
  // they would sit outside .dk-root, with no --dk-* tokens, and paint
  // transparent.
  const [portalRoot, setPortalRoot] = useState(null)
  // dashkit's editor needs its 12 columns: narrower than EDITOR_MIN_WIDTH it
  // keeps the toolbar and shows the dashboard read-only, as DashboardEditor
  // does. Measured on the editor itself, not the window (the sidebar and the
  // chat rail take their share).
  const [editorWidth, measureEditor] = useElementWidth()
  const editorRef = useCallback(
    (node) => {
      editorRootRef.current = node
      setPortalRoot(node)
      measureEditor(node)
    },
    [measureEditor],
  )
  const narrow = editorWidth > 0 && editorWidth < EDITOR_MIN_WIDTH
  // Set by a pick from the view's picker: once the editor is up, focus goes
  // to the new widget's properties (the header button that opened the
  // picker is gone in edit mode, which would drop focus to <body>).
  const focusPropertiesRef = useRef(false)

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
  const { getDoc, applyAll: editorApplyAll, undo, redo, markSaved, canUndo, canRedo, select } = editor

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

  // The picker's choice goes at the end of the dashboard (after its last
  // widget), then the editor opens on it, selected, to set up.
  // Unsaved until the editor saves, like anything added in the editor.
  const addPickedWidget = useCallback(
    (type) => {
      const { ops, widgetId } = addWidgetOps(getDoc(), type)
      if (!editorApplyAll(ops)) return
      setMode("edit")
      select(widgetId)
      focusPropertiesRef.current = true
    },
    [getDoc, editorApplyAll, select],
  )
  useEffect(() => {
    if (!focusPropertiesRef.current || mode !== "edit") return
    focusPropertiesRef.current = false
    editorRootRef.current
      ?.querySelector('[data-dk="panel"] :is(input, select, textarea, button):not(:disabled)')
      ?.focus()
  }, [mode, editor.selectedId])

  // A starter is a finished, bound widget added in view mode, which has no
  // Save button: save it at once. One batch, so one Undo takes it back.
  const applyStarter = useCallback(
    (kind) => {
      if (editorApplyAll(starterOps(kind, getDoc()))) persist(getDoc()).catch(() => {})
    },
    [editorApplyAll, getDoc, persist],
  )

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
      title: <DashboardBreadcrumb title={title} />,
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
          {/* The editor has its palette; the view gets the same grid here. */}
          {mode === "view" && <HeaderButton icon={Plus} label="Add widget" onClick={() => setPickerOpen(true)} />}
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

  // Nothing to look at yet: no widgets, or only headings.
  const isEmpty = editor.doc.widgets.every((widget) => widget.type === "heading")
  const board =
    mode === "edit" ? (
      // dashkit's DashboardEditor, composed here so it runs on the page's
      // editor state instead of its own. Keep the structure and classes in
      // step with dashkit's src/react/editor/editor.tsx: the dk: classes are
      // dashkit's own compiled utilities (dashkit/styles.css).
      <DashboardDataProvider dataSource={dataSource} registry={registry}>
        <ComponentsProvider value={components}>
          <EditorProvider editor={editor} registry={registry} catalog={catalog}>
            <div
              ref={editorRef}
              data-dk="editor"
              data-view={view}
              data-narrow={narrow ? "true" : undefined}
              className="dk-root dk:flex dk:h-full dk:min-h-[480px] dk:w-full dk:flex-col dk:overflow-hidden dk:bg-bg dk:font-sans dk:text-fg"
            >
              <PortalContainerProvider value={portalRoot}>
                <Toolbar onSave={saveFromToolbar} view={view} onViewChange={setView} compact={narrow} />
                {narrow ? (
                  // The toolbar stays (save, undo, the unsaved note, JSON); only
                  // the grid's editing surfaces need the width.
                  view === "json" ? (
                    <main className="dk:min-h-0 dk:flex-1 dk:overflow-auto">
                      <JsonView />
                    </main>
                  ) : (
                    <div className="dk:flex dk:min-h-0 dk:flex-1 dk:flex-col dk:gap-4 dk:overflow-y-auto dk:p-4">
                      <p
                        role="note"
                        data-dk="narrow-notice"
                        className="dk:m-0 dk:flex dk:items-center dk:gap-2 dk:rounded-xl dk:border dk:border-border dk:bg-card dk:px-4 dk:py-3 dk:text-sm dk:text-body"
                      >
                        <Monitor className="dk:size-4 dk:shrink-0 dk:text-muted-foreground" aria-hidden="true" />
                        <span>Editing needs a wider window</span>
                      </p>
                      <DashboardRenderer doc={editor.doc} registry={registry} catalog={catalog} mode="view" />
                    </div>
                  )
                ) : (
                  <div className="dk:flex dk:min-h-0 dk:flex-1">
                    <Palette />
                    <main className="dk:min-w-0 dk:flex-1 dk:overflow-auto">
                      {view === "json" ? <JsonView /> : <Canvas />}
                    </main>
                    <PropertyPanel />
                  </div>
                )}
              </PortalContainerProvider>
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
        {isEmpty && (
          <div className="mt-6">
            <EmptyStarters onStart={applyStarter} />
          </div>
        )}
        <WidgetPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={addPickedWidget} />
      </div>
    )

  return (
    <WorkspaceLayout
      board={<BriefingProvider onBriefing={fetchBriefing}>{board}</BriefingProvider>}
      railed={mode === "edit"}
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
          // Starters render on their own; the flag only adds the page's
          // default ones and the "/" hint, which this panel doesn't want.
          showQuickActions={false}
          quickStarters={CHAT_STARTERS}
          composerCompact
          bubbleWidthClass="max-w-[90%]"
          emptyStateTitle="Build this dashboard with Birdy"
          emptyStateSubtitle="Ask for the numbers you want to see, or how to lay them out."
        />
      }
    />
  )
}

/**
 * The rendered width of an element, kept up to date with a ResizeObserver,
 * and the callback ref that picks the element. 0 until it has been measured
 * (SSR, the first paint); after that the last positive width is kept, so an
 * element hidden for a moment doesn't flip the editor into its narrow mode.
 */
function useElementWidth() {
  const [width, setWidth] = useState(0)
  const observerRef = useRef(null)
  const measure = useCallback((node) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const update = (next) => {
      if (next > 0) setWidth(Math.round(next))
    }
    update(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === "undefined") return
    observerRef.current = new ResizeObserver(([entry]) => update(entry.contentRect.width))
    observerRef.current.observe(node)
  }, [])
  return [width, measure]
}

const ASIDE_BASE =
  "flex h-[560px] min-h-0 w-full shrink-0 flex-col border-t border-pd-border bg-pd-surface lg:h-auto lg:border-l lg:border-t-0"

/**
 * The dashboard on the left, Ask Birdy on the right.
 *
 * `railed` (edit mode) gives the editor's canvas the room: on desktop the chat
 * folds into a 56px rail whose "Ask Birdy" button opens it as a 380px drawer
 * over the canvas. The chat is only ever hidden, never unmounted, so its
 * conversation (and a reply still streaming in) survives every toggle. Below
 * lg the page stacks, and the chat stays docked under the board.
 */
function WorkspaceLayout({ board, chat, railed = false }) {
  const panelId = useId()
  const railButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Each visit to edit mode starts with the drawer shut.
  const [wasRailed, setWasRailed] = useState(railed)
  if (railed !== wasRailed) {
    setWasRailed(railed)
    setDrawerOpen(false)
  }
  const open = railed && drawerOpen

  // Focus goes into the drawer as it opens and back to the rail as it closes.
  useEffect(() => {
    if (open) closeButtonRef.current?.focus()
  }, [open])
  const closeDrawer = () => {
    setDrawerOpen(false)
    railButtonRef.current?.focus()
  }

  let panelClass = "flex min-h-0 flex-1 flex-col"
  if (railed) {
    panelClass +=
      " lg:absolute lg:inset-y-0 lg:right-14 lg:z-30 lg:w-[380px] lg:border-l lg:border-pd-border lg:bg-pd-surface lg:shadow-pd-popover"
    if (!open) panelClass += " lg:hidden"
  }

  return (
    // Bleeds off the layout's padding like SalesHubShell, but the height is
    // bounded here so the dashboard (or the editor's palette, canvas and
    // property panel) and the chat each scroll on their own.
    <div className={`${pdFontClass} -m-4 flex h-full min-h-0 flex-1 flex-col overflow-y-auto md:-m-6 lg:relative lg:flex-row lg:overflow-hidden`}>
      {/* Stacked below lg: the page scrolls and the board takes its natural
          height, rather than flex-shrinking to nothing above the chat. */}
      <section aria-label="Dashboard" className="min-w-0 shrink-0 lg:min-h-0 lg:flex-1 lg:shrink lg:overflow-auto">
        {board}
      </section>

      <aside
        aria-label="Ask Birdy"
        onKeyDown={
          open
            ? (e) => {
                // An Escape the chat already used (closing its slash menu)
                // is not also a request to close the drawer.
                if (e.key === "Escape" && !e.defaultPrevented) closeDrawer()
              }
            : undefined
        }
        className={`${ASIDE_BASE} ${railed ? "overflow-auto lg:w-14 lg:items-center lg:overflow-visible lg:py-3" : "overflow-auto lg:w-[380px]"}`}
      >
        {railed && (
          <button
            ref={railButtonRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setDrawerOpen((was) => !was)}
            className="hidden cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] font-semibold leading-tight text-pd-muted transition-colors hover:bg-pd-divider hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary aria-expanded:bg-pd-primary-tint aria-expanded:text-pd-primary lg:flex"
          >
            <MessageCircle className="size-[18px]" aria-hidden="true" />
            Ask Birdy
          </button>
        )}
        {/* Always rendered in this slot, whatever the mode: moving or
            unmounting it would restart the chat. */}
        <div
          id={panelId}
          data-state={railed ? (open ? "open" : "closed") : undefined}
          className={panelClass}
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-pd-divider px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="font-pd-display text-[15px] font-semibold text-pd-ink">Ask Birdy</div>
              <div className="mt-0.5 text-[12px] text-pd-faint">Describe a change and Birdy makes it on the dashboard.</div>
            </div>
            {railed && (
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close Ask Birdy"
                onClick={closeDrawer}
                className="-mr-1.5 hidden size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-pd-muted transition-colors hover:bg-pd-divider hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary lg:inline-flex"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {/* The chat mounts with the workspace, once the doc is here, so the
              first message (the brief) goes out with a real summary. */}
          <div className="min-h-0 flex-1">{chat}</div>
        </div>
      </aside>
    </div>
  )
}

/**
 * The top bar's title: "My dashboards / <title>" on one line, the list as a
 * link back. Deliberately small and not a heading: a level-1 heading widget
 * on the board is the big title when the dashboard has one, and two h1s
 * would compete. `title` null (still loading) shows the link alone.
 */
function DashboardBreadcrumb({ title }) {
  return (
    <nav aria-label="Breadcrumb" className={`${pdFontClass} min-w-0`}>
      <p className="flex min-w-0 items-baseline gap-0 whitespace-pre font-pd-display text-[15px] font-semibold leading-none">
        <Link
          href="/dashboards"
          className="shrink-0 text-pd-faint transition-colors hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
        >
          My dashboards
        </Link>
        {title && (
          <>
            <span className="shrink-0 text-pd-faint">{" / "}</span>
            <span aria-current="page" className="min-w-0 truncate text-pd-ink">
              {title}
            </span>
          </>
        )}
      </p>
    </nav>
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
