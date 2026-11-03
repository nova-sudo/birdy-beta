"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button, ErrorState, Notice, PageHeader, Skeleton, Surface } from "@/components/ds"
import { WizardSteps } from "@/components/agents/WizardSteps"
import { useCreativeTest } from "@/lib/creatives-api"
import { StepAccounts, accountsStepValid } from "./StepAccounts"
import { StepCreative, creativeStepValid } from "./StepCreative"
import { useCreativeDraft } from "./useCreativeDraft"

export const CREATIVE_STEPS = ["Creative", "Accounts", "Targets", "Review & post"]
const STEP_KEYS = ["creative", "accounts", "targets", "review"]
const NEW_PATH = "/campaigns/creatives/new"
const LIST_PATH = "/campaigns?tab=creatives"

/** Rewrites the address bar without a navigation, so the page keeps its state. */
function replaceUrl(pathname, params) {
  const qs = params.toString()
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
}

/**
 * The full-page "New creative test" wizard. Steps 1 and 2 are built; the other steps are placeholders
 * until they land. The right-hand column is the slot for the live preview.
 *
 * @param {object} props
 * @param {string|null} props.testId Draft to edit, or null for a new test
 */
export function CreativeWizard({ testId }) {
  const search = useSearchParams()
  const [stepKey, setStepKey] = useState(() => (STEP_KEYS.includes(search?.get("step")) ? search.get("step") : "creative"))
  const [moving, setMoving] = useState(false)

  const { test, isLoading, error: loadError } = useCreativeTest(testId)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const { draft, setField, setFields, save, getId, error } = useCreativeDraft(testId, {
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
    if (!testId && search?.get("path") === "revive") setFields({ origin: "revive" }, { silent: true })
  }, [testId, search, setFields])

  const step = STEP_KEYS.indexOf(stepKey) + 1

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
  const valid = stepKey === "accounts" ? accountsStepValid(draft) : creativeStepValid(draft)

  if (testId && loadError) {
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

      {testId && isLoading && !draft.id ? (
        <Skeleton className="h-96 w-full rounded-frame" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div data-testid="wizard-step" className="flex min-w-0 flex-col gap-4">
            {notDraft && <Notice tone="warning">This test has already been posted, so its creative can no longer be edited.</Notice>}
            {error && <Notice tone="danger">Couldn't save your changes. We'll retry on your next edit.</Notice>}
            {stepKey === "creative" ? (
              <StepCreative draft={draft} setField={setField} setFields={setFields} />
            ) : stepKey === "accounts" ? (
              <StepAccounts draft={draft} setField={setField} lockedAccountIds={lockedAccountIds} />
            ) : (
              <Surface className="text-sm text-muted-foreground">{CREATIVE_STEPS[step - 1]} step</Surface>
            )}
            <div className="flex items-center justify-between gap-3">
              {step > 1 ? (
                <Button variant="ghost" disabled={moving} onClick={() => go(STEP_KEYS[step - 2])}>
                  <ArrowLeft />
                  Back
                </Button>
              ) : (
                <span />
              )}
              {step < STEP_KEYS.length && (
                <Button disabled={!valid || moving || notDraft} onClick={() => go(STEP_KEYS[step])}>
                  Continue
                  <ArrowRight />
                </Button>
              )}
            </div>
          </div>
          {/* Live preview slot, filled by the preview task. */}
          <aside data-slot="creative-preview" aria-label="Preview" className="min-w-0 lg:sticky lg:top-6 lg:self-start" />
        </div>
      )}
    </div>
  )
}
