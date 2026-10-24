"use client"

// First-run onboarding wizard. Full-screen, one step at a time, shown to a
// user the first time they log in (gated by /api/onboarding/status — see
// LoginForm + ProtectedLayout). Design: Paper's onboarding flow (top bar,
// scrolling body, pinned footer), built from the ds kit and token utilities.
//
// The wizard deliberately keeps the user busy while real work runs behind it:
// the first client's historical sync starts as soon as they confirm the
// client, and bulk import + the cron backfills continue after completion.
//
// OAuth steps (GHL / Meta / Slack) leave the page; wizard progress is
// persisted server-side before the hop (PUT /api/onboarding/state) and the
// settings page — which is where every provider's callback lands — bounces it
// back here via the handoff in lib/oauth-handoff. That module is also what
// keeps the settings page and the app shell from painting on the way through.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import getSymbolFromCurrency from "currency-symbol-map"
import { apiRequest } from "@/lib/api"
import { setOAuthHandoff, takeOAuthHandoff } from "@/lib/oauth-handoff"
import { EASE_OUT, EASE_SPRING } from "@/components/motion"
import { Button, Notice, Skeleton, Surface } from "@/components/ds"
import { cn } from "@/lib/utils"
import { useBirdy } from "@/components/birdy/use-birdy"
import { WizardFooterContext } from "./parts"
import BackgroundBadge from "./BackgroundBadge"
import ReviewStep from "./ReviewStep"
import BillingStep from "./BillingStep"
import { WelcomeStep, WelcomeNameStep, AgencyStep } from "./steps/WelcomeSteps"
import ConnectGhlStep from "./steps/ConnectGhlStep"
import ClientPickerStep from "./steps/ClientPickerStep"
import ConnectMetaStep from "./steps/ConnectMetaStep"
import MetaAdPickerStep from "./steps/MetaAdPickerStep"
import { SalesToolStep, HpKeyStep } from "./steps/SalesToolSteps"
import ClientConfirmStep from "./steps/ClientConfirmStep"
import ClientCurrencyStep from "./steps/ClientCurrencyStep"
import SyncPromptStep from "./steps/SyncPromptStep"
import { KpiTargetsStep, KpiDefaultStep } from "./steps/KpiSteps"
import { SlackConnectStep, SlackChannelStep } from "./steps/SlackSteps"
import ReportCopilotStep from "./steps/ReportCopilotStep"
import CompletionStep from "./steps/CompletionStep"
import { useStepData } from "./hooks/useStepData"
import { useReviewPolling } from "./hooks/useReviewPolling"
import { useSyncProgress } from "./hooks/useSyncProgress"
import { useFirstClient } from "./hooks/useFirstClient"
import {
  PHASE_LABEL,
  PHASE_OF,
  STEPS,
  STEPS_VERSION,
  buildTargetsPayload,
  resumeIndex,
} from "./wizard"

// How a step arrives and leaves. `custom` is the direction of travel (+1
// forward, -1 back): going forward a step slides in from the right and the
// old one slips out to the left, and the back button mirrors both, so the
// wizard reads as a strip you move along rather than a stack of screens. The
// exit is deliberately short — it is the entrance people should notice.
const STEP_VARIANTS = {
  enter: (direction) => ({ opacity: 0, x: 40 * direction, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease: EASE_SPRING } },
  exit: (direction) => ({ opacity: 0, x: -40 * direction, transition: { duration: 0.2, ease: EASE_OUT } }),
}

