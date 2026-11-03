"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button, ErrorState, Notice, PageHeader, Skeleton } from "@/components/ds"
import { WizardSteps } from "@/components/agents/WizardSteps"
import { useCreativeAdAccounts, useCreativeTest } from "@/lib/creatives-api"
import { AdPreview } from "./AdPreview"
import { StepAccounts, accountsStepValid } from "./StepAccounts"
import { StepCreative, creativeStepValid } from "./StepCreative"
import { StepReview } from "./StepReview"
import { StepTargets, targetsStepValid } from "./StepTargets"
import { useCreativeDraft } from "./useCreativeDraft"

export const CREATIVE_STEPS = ["Creative", "Accounts", "Targets", "Review & post"]
const STEP_KEYS = ["creative", "accounts", "targets", "review"]
const NEW_PATH = "/campaigns/creatives/new"
const NO_ROWS = []
const LIST_PATH = "/campaigns?tab=creatives"

/** Rewrites the address bar without a navigation, so the page keeps its state. */
function replaceUrl(pathname, params) {
  const qs = params.toString()
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
}

/**
 * The full-page "New creative test" wizard. Steps: creative, accounts, targets, review & post.
 * `?test=<id>&step=targets` on a posted test only edits its targets; a posted test's accounts step adds accounts.
 * The right-hand column is the sticky live ad preview.
 *
 * @param {object} props
 * @param {string|null} props.testId Draft to edit, or null for a new test
 */
