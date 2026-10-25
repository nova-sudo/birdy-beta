"use client"

// The per-client tracking setup portal.
//
// A dedicated page rather than a tab in the settings dialog, for two reasons. A
// guided flow with five steps and three copyable strings does not fit in a
// modal. And this URL gets sent to people — an account manager, a colleague, the
// person who actually has access to the landing page — which a dialog cannot be.
//
// The constraint shaping all of it: **the landing pages are not ours, and often
// not our user's either.** They belong to the agency's client, sometimes to a
// web person at a third company. So the portal's job is not "here is a box, edit
// your code" — it is to produce something forwardable and then verify from the
// outside whether it landed.

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, ExternalLink, Mail, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import CodeSnippet from "@/components/attribution/CodeSnippet"
import SetupChecklist from "@/components/attribution/SetupChecklist"
import { Button, ErrorState, Frame, PageHeader, Skeleton, Surface } from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { cn } from "@/lib/utils"
import { LEAD_SOURCE_OPTIONS, normalizeLeadSource } from "@/lib/lead-sources"

// The three ways a client can collect leads — shared with every other screen
// that asks, so the choice reads the same everywhere. See lib/lead-sources.js.
const METHODS = LEAD_SOURCE_OPTIONS

// Which form tool, for a client whose form sends its leads to GoHighLevel. Each
// guide is read by someone who did not build the form, so it says what has to
// be true rather than describing a screen we can't see.
const GHL_FORM_TOOLS = [
  { key: "roasform", label: "ROAS Forms" },
  { key: "ghl", label: "GoHighLevel form or funnel" },
  { key: "other", label: "Something else" },
]

const GHL_FORM_GUIDES = {
  roasform:
    "In ROAS Forms, connect the form to this client's GoHighLevel sub-account and switch on sending attribution, " +
    "so each contact arrives with the UTM parameters and the ad id. It works the same on ROAS's own landing pages " +
    "and on a ROAS form embedded in the client's website.",
  ghl:
    "GoHighLevel records the ad on its own forms and funnels by itself. There is nothing to switch on.",
  other:
    "Make sure the tool sends each lead to this client's GoHighLevel sub-account with the UTM parameters, " +
    "including the ad id. If it can't, choose \"Their own landing page and records\" and install the pixel instead.",
}

const STEP_LABELS = ["Lead source", "Install the pixel", "Tag ads", "Verify"]
const VERIFY_STEP = 3