export default function OnboardingPage() {
  const router = useRouter()

  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  // Which way the last step change went, for STEP_VARIANTS. Updated alongside
  // stepIndex in goToIndex; the boot-time restore leaves it at forward.
  const [direction, setDirection] = useState(1)
  // The footer's right-hand slot, handed to steps through WizardFooterContext
  // so each can portal its own actions into the pinned footer.
  const [footerNode, setFooterNode] = useState(null)

  const [name, setName] = useState("")
  const [agency, setAgency] = useState("")

  // Connection states: checking | idle | connecting | error | success.
  //
  // "checking" is the initial value, not "idle", because boot() probes all
  // four integrations in the background and those probes take a moment. Coming
  // back from a GHL OAuth hop, an already-connected user was shown a live
  // "Connect GHL" button for as long as /api/status took to answer — pressing
  // it started a second, pointless round-trip. The button now can't be pressed
  // until we know whether it's needed at all.
  const [ghlStatus, setGhlStatus] = useState("checking")
  const [metaStatus, setMetaStatus] = useState("checking")
  const [slackStatus, setSlackStatus] = useState("checking")
  const [hpStatus, setHpStatus] = useState("checking")
  const [hpUid, setHpUid] = useState("")
  const [hpKey, setHpKey] = useState("")
  const [hpVisible, setHpVisible] = useState(false)
  const [hpError, setHpError] = useState("")

  const [salesTool, setSalesTool] = useState(null)

  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientNameConfirm, setClientNameConfirm] = useState("")

  const [adSearch, setAdSearch] = useState("")
  const [selectedAd, setSelectedAd] = useState(null)

  // Currency for the first client account, chosen on client_currency. Pre-set
  // from the Meta ad account when we know it — that is the currency the spend
  // figures are actually denominated in, so it's the right default and usually
  // the right answer.
  const [currency, setCurrency] = useState("")

  const [firstGroupId, setFirstGroupId] = useState(null)

  const [syncing, setSyncing] = useState(false)

  const [cpa, setCpa] = useState("")
  const [wins, setWins] = useState("")
  const [convRate, setConvRate] = useState("")
  // "Yes, set as default" rather than "Just this client" — which is what
  // decides whether the sub-accounts imported later get these targets too.
  const [kpiSaveDefault, setKpiSaveDefault] = useState(false)

  // What the server said when an OAuth hop could not even be started, which
  // the step's own error copy would otherwise talk over.
  const [oauthError, setOAuthError] = useState(null)
  const [channelSearch, setChannelSearch] = useState("")
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [savingReport, setSavingReport] = useState(false)
  const [reportError, setReportError] = useState(null)

  const [importing, setImporting] = useState(false)
  // How many sub-accounts the running import is for. Held separately from
  // pendingImportRef because that ref is deliberately emptied the moment the
  // import starts — see handleBillingSubscribed.
  const [importingCount, setImportingCount] = useState(0)
  const [completing, setCompleting] = useState(false)

  // Selected sub-accounts payload from ReviewStep, held here while the
  // mandatory billing step runs — runImport actually fires only after
  // BillingStep confirms an active subscription.
  const pendingImportRef = useRef(null)

  // ── Step machinery ──────────────────────────────────────────────────────

  // One step is conditional: hp_key only exists for a Hot Prospector user.
  // Filtering it out (rather than jumping over it) keeps stepIndex meaningful
  // — "Step 12 of 17" counts what this particular user will actually be asked.
  //
  // The three Slack configuration steps used to be conditional too, on an "I
  // don't use Slack" answer. Slack is now required, so they always show; a
  // stored opt-out from before that change is ignored rather than honoured,
  // since honouring it would finish an account with notifications silently
  // switched off and nothing on screen saying so.
  const visibleSteps = useMemo(
    () => STEPS.filter((s) => (s === "hp_key" ? salesTool === "hp" : true)),
    [salesTool]
  )
  const currentKey = visibleSteps[Math.min(stepIndex, visibleSteps.length - 1)]
  const phase = PHASE_OF[currentKey]

  const { state: birdyState, flash: flashBirdy } = useBirdy()
  useEffect(() => {
    if (currentKey === "completion") flashBirdy("celebrate")
  }, [currentKey, flashBirdy])

  const persistState = useCallback((payload) => {
    apiRequest("/api/onboarding/state", {
      method: "PUT",
      body: JSON.stringify(payload),
    }).catch(() => {})
  }, [])

  const goToIndex = useCallback(
    (idx, dataPatch) => {
      const clamped = Math.max(0, Math.min(idx, visibleSteps.length - 1))
      setDirection(clamped < stepIndex ? -1 : 1)
      setStepIndex(clamped)
      persistState({ step: clamped, data: { ...(dataPatch || {}), steps_version: STEPS_VERSION } })
    },
    [visibleSteps.length, stepIndex, persistState]
  )

  const next = useCallback(
    (dataPatch) => goToIndex(stepIndex + 1, dataPatch),
    [stepIndex, goToIndex]
  )
  const back = useCallback(() => goToIndex(stepIndex - 1), [stepIndex, goToIndex])
  const goToKey = useCallback(
    (key, dataPatch) => goToIndex(visibleSteps.indexOf(key), dataPatch),
    [visibleSteps, goToIndex]
  )

  const {
    creationState,
    creationError,
    pendingTargetsRef,
    applyTargets,
    startFirstClientCreation,
    flushPendingTargets,
    applyTargetsToAllClients,
  } = useFirstClient({
    firstGroupId,
    setFirstGroupId,
    selectedClient,
    selectedAd,
    clientNameConfirm,
    salesTool,
    currency,
    persistState,
  })

  // ── Boot: resume server-side state + probe integrations ─────────────────

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      // Arriving here is what "the hop is over" means, so the return path is
      // spent — whether it was proxy.js that acted on it or the settings page.
      // Only the cookie half is self-clearing; left behind, the sessionStorage
      // half would still be sitting there weeks later, and would hijack the
      // next callback the user started from the settings page on purpose.
      takeOAuthHandoff()
      try {
        const res = await apiRequest("/api/onboarding/status")
        if (!res.ok) throw new Error(`status ${res.status}`)
        const state = await res.json()
        if (cancelled) return

        if (state.completed) {
          localStorage.removeItem("onboarding_incomplete")
          router.replace("/clients")
          return
        }
        localStorage.setItem("onboarding_incomplete", "1")

        const data = state.data || {}
        if (data.name) setName(data.name)
        if (data.agency) setAgency(data.agency)
        else if (state.agency_name) setAgency(state.agency_name)
        if (data.sales_tool) setSalesTool(data.sales_tool)
        if (data.currency) setCurrency(data.currency)
        else if (state.default_currency) setCurrency(state.default_currency)
        if (data.first_client) {
          if (data.first_client.ghl_location_id) {
            setSelectedClient({ id: data.first_client.ghl_location_id, name: data.first_client.name })
          }
          if (data.first_client.name) setClientNameConfirm(data.first_client.name)
          if (data.first_client.group_id) setFirstGroupId(data.first_client.group_id)
          if (data.first_client.meta_ad_account_id) {
            setSelectedAd({
              id: data.first_client.meta_ad_account_id,
              currency: data.first_client.currency || null,
            })
          }
        }
        if (data.kpi) {
          setCpa(data.kpi.cpa || "")
          setWins(data.kpi.wins || "")
          setConvRate(data.kpi.conv_rate || "")
          // Restored because the import — where this decides whether every
          // client gets the targets — happens after billing, and a Whop
          // checkout can leave the page in between.
          setKpiSaveDefault(Boolean(data.kpi.save_default))
          // The other way targets went missing. Answering the KPI step before
          // the first client group exists parks them in pendingTargetsRef for
          // createFirstClient to apply once it has an id — but that ref is
          // memory only, and client creation is the slowest thing in the
          // wizard, so an OAuth hop or a refresh in between dropped them with
          // nothing left to notice. The answers themselves were persisted; it
          // was only the instruction to apply them that wasn't.
          if (!data.first_client?.group_id) {
            pendingTargetsRef.current = buildTargetsPayload({
              cpa: data.kpi.cpa,
              wins: data.kpi.wins,
              convRate: data.kpi.conv_rate,
              saveAsDefault: Boolean(data.kpi.save_default),
            })
          }
        }
        if (data.slack) {
          if (data.slack.channel_id) {
            setSelectedChannel({ id: data.slack.channel_id, name: data.slack.channel_name })
          }
        }
        if (data.wants_sync) setSyncing(true)
        // Recover the sub-accounts picked in ReviewStep if a checkout redirect
        // (or an impatient refresh during "Activating your subscription…")
        // reloaded the page while the billing step was waiting on it — an
        // in-memory ref alone doesn't survive that.
        if (Array.isArray(data.pending_import)) pendingImportRef.current = data.pending_import

        if (!cancelled) setStepIndex(resumeIndex(state.step, data))

        // Probe live connection status in the background so a returning OAuth
        // hop shows green — deliberately not awaited: first paint shouldn't
        // wait on three integration round-trips.
        //
        // Every path out of a probe must land the status somewhere other than
        // "checking", including the failures. A probe that errors leaves the
        // step showing a spinner forever otherwise, which is a worse failure
        // than the "clickable too early" one this replaced: "idle" at least
        // offers the user the Connect button, which is the correct recovery
        // when we genuinely don't know whether they're connected.
        apiRequest("/api/status")
          .then(async (res) => {
            if (cancelled) return
            const s = res.ok ? await res.json() : null
            setGhlStatus(s?.gohighlevel?.agency?.connected ? "success" : "idle")
            setMetaStatus(s?.facebook?.connected ? "success" : "idle")
          })
          .catch(() => {
            if (cancelled) return
            setGhlStatus("idle")
            setMetaStatus("idle")
          })
        apiRequest("/api/integrations/slack/status")
          .then(async (res) => {
            if (cancelled) return
            const s = res.ok ? await res.json() : null
            // An install Slack has since refused is not a connection. Treated
            // as one, the step said "Slack connected", waved the user on, and
            // left them at the channel picker — the first screen that
            // actually tries the token — with nothing to pick and no idea
            // why. It reads as idle so the step offers the one thing that
            // fixes it: connecting again.
            setSlackStatus(s?.installed && !s?.needs_reconnect ? "success" : "idle")
          })
          .catch(() => { if (!cancelled) setSlackStatus("idle") })
        apiRequest("/api/hotprospector/status")
          .then(async (res) => {
            if (cancelled) return
            const s = res.ok ? await res.json() : null
            setHpStatus(s?.connected ? "success" : "idle")
          })
          .catch(() => { if (!cancelled) setHpStatus("idle") })
      } catch (e) {
        console.error("Onboarding boot failed:", e)
        if (!cancelled) setBootError("Couldn't load your onboarding progress. Refresh to try again.")
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    boot()
    return () => { cancelled = true }
  }, [router])

  // ── Per-step data and background work ──────────────────────────────────

  const { locations, locationsError, adAccounts, adError, channels, setChannels, channelsError } =
    useStepData({ booting, currentKey, ghlStatus, metaStatus, slackStatus })
  const { review, reviewSettled } = useReviewPolling({ booting, currentKey })
  const { syncGhlPct, syncMetaPct } = useSyncProgress({ syncing, firstGroupId, selectedAd })

  // ── OAuth hops ──────────────────────────────────────────────────────────

  const startOAuth = useCallback(
    async (endpoint, setStatus) => {
      setStatus("connecting")
      setOAuthError(null)
      try {
        setOAuthHandoff("/onboarding")
        const res = await apiRequest(endpoint)
        const d = await res.json()
        if (!res.ok || !d.auth_url) throw new Error(d?.detail || "No auth URL")
        window.location.href = d.auth_url
      } catch (e) {
        console.error(`OAuth start failed for ${endpoint}:`, e)
        // The step's own copy assumes the user got as far as the provider and
        // closed the window. When the request never left Birdy — the server
        // saying the integration is not configured, say — that copy blames
        // them for something they did not do and names a cause they cannot
        // act on. What the server said is more use than what we guessed.
        setOAuthError(String(e.message || e))
        setStatus("error")
      }
    },
    []
  )

  // ── Hot Prospector ──────────────────────────────────────────────────────

  const connectHp = useCallback(async () => {
    if (!hpUid.trim() || !hpKey.trim()) return
    setHpStatus("connecting")
    setHpError("")
    try {
      const res = await apiRequest("/api/hotprospector/connect", {
        method: "POST",
        body: JSON.stringify({ api_uid: hpUid.trim(), api_key: hpKey.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.detail || "Connection failed")
      setHpStatus("success")
    } catch (e) {
      setHpError(String(e.message || e))
      setHpStatus("error")
    }
  }, [hpUid, hpKey])

  // ── Background sync badge ───────────────────────────────────────────────

  const showSyncBadge =
    syncing && (syncGhlPct < 100 || syncMetaPct < 100) && currentKey !== "sync_prompt"

  // ── Step actions ────────────────────────────────────────────────────────

  const acceptSync = useCallback(() => {
    setSyncing(true)
    // Kick off the background review prep: mints location tokens, pulls each
    // sub-account's most-recent lead, and resolves Facebook matches so the
    // review step opens with real activity flags.
    apiRequest("/api/onboarding/prepare-review", { method: "POST" }).catch(() => {})
    goToKey("kpi_targets", { wants_sync: true })
  }, [goToKey])

  const applyKpiTargets = useCallback(
    (saveAsDefault) => {
      const targets = buildTargetsPayload({ cpa, wins, convRate, saveAsDefault })
      if (targets) {
        if (firstGroupId) {
          applyTargets(firstGroupId, targets)
        } else {
          // Park them, then go looking for the group anyway. Parking alone was
          // the bug: the ref is only drained by createFirstClient, which
          // returns early when the client already exists — so anyone answering
          // this step on a resumed wizard was told "Targets applied" while no
          // request was ever made. Nothing in the console, nothing in the
          // network tab, and a client whose Targets tab stayed empty.
          pendingTargetsRef.current = targets
          flushPendingTargets()
        }
      }
      setKpiSaveDefault(saveAsDefault)
      next({ kpi: { cpa, wins, conv_rate: convRate, save_default: saveAsDefault } })
    },
    [cpa, wins, convRate, firstGroupId, applyTargets, flushPendingTargets, next]
  )

  const saveChannel = useCallback(() => {
    if (!selectedChannel) {
      // Reachable only when the channel list failed to load. Persisting a
      // `slack` object here would write an empty one over whatever channel
      // the account already has configured — which, on the account that
      // exposed this path, was a working brief channel it had been using
      // for weeks. Moving on without writing leaves it as it is.
      next()
      return
    }
    apiRequest("/api/integrations/slack/channel", {
      method: "PUT",
      body: JSON.stringify({ channel_id: selectedChannel.id, channel_name: selectedChannel.name }),
    }).catch(() => {})
    next({ slack: { channel_id: selectedChannel.id, channel_name: selectedChannel.name } })
  }, [selectedChannel, next])

  // The report copilot's "Use this report": store the template it designed as
  // the live Slack report, then move on. Saving can fail only if Slack was
  // disconnected in between, which the user has to hear about rather than
  // finish with no report going out.
  const saveReport = useCallback(async (template) => {
    setSavingReport(true)
    setReportError(null)
    try {
      const res = await apiRequest("/api/integrations/slack/brief", {
        method: "PUT",
        body: template ? JSON.stringify({ template }) : JSON.stringify({ frequency: "daily", time: "9:00 AM" }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const { brief } = await res.json()
      next({ slack: {
        channel_id: selectedChannel?.id,
        channel_name: selectedChannel?.name,
        frequency: brief.frequency, time: brief.time, day: brief.day,
      } })
    } catch {
      setReportError("Couldn't save your report. Check Slack is still connected, then try again.")
    } finally {
      setSavingReport(false)
    }
  }, [selectedChannel, next])

  const runImport = useCallback(
    async (accounts) => {
      setImporting(true)
      try {
        if (accounts.length > 0) {
          const res = await apiRequest("/api/onboarding/import-subaccounts", {
            method: "POST",
            body: JSON.stringify({ accounts }),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            console.error("Bulk import failed:", d)
          }
        }
        goToKey("completion")
      } finally {
        setImporting(false)
      }
    },
    [goToKey]
  )

  // ReviewStep's "Import" button lands here instead of hitting the API
  // directly. Nothing selected means nothing to load and nothing to pay
  // for, so that case skips billing entirely; otherwise payment is a hard
  // gate before import-subaccounts (the actual client-data load) ever runs.
  //
  // The payload is persisted server-side (not just kept in the ref) because
  // a Whop checkout can leave the page for 3DS/BNPL, and a human waiting on
  // "Activating your subscription…" can just as easily hit refresh — either
  // one wipes an in-memory ref and would otherwise import zero accounts.
  const handleReviewContinue = useCallback(
    (accounts) => {
      if (!accounts.length) {
        goToKey("completion")
        return
      }
      pendingImportRef.current = accounts
      goToKey("billing", { pending_import: accounts })
    },
    [goToKey]
  )

  // BillingStep confirmed (or found) an active subscription — proceed with
  // the import that was waiting on it.
  const handleBillingSubscribed = useCallback(() => {
    const accounts = pendingImportRef.current || []
    // Record how many before the ref is emptied. Clearing it is what stops a
    // second import firing, but it is also what the billing step was counting,
    // and runImport's own re-render arrived after the clear — so the line that
    // is supposed to read "Bringing in your 25 sub-accounts…" said 0, for the
    // whole import, on the one screen where that number is the only evidence
    // anything is happening at all.
    setImportingCount(accounts.length)
    pendingImportRef.current = null
    persistState({ data: { pending_import: [] } })
    runImport(accounts)
  }, [runImport, persistState])

  // Where "Take a look at Birdy" lands. The point of the wizard is the client
  // they just set up, so it opens that client — not the hub, which is a list
  // they have no reason to read yet.
  //
  // firstGroupId is the in-memory answer, but it is not a reliable one on its
  // own: it is set when the background creation resolves, and the OAuth hops,
  // a Whop checkout redirect and a plain refresh all wipe React state between
  // then and here. boot() restores it, so usually it is there — but "usually"
  // is how someone ends up on the hub wondering where their client went. So
  // the server-side copy is the fallback, and the group list after that.
  const finish = useCallback(async () => {
    setCompleting(true)
    // Last chance for targets that never found a group — answered before the
    // client existed, or on a wizard someone resumed. By here the group is as
    // findable as it is ever going to be.
    const groupId = await flushPendingTargets()
    // Then the rest of them, if the targets were meant for everyone. Awaited
    // rather than fired off: the next thing this does is navigate, and a page
    // that has moved on cancels its own in-flight requests.
    if (kpiSaveDefault) {
      const targets = buildTargetsPayload({ cpa, wins, convRate, saveAsDefault: false })
      if (targets) await applyTargetsToAllClients(targets)
    }
    try {
      await apiRequest("/api/onboarding/complete", { method: "POST" })
    } catch { /* flag stays server-side incomplete; still let them in */ }
    localStorage.removeItem("onboarding_incomplete")
    router.push(groupId ? `/clients/${groupId}` : "/clients")
  }, [router, flushPendingTargets, kpiSaveDefault, cpa, wins, convRate, applyTargetsToAllClients])

  // ── Derived lists ───────────────────────────────────────────────────────

  const clientDisplayName = clientNameConfirm.trim() || selectedClient?.name || "your first client"

  // The targets step asks for a cost-per-acquisition and a Slack preview
  // quotes one back. Both used to be hardcoded to £, which read as a
  // conversion to anyone who had just told us they work in dollars — the
  // number they typed was their own currency, but the wizard relabelled it.
  // Falls back to the picker's own default rather than to $, so a user who
  // reaches the targets step before the currency step still sees one
  // consistent symbol.
  const currencySymbol =
    getSymbolFromCurrency(currency || selectedAd?.currency || "GBP") || "£"

  // ── Layout ──────────────────────────────────────────────────────────────

  if (booting) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex w-full max-w-[560px] flex-col items-center px-5">
          <Skeleton className="mb-6 size-20 rounded-full" />
          <Skeleton className="mb-3 h-7 w-3/5" />
          <Skeleton className="mb-8 h-4 w-4/5" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-6">
        <Surface className="flex max-w-md flex-col items-start gap-4 p-8 shadow-floating">
          <div className="text-lg font-semibold text-foreground">Something went wrong</div>
          <Notice tone="danger" className="w-full">{bootError}</Notice>
          <Button variant="primary" size="lg" onClick={() => window.location.reload()}>Reload</Button>
        </Surface>
      </div>
    )
  }

  const stepNum = Math.max(stepIndex, 1)
  const stepTotal = visibleSteps.length - 1
  // How far through its own phase the current step is, for the half-filled
  // segment: the fourth of five "First client" steps fills it four fifths.
  const inPhase = visibleSteps.filter((key) => PHASE_OF[key] === phase)
  const phaseFraction = (inPhase.indexOf(currentKey) + 1) / (inPhase.length || 1)
  // The two centred hero screens; every other step is a left-aligned column.
  const hero = currentKey === "welcome" || currentKey === "completion"

  return (
    // The wizard owns the whole viewport rather than floating as a card on a
    // grey page. It is the only thing the user can do at this point — there is
    // no app behind it to look at — so the card's border, shadow and 1080px cap
    // were framing emptiness. Full-bleed also stops the taller steps (the
    // sub-accounts table, the billing tiers) scrolling inside a box that is
    // itself shorter than the screen.
    <MotionConfig reducedMotion="user">
    <WizardFooterContext.Provider value={footerNode}>
    <div className="flex h-svh flex-col bg-background">
      <div className="relative flex h-full w-full flex-col overflow-hidden">

        {/* top bar */}
        {currentKey !== "welcome" && (
          <div className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 px-4 sm:px-6">
            <span className="shrink-0 text-xs font-medium text-primary">{PHASE_LABEL[phase]}</span>
            {/* Each segment is a track with a fill that grows from the
                left as its phase is reached, and empties again if the
                user backs out of it. Done phases are full, the current one
                is as far along as the step is within it, the rest empty. */}
            <div
              className="flex min-w-0 flex-1 justify-center gap-1.5"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={1}
              aria-valuemax={stepTotal}
              aria-valuenow={stepNum}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                <div key={p} className="h-1.5 min-w-2 max-w-12 flex-1 overflow-hidden rounded-[3px] bg-border">
                  <motion.div
                    className="h-full w-full origin-left rounded-[3px] bg-primary"
                    initial={false}
                    animate={{ scaleX: p < phase ? 1 : p === phase ? phaseFraction : 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                  />
                </div>
              ))}
            </div>
            <span className="num shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              Step {stepNum} of {stepTotal}
            </span>
            {/* There is no Exit here, and "Skip for now" used to live in its
                place. Both were removed deliberately: onboarding gates the
                app, so there is nowhere to exit to, and every step a skip let
                people past — the first client, the KPI targets, the sales
                tool — is something the product cannot work without, so
                skipping produced an account that looked set up and showed
                nothing. Steps that genuinely are optional now say so in their
                own words ("I don't currently call my leads", "I don't use
                Slack") rather than being bypassed by a generic escape hatch
                that also skipped the things that weren't optional. */}
          </div>
        )}

        <BackgroundBadge
          creationState={creationState}
          creationError={creationError}
          clientDisplayName={clientDisplayName}
          startFirstClientCreation={startFirstClientCreation}
          showSyncBadge={showSyncBadge}
          syncGhlPct={syncGhlPct}
          syncMetaPct={syncMetaPct}
        />

        {/* content */}
        <div className={cn("relative min-h-0 flex-1 overflow-y-auto px-4 sm:px-6", hero ? "py-8" : "pb-10 pt-8 sm:pt-16")}>

          {/* One step on screen at a time, keyed so a change of step is a
              change of element: the old one plays its exit, the new one its
              entrance (STEP_VARIANTS). initial={false} keeps the step the
              wizard boots onto from sliding in from nowhere on a reload.
              The wrapper fills the content area and centres its child
              horizontally (the hero steps vertically too), and, being
              transformed, it is what sync_prompt's inset-0 confetti layer is
              positioned against, so it has to be the full area. */}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentKey}
              className={cn("relative flex min-h-full w-full flex-col items-center", hero && "justify-center")}
              custom={direction}
              variants={STEP_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
            >

          {currentKey === "welcome" && <WelcomeStep next={next} birdyState={birdyState} />}

          {currentKey === "welcome_name" && <WelcomeNameStep name={name} setName={setName} next={next} />}

          {currentKey === "agency" && (
            <AgencyStep name={name} agency={agency} setAgency={setAgency} next={next} />
          )}

          {currentKey === "connect_ghl" && (
            <ConnectGhlStep
              name={name}
              ghlStatus={ghlStatus}
              setGhlStatus={setGhlStatus}
              startOAuth={startOAuth}
              oauthError={oauthError}
              next={next}
            />
          )}

          {currentKey === "client_picker" && (
            <ClientPickerStep
              ghlStatus={ghlStatus}
              locations={locations}
              locationsError={locationsError}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              selectedClient={selectedClient}
              setSelectedClient={setSelectedClient}
              setClientNameConfirm={setClientNameConfirm}
              persistState={persistState}
              next={next}
            />
          )}

          {currentKey === "connect_meta" && (
            <ConnectMetaStep
              metaStatus={metaStatus}
              setMetaStatus={setMetaStatus}
              startOAuth={startOAuth}
              oauthError={oauthError}
              next={next}
            />
          )}

          {currentKey === "meta_ad_picker" && (
            <MetaAdPickerStep
              clientDisplayName={clientDisplayName}
              metaStatus={metaStatus}
              adAccounts={adAccounts}
              adError={adError}
              adSearch={adSearch}
              setAdSearch={setAdSearch}
              selectedAd={selectedAd}
              setSelectedAd={setSelectedAd}
              selectedClient={selectedClient}
              clientNameConfirm={clientNameConfirm}
              persistState={persistState}
              next={next}
            />
          )}

          {currentKey === "sales_tool" && (
            <SalesToolStep ghlStatus={ghlStatus} salesTool={salesTool} setSalesTool={setSalesTool} next={next} />
          )}

          {currentKey === "hp_key" && (
            <HpKeyStep
              hpStatus={hpStatus}
              hpUid={hpUid}
              setHpUid={setHpUid}
              hpKey={hpKey}
              setHpKey={setHpKey}
              hpVisible={hpVisible}
              setHpVisible={setHpVisible}
              hpError={hpError}
              connectHp={connectHp}
              next={next}
            />
          )}

          {currentKey === "client_confirm" && (
            <ClientConfirmStep
              clientNameConfirm={clientNameConfirm}
              setClientNameConfirm={setClientNameConfirm}
              selectedClient={selectedClient}
              selectedAd={selectedAd}
              firstGroupId={firstGroupId}
              currency={currency}
              next={next}
            />
          )}

          {currentKey === "client_currency" && (
            <ClientCurrencyStep
              clientDisplayName={clientDisplayName}
              selectedAd={selectedAd}
              currency={currency}
              setCurrency={setCurrency}
              startFirstClientCreation={startFirstClientCreation}
              next={next}
            />
          )}

          {currentKey === "sync_prompt" && (
            <SyncPromptStep clientDisplayName={clientDisplayName} acceptSync={acceptSync} />
          )}

          {currentKey === "kpi_targets" && (
            <KpiTargetsStep
              clientDisplayName={clientDisplayName}
              currencySymbol={currencySymbol}
              cpa={cpa}
              setCpa={setCpa}
              wins={wins}
              setWins={setWins}
              convRate={convRate}
              setConvRate={setConvRate}
              next={next}
            />
          )}

          {currentKey === "kpi_default" && <KpiDefaultStep applyKpiTargets={applyKpiTargets} />}

          {currentKey === "slack_connect" && (
            <SlackConnectStep
              slackStatus={slackStatus}
              setSlackStatus={setSlackStatus}
              startOAuth={startOAuth}
              oauthError={oauthError}
              next={next}
            />
          )}

          {currentKey === "slack_channel" && (
            <SlackChannelStep
              clientDisplayName={clientDisplayName}
              currencySymbol={currencySymbol}
              cpa={cpa}
              channels={channels}
              setChannels={setChannels}
              channelsError={channelsError}
              channelSearch={channelSearch}
              setChannelSearch={setChannelSearch}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              setSlackStatus={setSlackStatus}
              startOAuth={startOAuth}
              saveChannel={saveChannel}
            />
          )}

          {currentKey === "report_copilot" && (
            <ReportCopilotStep
              selectedChannel={selectedChannel}
              saveReport={saveReport}
              savingReport={savingReport}
              reportError={reportError}
            />
          )}

          {currentKey === "sub_accounts_review" && (
            <ReviewStep
              review={review}
              settled={reviewSettled}
              importing={false}
              onImport={handleReviewContinue}
            />
          )}

          {currentKey === "billing" && (
            <BillingStep
              accountCount={importing ? importingCount : (pendingImportRef.current || []).length}
              onSubscribed={handleBillingSubscribed}
              importing={importing}
            />
          )}

          {currentKey === "completion" && (
            <CompletionStep
              name={name}
              agency={agency}
              birdyState={birdyState}
              clientDisplayName={clientDisplayName}
              creationState={creationState}
              creationError={creationError}
              startFirstClientCreation={startFirstClientCreation}
              finish={finish}
              completing={completing}
            />
          )}
            </motion.div>
          </AnimatePresence>

        </div>

        {/* footer — pinned, never scrolls. Back lives here; the step's own
            actions arrive in the right-hand slot through WizardFooter. */}
        {currentKey !== "welcome" && (
          <div className="flex h-[72px] shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-background px-4 sm:px-6">
            <div>
              {stepIndex > 0 && (
                <Button variant="outline" size="lg" onClick={back}>Back</Button>
              )}
            </div>
            <div ref={setFooterNode} className="flex items-center gap-3" />
          </div>
        )}
      </div>
    </div>
    </WizardFooterContext.Provider>
    </MotionConfig>
  )
}
