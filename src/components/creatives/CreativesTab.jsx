"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Sparkles } from "lucide-react"
import { Badge, Button, EmptyState, SearchInput, SegmentedTabs, confirm, toast } from "@/components/ds"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { pauseCreativeAds, retryCreativeAd, useCreativeTests } from "@/lib/creatives-api"
import { usePageViews } from "@/lib/usePageViews"
import { useRememberViewCatalogue } from "@/lib/view-catalogues"
import { CreativeDetailSheet } from "./CreativeDetailSheet"
import { CREATIVE_COLUMNS, CreativesTable } from "./CreativesTable"

const WIZARD = "/campaigns/creatives/new"
const ALL_COLUMNS = CREATIVE_COLUMNS.map((c) => c.id)
const COLUMN_CATALOGUE = CREATIVE_COLUMNS.map((c) => ({ ...c, source: "meta" }))

const CHIPS = [
  { value: "all", label: "All", match: () => true },
  { value: "testing", label: "Testing", match: (t) => ["draft", "posting", "testing"].includes(t.status) },
  { value: "winners", label: "Winners", match: (t) => t.status === "winner" },
  { value: "losers", label: "Losers", match: (t) => t.status === "loser" },
  { value: "archived", label: "Archived", match: () => true },
]

const matches = (t, q) => !q || [t.name, t.code].some((s) => String(s ?? "").toLowerCase().includes(q))

/** Creative tests in the Marketing Hub: toolbar, table, empty state and the detail sheet. */
export function CreativesTab({ clientGroupId }) {
  const router = useRouter()
  const params = useSearchParams()
  const [chip, setChip] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [openId, setOpenId] = React.useState(null)
  const [visible, setVisible] = React.useState(ALL_COLUMNS)

  const group = clientGroupId && clientGroupId !== "all" ? clientGroupId : undefined
  const active = useCreativeTests({ clientGroupId: group })
  const archived = useCreativeTests({ status: "archived", clientGroupId: group })

  const pageViews = usePageViews("mktg_creatives", {
    state: { visibleColumns: visible },
    onApply: (s) => Array.isArray(s?.visibleColumns) && setVisible(s.visibleColumns),
  })

  // Lets Birdy save column views for this table from chat.
  useRememberViewCatalogue("mktg_creatives", {
    label: "Marketing Hub · Creatives",
    path: "/campaigns",
    columns: COLUMN_CATALOGUE,
  })

  // ?creative=<code or id> opens that test once. A CT- code waits for the list; anything else is an id.
  const deepLink = params?.get("creative")
  const opened = React.useRef(null)
  React.useEffect(() => {
    if (!deepLink || opened.current === deepLink) return
    const hit = [...active.tests, ...archived.tests].find((t) => t.code === deepLink || t.id === deepLink)
    if (hit) {
      opened.current = deepLink
      setOpenId(hit.id)
    } else if (!/^CT-/i.test(deepLink)) {
      opened.current = deepLink
      setOpenId(deepLink)
    }
  }, [deepLink, active.tests, archived.tests])

  const closeSheet = () => {
    setOpenId(null)
    if (params?.get("creative")) {
      const next = new URLSearchParams(params.toString())
      next.delete("creative")
      next.set("tab", "creatives")
      router.replace(`/campaigns?${next.toString()}`)
    }
  }

  const counts = {
    all: active.tests.length,
    testing: active.tests.filter(CHIPS[1].match).length,
    winners: active.tests.filter(CHIPS[2].match).length,
    losers: active.tests.filter(CHIPS[3].match).length,
    archived: archived.tests.length,
  }
  const source = chip === "archived" ? archived.tests : active.tests
  const chipDef = CHIPS.find((c) => c.value === chip)
  const q = query.trim().toLowerCase()
  const shown = source.filter((t) => chipDef.match(t) && matches(t, q))

  const loading = active.isLoading
  const nothingYet = !loading && active.tests.length === 0 && archived.tests.length === 0

  // A row's Pause (after a confirm) pauses that account's ad in Meta; Retry re-queues the failed ad.
  const onAccountAction = React.useCallback(async (test, ad, action) => {
    if (action === "retry") {
      try {
        await retryCreativeAd(test.id, ad.id)
        toast.success("Retrying", { description: `${test.code} in ${ad.ad_account_id}` })
      } catch (err) {
        toast.error("Couldn't retry", { description: err?.message })
      }
      return
    }
    if (action !== "pause") return
    let ok = false
    try {
      ok = await confirm({
        title: "Pause this account's ad?",
        description: `${test.code} stops spending in ${ad.ad_account_id}. Other accounts keep running.`,
        confirmLabel: "Pause here",
      })
    } catch {
      ok = false
    }
    if (!ok) return
    try {
      await pauseCreativeAds(test.id, [ad.ad_account_id])
      toast.success("Paused", { description: `${test.code} in ${ad.ad_account_id}` })
    } catch (err) {
      toast.error("Couldn't pause", { description: err?.message })
    }
  }, [])

  const items = CHIPS.map((c) => ({
    value: c.value,
    label: c.label,
    count: loading ? undefined : counts[c.value],
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs size="sm" ariaLabel="Test status" value={chip} onValueChange={setChip} items={items} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            debounceMs={0}
            placeholder="Search creative tests…"
            inputClassName="w-56"
          />
          <ColumnsMenu
            columns={COLUMN_CATALOGUE}
            visibleColumns={visible}
            onChange={setVisible}
            defaultColumns={ALL_COLUMNS}
            views={pageViews}
          />
          <Button size="sm" variant="primary" onClick={() => router.push(WIZARD)}>
            <Plus aria-hidden />
            New creative test
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Tests use their own dates; the period picker doesn&apos;t apply.</p>

      {nothingYet ? (
        <EmptyState
          variant="surface"
          icon={Sparkles}
          title="Test one ad across every client account"
          description="Post a creative to many ad accounts at once, let each account's results score it against your targets, and Birdy calls the winner."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => router.push(WIZARD)}>
                Create a new ad
              </Button>
              <Button onClick={() => router.push(`${WIZARD}?path=revive`)}>Test an ad you already have</Button>
            </div>
          }
        />
      ) : (
        <CreativesTable
          tests={shown}
          loading={loading}
          visibleColumns={visible}
          onOpen={setOpenId}
          onAccountAction={onAccountAction}
        />
      )}

      <CreativeDetailSheet
        testId={openId}
        open={openId != null}
        onOpenChange={(o) => {
          if (!o) closeSheet()
        }}
      />
    </div>
  )
}