export default function TrackingPortalPage() {
  const { id: clientId } = useParams()
  const router = useRouter()

  const [portal, setPortal] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [polling, setPolling] = useState(false)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(`/attribution/portal/${clientId}`)
      if (!res.ok) throw new Error(`Couldn't load tracking setup (${res.status})`)
      setPortal(await res.json())
      setError(null)
    } catch (e) {
      setError(e.message || String(e))
    }
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  // Poll while the checklist is incomplete and the operator is on the Verify
  // step. Someone pasting a snippet into another window wants this to go green
  // by itself — but polling a finished checklist forever is just load.
  useEffect(() => {
    const incomplete = portal?.diagnostics?.applicable && !portal?.diagnostics?.complete
    if (step !== VERIFY_STEP || !incomplete) {
      setPolling(false)
      return undefined
    }
    setPolling(true)
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiRequest(`/attribution/diagnostics/${clientId}`)
        if (res.ok) {
          const diagnostics = await res.json()
          setPortal((prev) => (prev ? { ...prev, diagnostics } : prev))
        }
      } catch {
        // A failed poll is not worth a toast; the next tick will try again.
      }
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [step, clientId, portal?.diagnostics?.applicable, portal?.diagnostics?.complete])

  const saveMethod = async (method, patch = {}) => {
    setSaving(true)
    try {
      const body = {
        method,
        form_provider: patch.form_provider ?? portal?.lead_collection?.form_provider ?? null,
        push_to_ghl: patch.push_to_ghl ?? portal?.lead_collection?.push_to_ghl ?? false,
      }
      const res = await apiRequest(`/attribution/lead-collection/${clientId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Couldn't save")
      // Re-read rather than patching locally: the checklist depends on the
      // method, and the server builds it.
      await load()
    } catch (e) {
      toast.error(e.message || "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState title="Couldn't load tracking setup" description={error} onRetry={load} />
      </div>
    )
  }

  if (!portal) {
    return (
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-6"
        aria-busy="true"
        aria-label="Loading tracking setup"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-3 rounded-frame bg-frame p-3">
          <Skeleton className="h-6 w-56" />
          <Surface className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </Surface>
        </div>
      </div>
    )
  }

  const config = portal.lead_collection || {}
  const method = normalizeLeadSource(config.method)
  const isInstantForm = method === "instant_form"
  const isFormToGhl = method === "form_to_ghl"
  const isLandingPage = method === "landing_page"
  const ghlGuide = GHL_FORM_GUIDES[config.form_provider] || null

  // Only a client's own landing page has steps to walk. For the other two the
  // rail would be greyed circles implying work they don't have to do.
  const visibleSteps = isLandingPage ? [0, 1, 2, 3] : [0]
  // Switching a client away from a landing page mid-walk must not leave it on
  // a pixel step it no longer has.
  const shownStep = isLandingPage ? step : 0

  const mailto =
    `mailto:?subject=${encodeURIComponent(`Tracking setup for ${portal.group_name}`)}` +
    `&body=${encodeURIComponent(
      `Hi,\n\nCould you add this one line to every page our ads point at, ` +
        `just before the closing </head> tag?\n\n${portal.snippet}\n\n` +
        `Full instructions (no login needed): ${portal.install_page_url}\n\nThanks!`,
    )}`

  const refreshButton = (spinning) => (
    <Button variant="ghost" size="sm" onClick={load}>
      <RefreshCw className={cn(spinning && "animate-spin")} />
      Refresh
    </Button>
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <button
            type="button"
            onClick={() => router.push(`/clients/${clientId}`)}
            aria-label="Back to client"
            className="-ml-1 inline-flex items-center gap-1 rounded-sm px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-control-focus"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {portal.group_name}
          </button>
        }
        title="Tracking setup"
        description="Get this client's leads tied to the ads that produced them."
      />

      {/* Step rail */}
      {visibleSteps.length > 1 && (
        <ol className="flex items-start gap-1" aria-label="Setup steps">
          {STEP_LABELS.map((label, index) => (
            <li key={label} className="flex flex-1 items-start gap-1">
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={index === step ? "step" : undefined}
                className="flex flex-col items-center gap-1.5 rounded-control p-1 outline-none focus-visible:shadow-control-focus"
              >
                <span
                  className={cn(
                    "num flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    index === step
                      ? "bg-primary text-primary-foreground"
                      : index < step
                        ? "bg-success-soft text-success-ink"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {index < step ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs",
                    index === step ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
              {index < STEP_LABELS.length - 1 && (
                <span className="mt-5 h-px flex-1 bg-border" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      )}

      {/* 1 - how they collect leads */}
      {shownStep === 0 && (
        <Frame title="How does this client collect leads?">
          <Surface className="flex flex-col gap-4">
            <p className="text-sm leading-normal text-body">
              This decides what has to be set up. Get it wrong and the rest of these
              steps ask for things that don&apos;t apply.
            </p>
            <div className="flex flex-col gap-2">
              {METHODS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={saving}
                  aria-pressed={method === option.key}
                  onClick={() => saveMethod(option.key)}
                  className={cn(
                    "rounded-control border-2 px-3.5 py-3 text-left outline-none transition-colors focus-visible:shadow-control-focus disabled:opacity-60",
                    method === option.key
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background hover:border-muted-foreground/40",
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <p className="mt-0.5 text-sm leading-snug text-body">{option.hint}</p>
                </button>
              ))}
            </div>

            {isInstantForm && <SetupChecklist diagnostics={portal.diagnostics} />}

            {isFormToGhl && (
              <div className="flex flex-col gap-4">
                <div className="rounded-control bg-muted p-3.5">
                  <p className="text-sm font-medium text-foreground">Nothing to install in Birdy</p>
                  <p className="mt-1 text-sm leading-normal text-body">
                    The form tool sends each lead to GoHighLevel with the ad it came from, and Birdy
                    attributes it from GoHighLevel. This setting changes nothing on its own — it tells
                    Birdy where to look. Two things on the client&apos;s side make it work:
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">
                    1. Send attribution to GoHighLevel from the form tool
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GHL_FORM_TOOLS.map((tool) => (
                      <button
                        key={tool.key}
                        type="button"
                        disabled={saving}
                        aria-pressed={config.form_provider === tool.key}
                        onClick={() => saveMethod(method, { form_provider: tool.key })}
                        className={cn(
                          "h-control-sm rounded-control border-2 px-3 text-sm outline-none transition-colors focus-visible:shadow-control-focus disabled:opacity-60",
                          config.form_provider === tool.key
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border text-body hover:border-muted-foreground/40",
                        )}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                  {ghlGuide && (
                    <p className="mt-2 text-sm leading-normal text-body">{ghlGuide}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">
                    2. Tag the Meta ads, if they aren&apos;t already
                  </p>
                  <p className="mb-2 mt-1 text-sm leading-normal text-body">
                    In Ads Manager, at the ad level, paste this into the{" "}
                    <span className="font-medium text-foreground">URL parameters</span> field. It is what
                    gives the form tool an ad id to pass on.
                  </p>
                  <CodeSnippet value={portal.meta_url_parameters} label="URL parameters" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Is it working?</p>
                    {refreshButton(false)}
                  </div>
                  <SetupChecklist diagnostics={portal.diagnostics} />
                </div>
              </div>
            )}

            {isLandingPage && (
              <div>
                <Button variant="primary" onClick={() => setStep(1)}>
                  Next: install the pixel
                </Button>
              </div>
            )}
          </Surface>
        </Frame>
      )}

      {/* 2 - the snippet */}
      {shownStep === 1 && (
        <Frame title="Install the Birdy pixel">
          <Surface className="flex flex-col gap-4">
            <p className="text-sm leading-normal text-body">
              One line, on every page the ads point at, just before the closing{" "}
              <code className="rounded-sm bg-muted px-1.5 font-mono text-xs">
                &lt;/head&gt;
              </code>{" "}
              tag. It works like a Meta pixel, does not slow the page down, and is how Birdy
              sees leads that go to the client&apos;s own records instead of GoHighLevel.
            </p>

            <CodeSnippet value={portal.snippet} label="Snippet" />

            <div className="rounded-control bg-muted p-3.5">
              <p className="text-sm font-medium text-foreground">Not your website?</p>
              <p className="mt-1 text-sm leading-normal text-body">
                Usually it isn&apos;t. Send this link to whoever looks after the site —
                it has the snippet and the instructions on it, and they don&apos;t need
                a Birdy login.
              </p>
              <div className="mt-3">
                <CodeSnippet value={portal.install_page_url} label="Install link" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button asChild variant="link" size="sm">
                  <a href={mailto}>
                    <Mail /> Email it
                  </a>
                </Button>
                <Button asChild variant="link" size="sm">
                  <a href={portal.install_page_url} target="_blank" rel="noreferrer">
                    <ExternalLink /> Preview the page
                  </a>
                </Button>
              </div>
            </div>

            <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Next: tag the ads" />
          </Surface>
        </Frame>
      )}

      {/* 3 - Meta URL parameters */}
      {shownStep === 2 && (
        <Frame title="Add tracking parameters to the Meta ads">
          <Surface className="flex flex-col gap-4">
            <p className="text-sm leading-normal text-body">
              In Ads Manager, at the ad level, paste this into the{" "}
              <span className="font-medium text-foreground">URL parameters</span> field.
              Without it we can see that somebody visited but not which ad sent them —
              the visit is tracked, the lead is unattributed.
            </p>

            <CodeSnippet
              value={portal.meta_url_parameters}
              label="URL parameters"
              hint="Meta fills in the campaign, ad set and ad values itself. Only ad_id is used for reporting — the names are for readability."
            />

            <StepNav onBack={() => setStep(1)} onNext={() => setStep(VERIFY_STEP)} nextLabel="Next: verify" />
          </Surface>
        </Frame>
      )}

      {/* 4 - verify */}
      {shownStep === VERIFY_STEP && (
        <Frame title="Check it's working" actions={refreshButton(polling)}>
          <Surface className="flex flex-col gap-4">
            <p className="text-sm leading-normal text-body">
              This updates by itself. The quickest test is to click one of the
              client&apos;s live ads yourself and submit the form.
            </p>
            <SetupChecklist diagnostics={portal.diagnostics} polling={polling} />
            <StepNav onBack={() => setStep(2)} />
          </Surface>
        </Frame>
      )}
    </div>
  )
}

function StepNav({ onBack, onNext, nextLabel }) {
  return (
    <div className="flex items-center gap-2">
      {onBack && <Button onClick={onBack}>Back</Button>}
      {onNext && (
        <Button variant="primary" onClick={onNext}>
          {nextLabel}
        </Button>
      )}
    </div>
  )
}