export function CreativeWizard({ testId }) {
  const search = useSearchParams()
  const router = useRouter()
  // ?scale=<id>: scale a test into more accounts. It opens that test in add-accounts mode on the Accounts step.
  const scaleId = testId ? null : search?.get("scale") || null
  const loadId = testId ?? scaleId
  const [stepKey, setStepKey] = useState(() =>
    scaleId ? "accounts" : STEP_KEYS.includes(search?.get("step")) ? search.get("step") : "creative"
  )
  const [moving, setMoving] = useState(false)
  // Add-accounts mode: new selections stay here (the posted creative is read-only); step 4 posts them.
  const [addRows, setAddRows] = useState([])
  const [justPosted, setJustPosted] = useState(false)

  const { test, isLoading, error: loadError } = useCreativeTest(loadId)
  const { accounts: allAccounts } = useCreativeAdAccounts()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const { draft, setField, setFields, save, getId, error } = useCreativeDraft(loadId, {
    onCreated: (created) => {
      // A create that lands after the user left (or moved on) must not rewrite the address.
      if (!mounted.current || window.location.pathname !== NEW_PATH) return
      const params = new URLSearchParams(window.location.search)
      replaceUrl(`/campaigns/creatives/${created.id}/edit`, params)
    },
  })

  // A `path=revive` link starts on the revive path (local only until something is filled in).
  const pathApplied = useRef(false)
  useEffect(() => {
    if (pathApplied.current) return
    pathApplied.current = true
    if (!loadId && search?.get("path") === "revive") setFields({ origin: "revive" }, { silent: true })
  }, [loadId, search, setFields])

  const step = STEP_KEYS.indexOf(stepKey) + 1

  // Scale: pre-check every account the test does not run in yet, once the test and the accounts are in.
  const scalePrefilled = useRef(false)
  useEffect(() => {
    if (!scaleId || scalePrefilled.current || !test || !allAccounts.length) return
    scalePrefilled.current = true
    const used = new Set((test.ads ?? []).map((a) => a.ad_account_id))
    const c = test.creative ?? {}
    // A revived video still lives on its source account until it is uploaded.
    const blocked = (act) => test.origin === "revive" && c.media?.video_id && !c.media?.blob_url && act !== test.source?.ad_account_id
    setAddRows(
      allAccounts
        .filter((a) => !used.has(a.ad_account_id) && !blocked(a.ad_account_id))
        .map((a) => ({ ad_account_id: a.ad_account_id, client_group_id: null, adset_id: null, adset_name: null, page_id: null, lead_form_id: null }))
    )
  }, [scaleId, test, allAccounts])

  async function go(key) {
    setMoving(true)
    try {
      await save()
    } catch {
      return // the error Notice shows; stay on this step
    } finally {
      setMoving(false)
    }
    // Later steps work on the saved draft, so never leave without one.
    if (!getId()) return
    setStepKey(key)
    const params = new URLSearchParams(window.location.search)
    if (key === "creative") params.delete("step")
    else params.set("step", key)
    replaceUrl(window.location.pathname, params)
  }

  const notDraft = draft.status && draft.status !== "draft"
  // Add-accounts mode: accounts the test already runs in stay checked and locked.
  const lockedAccountIds = notDraft ? [...new Set((test?.ads ?? []).map((a) => a.ad_account_id).filter(Boolean))] : []
  const addMode = !!notDraft && (stepKey === "accounts" || (stepKey === "review" && addRows.length > 0))
  // A posted test reaches step 3 only to edit its targets (no posting), and skips it when adding accounts.
  const editTargets = notDraft && stepKey === "targets"
  const accountsDraft = notDraft ? { ...draft, creative: { ...draft.creative, accounts: addRows } } : draft
  const setAccountsField = notDraft ? (_path, rows) => setAddRows(rows) : setField
  const valid =
    stepKey === "accounts"
      ? accountsStepValid(accountsDraft, lockedAccountIds)
      : stepKey === "targets"
        ? targetsStepValid(draft)
        : creativeStepValid(draft)
  const prevKey = (k) => (addMode && k === "review" ? "accounts" : STEP_KEYS[STEP_KEYS.indexOf(k) - 1])
  const nextKey = (k) => (addMode && k === "accounts" ? "review" : STEP_KEYS[STEP_KEYS.indexOf(k) + 1])
  const hideNav = stepKey === "review" && (justPosted || (notDraft && !addMode))

  async function saveTargets() {
    setMoving(true)
    try {
      await save()
    } catch {
      return
    } finally {
      setMoving(false)
    }
    router.push(`${LIST_PATH}&creative=${draft.code}`)
  }

  if (loadId && loadError) {
    return <ErrorState title="Couldn't load this draft" description={loadError.message} />
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "Creatives", href: LIST_PATH }}
        title="New creative test"
        description="Post one creative to several accounts and see which ones it works in."
      />
      <WizardSteps current={step} steps={CREATIVE_STEPS} ariaLabel="Creative test steps" />

      {loadId && isLoading && !draft.id ? (
        <Skeleton className="h-96 w-full rounded-frame" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div data-testid="wizard-step" className="flex min-w-0 flex-col gap-4">
            {notDraft && !editTargets && stepKey !== "review" && (
              <Notice tone="warning">This test has already been posted, so its creative can no longer be edited.</Notice>
            )}
            {error && <Notice tone="danger">Couldn't save your changes. We'll retry on your next edit.</Notice>}
            {stepKey === "creative" ? (
              <StepCreative draft={draft} setField={setField} setFields={setFields} />
            ) : stepKey === "accounts" ? (
              <StepAccounts draft={accountsDraft} setField={setAccountsField} lockedAccountIds={lockedAccountIds} />
            ) : stepKey === "targets" ? (
              <StepTargets draft={draft} setField={setField} allowOverrides={!notDraft} />
            ) : (
              <StepReview draft={draft} rows={addMode ? addRows : undefined} addMode={addMode} onPosted={() => setJustPosted(true)} />
            )}
            {!hideNav && (
              <div className="flex items-center justify-between gap-3">
                {editTargets ? (
                  <span />
                ) : step > 1 ? (
                  <Button variant="ghost" disabled={moving} onClick={() => go(prevKey(stepKey))}>
                    <ArrowLeft />
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {editTargets ? (
                  <Button disabled={!valid || moving} onClick={saveTargets}>
                    Save targets
                  </Button>
                ) : (
                  step < STEP_KEYS.length && (
                    <Button disabled={!valid || moving || (notDraft && !addMode)} onClick={() => go(nextKey(stepKey))}>
                      Continue
                      <ArrowRight />
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
          <aside data-slot="creative-preview" aria-label="Preview" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <AdPreview
              creative={draft.creative}
              source={draft.source}
              accounts={(notDraft ? addRows : draft.creative?.accounts) ?? NO_ROWS}
              postedAds={notDraft || justPosted ? (test?.ads ?? NO_ROWS) : NO_ROWS}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
