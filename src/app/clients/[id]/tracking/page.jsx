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
import { ArrowLeft, ExternalLink, Mail, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import CodeSnippet from "@/components/attribution/CodeSnippet"
import SetupChecklist from "@/components/attribution/SetupChecklist"
import { PdCard } from "@/components/portfolio"
import { apiRequest } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
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
      <div className={cn(pdFontClass, "p-8")}>
        <p className="text-[13px] text-pd-danger">{error}</p>
        <button onClick={load} className="mt-3 text-[12.5px] text-pd-primary">
          Try again
        </button>
      </div>
    )
  }

  if (!portal) {
    return (
      <div className={cn(pdFontClass, "p-8 text-[13px] text-pd-faint")}>
        Loading tracking setup…
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

  return (
    <div className={cn(pdFontClass, "mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 py-6")}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/clients/${clientId}`)}
          className="flex size-8 items-center justify-center rounded-lg border border-pd-border text-pd-subtle hover:text-pd-ink"
          aria-label="Back to client"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="font-pd-display text-[19px] font-semibold text-pd-ink">
            Tracking setup
          </h1>
          <p className="text-[12.5px] text-pd-faint">{portal.group_name}</p>
        </div>
      </div>

      {/* Step rail */}
      {visibleSteps.length > 1 && (
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => setStep(index)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[11.5px] font-semibold transition-all",
                    index === step
                      ? "stepper-active"
                      : index < step
                        ? "stepper-completed"
                        : "stepper-pending",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10.5px]",
                    index === step ? "font-medium text-pd-ink" : "text-pd-faint",
                  )}
                >
                  {label}
                </span>
              </button>
              {index < STEP_LABELS.length - 1 && (
                <span className="mb-4 h-px flex-1 bg-pd-border" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 1 — how they collect leads */}
      {shownStep === 0 && (
        <PdCard title="How does this client collect leads?">
          <p className="mb-3 text-[12.5px] leading-[1.5] text-pd-body">
            This decides what has to be set up. Get it wrong and the rest of these
            steps ask for things that don&apos;t apply.
          </p>
          <div className="flex flex-col gap-2">
            {METHODS.map((option) => (
              <button
                key={option.key}
                disabled={saving}
                onClick={() => saveMethod(option.key)}
                className={cn(
                  "rounded-[12px] border px-3.5 py-3 text-left transition-colors",
                  method === option.key
                    ? "border-pd-primary bg-pd-primary-tint"
                    : "border-pd-border bg-pd-surface hover:border-pd-border-strong",
                )}
              >
                <span className="text-[13px] font-medium text-pd-ink">{option.label}</span>
                <p className="mt-0.5 text-[12px] leading-[1.45] text-pd-body">
                  {option.hint}
                </p>
              </button>
            ))}
          </div>

          {isInstantForm && (
            <div className="mt-4">
              <SetupChecklist diagnostics={portal.diagnostics} />
            </div>
          )}

          {isFormToGhl && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="rounded-[12px] border border-pd-border bg-pd-canvas p-3.5">
                <p className="text-[12.5px] font-medium text-pd-ink">Nothing to install in Birdy</p>
                <p className="mt-1 text-[12px] leading-[1.5] text-pd-body">
                  The form tool sends each lead to GoHighLevel with the ad it came from, and Birdy
                  attributes it from GoHighLevel. This setting changes nothing on its own — it tells
                  Birdy where to look. Two things on the client&apos;s side make it work:
                </p>
              </div>

              <div>
                <p className="text-[12.5px] font-medium text-pd-ink">
                  1. Send attribution to GoHighLevel from the form tool
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {GHL_FORM_TOOLS.map((tool) => (
                    <button
                      key={tool.key}
                      disabled={saving}
                      onClick={() => saveMethod(method, { form_provider: tool.key })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                        config.form_provider === tool.key
                          ? "border-pd-primary bg-pd-primary-tint text-pd-primary"
                          : "border-pd-border text-pd-body hover:border-pd-border-strong",
                      )}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
                {ghlGuide && (
                  <p className="mt-2 text-[12px] leading-[1.5] text-pd-body">{ghlGuide}</p>
                )}
              </div>

              <div>
                <p className="text-[12.5px] font-medium text-pd-ink">
                  2. Tag the Meta ads, if they aren&apos;t already
                </p>
                <p className="mb-2 mt-1 text-[12px] leading-[1.5] text-pd-body">
                  In Ads Manager, at the ad level, paste this into the{" "}
                  <span className="font-medium text-pd-ink">URL parameters</span> field. It is what
                  gives the form tool an ad id to pass on.
                </p>
                <CodeSnippet value={portal.meta_url_parameters} label="URL parameters" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12.5px] font-medium text-pd-ink">Is it working?</p>
                  <button
                    onClick={load}
                    className="flex items-center gap-1.5 text-[12px] text-pd-primary hover:underline"
                  >
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </button>
                </div>
                <SetupChecklist diagnostics={portal.diagnostics} />
              </div>
            </div>
          )}

          {isLandingPage && (
            <button
              onClick={() => setStep(1)}
              className="mt-4 rounded-[10px] bg-pd-primary px-4 py-2 text-[12.5px] font-medium text-white hover:opacity-90"
            >
              Next: install the pixel
            </button>
          )}
        </PdCard>
      )}

      {/* 2 — the snippet */}
      {shownStep === 1 && (
        <PdCard title="Install the Birdy pixel">
          <p className="mb-3 text-[12.5px] leading-[1.5] text-pd-body">
            One line, on every page the ads point at, just before the closing{" "}
            <code className="rounded bg-pd-divider px-1 font-mono text-[11px]">
              &lt;/head&gt;
            </code>{" "}
            tag. It works like a Meta pixel, does not slow the page down, and is how Birdy
            sees leads that go to the client&apos;s own records instead of GoHighLevel.
          </p>

          <CodeSnippet value={portal.snippet} label="Snippet" />

          <div className="mt-4 rounded-[12px] border border-pd-border bg-pd-canvas p-3.5">
            <p className="text-[12.5px] font-medium text-pd-ink">
              Not your website?
            </p>
            <p className="mt-1 text-[12px] leading-[1.5] text-pd-body">
              Usually it isn&apos;t. Send this link to whoever looks after the site —
              it has the snippet and the instructions on it, and they don&apos;t need
              a Birdy login.
            </p>
            <div className="mt-2.5">
              <CodeSnippet value={portal.install_page_url} label="Install link" />
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <a
                href={mailto}
                className="flex items-center gap-1.5 text-[12.5px] text-pd-primary hover:underline"
              >
                <Mail className="size-3.5" /> Email it
              </a>
              <a
                href={portal.install_page_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[12.5px] text-pd-primary hover:underline"
              >
                <ExternalLink className="size-3.5" /> Preview the page
              </a>
            </div>
          </div>

          <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Next: tag the ads" />
        </PdCard>
      )}

      {/* 3 — Meta URL parameters */}
      {shownStep === 2 && (
        <PdCard title="Add tracking parameters to the Meta ads">
          <p className="mb-3 text-[12.5px] leading-[1.5] text-pd-body">
            In Ads Manager, at the ad level, paste this into the{" "}
            <span className="font-medium text-pd-ink">URL parameters</span> field.
            Without it we can see that somebody visited but not which ad sent them —
            the visit is tracked, the lead is unattributed.
          </p>

          <CodeSnippet
            value={portal.meta_url_parameters}
            label="URL parameters"
            hint="Meta fills in the campaign, ad set and ad values itself. Only ad_id is used for reporting — the names are for readability."
          />

          <StepNav onBack={() => setStep(1)} onNext={() => setStep(VERIFY_STEP)} nextLabel="Next: verify" />
        </PdCard>
      )}

      {/* 4 — verify */}
      {shownStep === VERIFY_STEP && (
        <PdCard
          title="Check it's working"
          action={
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-[12px] text-pd-primary hover:underline"
            >
              <RefreshCw className={cn("size-3.5", polling && "animate-spin")} />
              Refresh
            </button>
          }
        >
          <p className="mb-3 text-[12.5px] leading-[1.5] text-pd-body">
            This updates by itself. The quickest test is to click one of the
            client&apos;s live ads yourself and submit the form.
          </p>
          <SetupChecklist diagnostics={portal.diagnostics} polling={polling} />
          <StepNav onBack={() => setStep(2)} />
        </PdCard>
      )}
    </div>
  )
}

function StepNav({ onBack, onNext, nextLabel }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-[10px] border border-pd-border px-3.5 py-2 text-[12.5px] text-pd-body hover:border-pd-border-strong"
        >
          Back
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          className="rounded-[10px] bg-pd-primary px-4 py-2 text-[12.5px] font-medium text-white hover:opacity-90"
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}
