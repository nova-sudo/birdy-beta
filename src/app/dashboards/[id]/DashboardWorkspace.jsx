"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Check, Eye, Loader2, Pencil } from "lucide-react"
import { applyAll, summarize } from "dashkit/core"
import { ComponentsProvider, DashboardDataProvider, DashboardEditor, DashboardRenderer } from "dashkit/react"
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
// The page owns the live document. It starts as the saved one and from then
// on follows the editor's onChange and the ops Birdy sends back, so both modes
// and the chat always see the same doc, unsaved edits included. The editor
// owns its own undo history; the page only reaches into it through `apiRef`
// (to apply Birdy's ops as one undo step and to mark a save).

const MODES = [
  { key: "view", label: "View", icon: Eye },
  { key: "edit", label: "Edit", icon: Pencil },
]

export default function DashboardWorkspace({ id }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { doc, isLoading, error, save } = useDashboardDoc(id)
  const { catalog } = useDashboardCatalog()

  // The brief typed in the list page's New dialog arrives as ?brief=. Read it
  // once and clean the URL, so a reload doesn't send it to Birdy again.
  const [brief] = useState(() => searchParams.get("brief") || null)
  const briefConsumed = useRef(false)
  useEffect(() => {
    if (!brief || briefConsumed.current) return
    briefConsumed.current = true
    router.replace(`/dashboards/${id}`)
  }, [brief, id, router])

  const [mode, setMode] = useState("view")
  const [saveState, setSaveState] = useState("idle") // idle | saving | saved | error
  const apiRef = useRef(null)

  // The live doc, as state (to render) and as a ref (for the chat, which reads
  // it at send time from callbacks that must not change identity).
  const [liveDoc, setLiveDoc] = useState(null)
  const liveDocRef = useRef(null)
  const lastSavedRef = useRef(null)
  const updateLiveDoc = useCallback((next) => {
    liveDocRef.current = next
    setLiveDoc(next)
  }, [])
  // Adopt the saved doc once it loads; after that the page's copy leads and
  // the SWR cache only tracks what was last saved.
  if (doc && liveDoc === null) {
    liveDocRef.current = doc
    lastSavedRef.current = doc
    setLiveDoc(doc)
  }

  const catalogRef = useRef(catalog)
  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Saves run one after another, so an older PUT can never land after a newer
  // one and overwrite it.
  const saveQueue = useRef(Promise.resolve())
  const inFlight = useRef(0)
  const persist = useCallback(
    (next) => {
      inFlight.current += 1
      setSaveState("saving")
      const run = saveQueue.current.then(() => save(next))
      saveQueue.current = run.catch(() => {})
      return run.then(
        (saved) => {
          inFlight.current -= 1
          lastSavedRef.current = next
          // Edits made while this was in flight were not sent: leave them dirty.
          if (apiRef.current && apiRef.current.getDoc() === next) apiRef.current.markSaved()
          if (mountedRef.current && inFlight.current === 0) setSaveState("saved")
          return saved
        },
        (err) => {
          inFlight.current -= 1
          if (mountedRef.current) setSaveState("error")
          toast.error("Couldn't save this dashboard", {
            description: "Your changes are still here. Try saving again.",
          })
          // Rethrown so the editor's own Save button keeps the doc marked unsaved.
          throw err
        },
      )
    },
    [save],
  )

  const changeMode = useCallback(
    (next) => {
      if (next === mode) return
      if (mode === "edit") {
        // Leaving the editor saves whatever it has; the view shows the same doc.
        const current = apiRef.current?.getDoc() ?? liveDocRef.current
        if (current) {
          updateLiveDoc(current)
          if (current !== lastSavedRef.current) persist(current).catch(() => {})
        }
      }
      setMode(next)
    },
    [mode, persist, updateLiveDoc],
  )

  // In view mode there is no editor to apply Birdy's ops to, so they go
  // straight onto the page's copy (applyIncomingOps has already dry-run them).
  const viewTarget = useMemo(
    () => ({
      getDoc: () => liveDocRef.current,
      applyAll(ops, author) {
        const next = applyAll(liveDocRef.current, ops, { registry, author })
        updateLiveDoc(next)
        return next
      },
    }),
    [updateLiveDoc],
  )

  const handleDashboardOps = useCallback(
    (ops, data) => {
      // The reply can outlive the page (chat-store keeps the request going).
      // The doc it was meant for is gone, so say so rather than guess.
      if (!mountedRef.current || !liveDocRef.current) {
        return { applied: false, diff: [], error: "The dashboard was closed before these changes arrived." }
      }
      const result = applyIncomingOps(apiRef.current ?? viewTarget, ops, {
        dashboardId: data?.dashboard_id,
        currentId: id,
        registry,
        catalog: catalogRef.current,
      })
      if (result.applied) persist(result.doc).catch(() => {})
      return result
    },
    [id, persist, viewTarget],
  )

  // Read at send time: the backend checks Birdy's ops against this outline.
  const getDashboardSummary = useCallback(() => {
    const current = apiRef.current?.getDoc() ?? liveDocRef.current
    return current ? summarize(current) : ""
  }, [])

  // Memoised because publishing sets state on the provider above: a fresh
  // object every render would republish every render. See usePageHeader.
  const title = liveDoc?.title || (isLoading ? "" : "Dashboard")
  const header = useMemo(
    () => ({
      title: <SalesHubHeaderTitle title={title} subtitle="My dashboards" />,
      controls: (
        <div className="flex items-center gap-3">
          <SaveStatus state={saveState} />
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
    [title, saveState, mode, changeMode],
  )
  usePageHeader(header)

  let board
  if (error && !liveDoc) {
    board = (
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
    )
  } else if (!liveDoc) {
    board = <BoardSkeleton />
  } else if (mode === "edit") {
    // The editor's pickers and validation need the catalog: hold it back
    // until that has loaded rather than mount it half-working.
    board = catalog ? (
      <DashboardEditor
        doc={liveDoc}
        registry={registry}
        catalog={catalog}
        dataSource={dataSource}
        components={components}
        onChange={updateLiveDoc}
        onSave={persist}
        apiRef={apiRef}
        className="h-full"
      />
    ) : (
      <BoardSkeleton />
    )
  } else {
    board = (
      <div className="px-6 py-[22px]">
        <DashboardDataProvider dataSource={dataSource} registry={registry}>
          <ComponentsProvider value={components}>
            <DashboardRenderer doc={liveDoc} registry={registry} catalog={catalog ?? undefined} mode="view" />
          </ComponentsProvider>
        </DashboardDataProvider>
      </div>
    )
  }

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
        <div className="min-h-0 flex-1">
          {/* Mounted once the doc is here, so the first message (the brief)
              goes out with a real summary for Birdy to build on. */}
          {liveDoc ? (
            <ChatConversation
              page="dashboards"
              sessionKey={`birdy_dashboard_${id}`}
              dashboardId={id}
              getDashboardSummary={getDashboardSummary}
              onDashboardOps={handleDashboardOps}
              initialMessage={brief}
              hideInitialMessage={false}
              showScopePicker={false}
              showQuickActions={false}
              composerCompact
              bubbleWidthClass="max-w-[90%]"
              emptyStateTitle="Build this dashboard with Birdy"
              emptyStateSubtitle="Ask for the numbers you want to see, or how to lay them out."
            />
          ) : (
            <div className="space-y-3 p-5" aria-hidden="true">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </div>
      </aside>
    </div>
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

/** The quiet "Saving… / Saved / Save failed" beside the mode toggle. */
function SaveStatus({ state }) {
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
    </span>
  )
}
