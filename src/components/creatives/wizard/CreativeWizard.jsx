"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button, ErrorState, Notice, PageHeader, Skeleton, Surface } from "@/components/ds"
import { WizardSteps } from "@/components/agents/WizardSteps"
import { useCreativeTest } from "@/lib/creatives-api"
import { StepCreative, creativeStepValid } from "./StepCreative"
import { useCreativeDraft } from "./useCreativeDraft"

export const CREATIVE_STEPS = ["Creative", "Accounts", "Targets", "Review & post"]
const STEP_KEYS = ["creative", "accounts", "targets", "review"]
const LIST_PATH = "/campaigns?tab=creatives"

/** Rewrites the address bar without a navigation, so the page keeps its state. */
function replaceUrl(pathname, params) {
  const qs = params.toString()
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
}

/**
 * The full-page "New creative test" wizard. Step 1 is built; the other steps are placeholders
 * until they land. The right-hand column is the slot for the live preview.
 *
 * @param {object} props
 * @param {string|null} props.testId Draft to edit, or null for a new test
 */
export function CreativeWizard({ testId }) {
  const search = useSearchParams()
  const [stepKey, setStepKey] = useState(() => (STEP_KEYS.includes(search?.get("step")) ? search.get("step") : "creative"))
  const [moving, setMoving] = useState(false)

  const { isLoading, error: loadError } = useCreativeTest(testId)
  const { draft, setField, setFields, save, error } = useCreativeDraft(testId, {
    onCreated: (created) => {
      const params = new URLSearchParams(window.location.search)
      replaceUrl(`/campaigns/creatives/${created.id}/edit`, params)
    },
  })

  // A `path=revive` link starts on the revive path (local only until something is filled in).
  useEffect(() => {
    if (!testId && search?.get("path") === "revive") setFields({ origin: "revive" }, { silent: true })
  }, [testId, search, setFields])

  const step = STEP_KEYS.indexOf(stepKey) + 1

  async function go(key) {
    setMoving(true)
    try {
      await save()
    } finally {
      setMoving(false)
    }
    setStepKey(key)
    const params = new URLSearchParams(window.location.search)
    if (key === "creative") params.delete("step")
    else params.set("step", key)
    replaceUrl(window.location.pathname, params)
  }

  const valid = creativeStepValid(draft)
  const notDraft = draft.status && draft.status !== "draft"

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
