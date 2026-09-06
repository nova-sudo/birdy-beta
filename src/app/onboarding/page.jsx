"use client"

// First-run onboarding wizard. Full-screen, one step at a time, shown to a
// user the first time they log in (gated by /api/onboarding/status — see
// LoginForm + ProtectedLayout). Design: design_handoff_onboarding bundle;
// same pd-* token palette as the Portfolio Dashboard.
//
// The wizard deliberately keeps the user busy while real work runs behind it:
// the first client's historical sync starts as soon as they confirm the
// client, and bulk import + the cron backfills continue after completion.
//
// OAuth steps (GHL / Meta / Slack) leave the page; wizard progress is
// persisted server-side before the hop (PUT /api/onboarding/state) and the
// settings page bounces the callback back here via the existing
// sessionStorage.post_integration_redirect convention.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import getSymbolFromCurrency from "currency-symbol-map"
import {
  AlertCircle,
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  PhoneOff,
  Phone,
  RotateCcw,
} from "lucide-react"
import { apiRequest } from "@/lib/api"
import { STORAGE_KEYS } from "@/lib/constants"
import { pdFontClass } from "@/lib/pd-fonts"
import Birdy from "@/components/birdy/Birdy"
import { useBirdy } from "@/components/birdy/use-birdy"
import {
  FacebookGlyph,
  FakeProgressBar,
  IconChip,
  InitialsAvatar,
  PickList,
  PrimaryButton,
  ProgressBar,
  SearchInput,
  SecondaryButton,
  SlackGlyph,
  SlackPreviewCard,
  SpinnerRing,
  StepHeading,
  SuccessRow,
  UnderlineInput,
} from "./parts"
import ReviewStep from "./ReviewStep"
import BillingStep from "./BillingStep"

const STEPS = [
  "welcome", "welcome_name", "agency", "connect_ghl",
  "client_picker", "connect_meta", "meta_ad_picker", "sales_tool", "hp_key",
  "client_confirm", "client_currency", "sync_prompt",
  "kpi_targets", "kpi_default", "slack_connect", "slack_channel",
  "slack_frequency", "brief_content", "sub_accounts_review", "billing", "completion",
]

const PHASE_OF = {
  welcome: 1, welcome_name: 1, agency: 1,
  connect_ghl: 2, connect_meta: 2,
  sales_tool: 3, hp_key: 3,
  client_picker: 4, client_confirm: 4, client_currency: 4, meta_ad_picker: 4, sync_prompt: 4,
  kpi_targets: 5, kpi_default: 5,
  slack_connect: 6, slack_channel: 6, slack_frequency: 6, brief_content: 6,
  sub_accounts_review: 7, billing: 8, completion: 9,
}

const PHASE_LABEL = {
  1: "Welcome", 2: "Core connections", 3: "Sales stack", 4: "First client",
  5: "KPI targets", 6: "Notifications", 7: "Sub-accounts", 8: "Billing", 9: "Finished",
}

// Dropped wholesale when the user says they have no Slack workspace.
const SLACK_CONFIG_STEPS = ["slack_channel", "slack_frequency", "brief_content"]

// The twelve the sign-up form used to offer, before currency moved in here.
// Mirrored server-side by SUPPORTED_CURRENCIES in routers/onboarding.py, which
// is what actually guards users.default_currency.
const CURRENCY_OPTIONS = [
  { code: "GBP", label: "British Pound" },
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "AED", label: "UAE Dirham" },
  { code: "SAR", label: "Saudi Riyal" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "INR", label: "Indian Rupee" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CNY", label: "Chinese Yuan" },
]

const TIME_OPTIONS = ["7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "12:00 PM", "5:00 PM"]
const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

const BRIEF_DEFS = [
  { id: "spend", label: "Ad spend summary", desc: "Yesterday's spend across all ad accounts", rec: true },
  { id: "leads", label: "Lead volume", desc: "New leads captured in the period", rec: true },
  { id: "conversion", label: "Conversion rate", desc: "Leads converting to booked or won", rec: true },
  { id: "top", label: "Top performer", desc: "Your best client or ad set right now", rec: true },
  { id: "alerts", label: "Alerts triggered", desc: "Anything that crossed a threshold", rec: true },
  { id: "underperform", label: "Underperforming ads", desc: "Ads worth pausing or reviewing", rec: false },
]

const DEFAULT_BRIEF_ITEMS = {
  spend: true, leads: true, conversion: true, top: true, alerts: true, underperform: false,
}

const CONFETTI_COLORS = ["#6B4EE6", "#3B7DD6", "#25A55F", "#E0920A", "#E5484D", "#A98BF5"]

export default function OnboardingPage() {
  const router = useRouter()

  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)

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

  const [locations, setLocations] = useState(null)
  const [locationsError, setLocationsError] = useState(null)
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientNameConfirm, setClientNameConfirm] = useState("")

  const [adAccounts, setAdAccounts] = useState(null)
  const [adError, setAdError] = useState(null)
  const [adSearch, setAdSearch] = useState("")
  const [selectedAd, setSelectedAd] = useState(null)

  // Currency for the first client account, chosen on client_currency. Pre-set
  // from the Meta ad account when we know it — that is the currency the spend
  // figures are actually denominated in, so it's the right default and usually
  // the right answer.
  const [currency, setCurrency] = useState("")

  const [firstGroupId, setFirstGroupId] = useState(null)
  const [creationError, setCreationError] = useState(null)
  // idle | creating | done | error. The wizard no longer waits on this: see
  // startFirstClientCreation.
  const [creationState, setCreationState] = useState("idle")

  const [syncing, setSyncing] = useState(false)
  const [syncGhlPct, setSyncGhlPct] = useState(0)
  const [syncMetaPct, setSyncMetaPct] = useState(0)

  const [cpa, setCpa] = useState("")
  const [wins, setWins] = useState("")
  const [convRate, setConvRate] = useState("")

  const [channels, setChannels] = useState(null)
  const [channelSearch, setChannelSearch] = useState("")
  const [selectedChannel, setSelectedChannel] = useState(null)
  // "I don't use Slack" — drops the channel/frequency/brief steps rather than
  // stranding a user with no workspace on a step they cannot complete. Slack
  // is the one connection Birdy genuinely works without.
  const [slackOptOut, setSlackOptOut] = useState(false)
  const [frequency, setFrequency] = useState(null)
  const [notifyTime, setNotifyTime] = useState("9:00 AM")
  const [notifyDay, setNotifyDay] = useState("Monday")
  const [briefItems, setBriefItems] = useState(DEFAULT_BRIEF_ITEMS)

  const [review, setReview] = useState(null)
  const [reviewSettled, setReviewSettled] = useState(false)
  const [importing, setImporting] = useState(false)
  const [completing, setCompleting] = useState(false)

  const pendingTargetsRef = useRef(null)
  // Selected sub-accounts payload from ReviewStep, held here while the
  // mandatory billing step runs — runImport actually fires only after
  // BillingStep confirms an active subscription.
  const pendingImportRef = useRef(null)

  // ── Step machinery ──────────────────────────────────────────────────────

  // Two steps are conditional. hp_key only exists for a Hot Prospector user,
  // and the three Slack configuration steps only exist for someone who has a
  // Slack workspace to configure. Filtering them out (rather than jumping over
  // them) keeps stepIndex meaningful: "Step 12 of 17" counts what this
  // particular user will actually be asked.
  const visibleSteps = useMemo(
    () =>
      STEPS.filter((s) => {
        if (s === "hp_key") return salesTool === "hp"
        if (SLACK_CONFIG_STEPS.includes(s)) return !slackOptOut
        return true
      }),
    [salesTool, slackOptOut]
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
      setStepIndex(clamped)
      persistState({ step: clamped, ...(dataPatch ? { data: dataPatch } : {}) })
    },
    [visibleSteps.length, persistState]
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

  // ── Boot: resume server-side state + probe integrations ─────────────────

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
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
        if (data.slack_opt_out) setSlackOptOut(true)
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
        }
        if (data.slack) {
          if (data.slack.channel_id) {
            setSelectedChannel({ id: data.slack.channel_id, name: data.slack.channel_name })
          }
          if (data.slack.frequency) setFrequency(data.slack.frequency)
          if (data.slack.time) setNotifyTime(data.slack.time)
          if (data.slack.day) setNotifyDay(data.slack.day)
          if (data.slack.brief_items) setBriefItems({ ...DEFAULT_BRIEF_ITEMS, ...data.slack.brief_items })
        }
        if (data.wants_sync) setSyncing(true)
        // Recover the sub-accounts picked in ReviewStep if a checkout redirect
        // (or an impatient refresh during "Activating your subscription…")
        // reloaded the page while the billing step was waiting on it — an
        // in-memory ref alone doesn't survive that.
        if (Array.isArray(data.pending_import)) pendingImportRef.current = data.pending_import

        const visible = STEPS.filter((s) => {
          if (s === "hp_key") return data.sales_tool === "hp"
          if (SLACK_CONFIG_STEPS.includes(s)) return !data.slack_opt_out
          return true
        })
        if (!cancelled) setStepIndex(Math.min(state.step || 0, visible.length - 1))

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
            setSlackStatus(s?.installed ? "success" : "idle")
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

  // ── Lazy data per step ──────────────────────────────────────────────────

  useEffect(() => {
    if (booting) return
    if (currentKey === "client_picker" && locations === null && ghlStatus === "success") {
      apiRequest("/api/subaccount/locations")
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json())?.detail || `status ${res.status}`)
          const d = await res.json()
          setLocations(d.locations || [])
        })
        .catch((e) => setLocationsError(String(e.message || e)))
    }
    if (currentKey === "meta_ad_picker" && adAccounts === null && metaStatus === "success") {
      apiRequest("/api/facebook/adaccounts")
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json())?.detail || `status ${res.status}`)
          const d = await res.json()
          setAdAccounts(d?.data?.data || [])
        })
        .catch((e) => setAdError(String(e.message || e)))
    }
    if (currentKey === "slack_channel" && channels === null && slackStatus === "success") {
      apiRequest("/api/integrations/slack/channels")
        .then(async (res) => {
          if (!res.ok) throw new Error("channels")
          const d = await res.json()
          setChannels(d.channels || [])
        })
        .catch(() => setChannels([]))
    }
  }, [booting, currentKey, locations, adAccounts, channels, ghlStatus, metaStatus, slackStatus])

  // Review step: poll while the background prep job (kicked off at
  // acceptSync) is still checking sub-accounts, so the table opens with real
  // 90/30-day activity flags. Gives up after ~100s and shows what's known.
  useEffect(() => {
    if (booting || currentKey !== "sub_accounts_review") return
    let cancelled = false
    let ticks = 0
    let timer
    const tick = async () => {
      ticks += 1
      let settled = true
      try {
        const res = await apiRequest("/api/onboarding/subaccounts-review")
        if (cancelled) return
        if (!res.ok) throw new Error("review")
        const d = await res.json()
        setReview(d)
        settled = d?.prep?.status !== "running"
      } catch {
        if (!cancelled) {
          setReview((prev) => prev || { accounts: [], fb_accounts: [], prep: {}, stats: {} })
        }
      }
      if (cancelled) return
      if (!settled && ticks < 25) {
        timer = setTimeout(tick, 4000)
      } else {
        setReviewSettled(true)
      }
    }
    setReviewSettled(false)
    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [booting, currentKey])

  // ── OAuth hops ──────────────────────────────────────────────────────────

  const startOAuth = useCallback(
    async (endpoint, setStatus) => {
      setStatus("connecting")
      try {
        sessionStorage.setItem("post_integration_redirect", "/onboarding")
        const res = await apiRequest(endpoint)
        const d = await res.json()
        if (!res.ok || !d.auth_url) throw new Error(d?.detail || "No auth URL")
        window.location.href = d.auth_url
      } catch (e) {
        console.error(`OAuth start failed for ${endpoint}:`, e)
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

  // ── First client creation (fires on Confirm; not awaited) ───────────────

  const applyTargets = useCallback(
    async (groupId, targets) => {
      try {
        await apiRequest(`/api/client-groups/${groupId}/targets`, {
          method: "PUT",
          body: JSON.stringify(targets),
        })
      } catch (e) {
        console.error("Failed to apply targets:", e)
      }
    },
    []
  )

  // Creates the first client group. The request blocks server-side on a full
  // GHL history fetch, so it is slow — see startFirstClientCreation, which is
  // what the wizard actually calls and which does not wait for it.
  //
  // The first client group is free (billing_middleware allows a
  // subscription-less user's very first one), so a failure here is a real
  // problem — GHL, network, a 500 — not an expected payment wall, which is why
  // the caller surfaces it rather than swallowing it.
  // `chosenCurrency` is passed in rather than read off state because the
  // client_currency step starts creation in the same handler that sets it, and
  // a state update isn't visible to a callback created in that render.
  const createFirstClient = useCallback(async (chosenCurrency) => {
    if (firstGroupId) return true
    if (!selectedClient) return false
    setCreationError(null)
    const groupCurrency = chosenCurrency || currency || selectedAd?.currency || null
    const clientName = clientNameConfirm.trim() || selectedClient.name
    const payload = {
      name: clientName,
      ghl_location_id: selectedClient.id,
      meta_ad_account_id: selectedAd?.id || null,
      hotprospector_group_id: null,
      // The user's explicit answer on client_currency wins over the ad
      // account's own currency: they may report in a different one than Meta
      // bills them in, and the whole point of asking was to stop guessing.
      ad_account_currency: groupCurrency,
      // "none" is a real, persisted answer — "I don't currently call my
      // leads" — not a missing value. The Sales Hub and every call-centre
      // metric read it to render "not available" instead of a misleading 0.
      call_log_provider:
        salesTool === "hp" ? "hotprospector" : salesTool === "none" ? "none" : "ghl",
      notes: "",
    }
    try {
      const res = await apiRequest("/api/client-groups", { method: "POST", body: JSON.stringify(payload) })
      const d = await res.json().catch(() => ({}))
      let groupId = d?.client_group?.id || null
      if (!res.ok && res.status !== 409) {
        const detail = d?.detail
        setCreationError(
          typeof detail === "string" ? detail : detail?.message || "Client creation failed"
        )
        return false
      }
      if (res.status === 409 || !groupId) {
        // Duplicate (e.g. wizard re-run) — find the existing group instead.
        try {
          const listRes = await apiRequest("/api/client-groups?date_preset=today&include_daily=false")
          if (listRes.ok) {
            const list = await listRes.json()
            const match = (list?.client_groups || []).find(
              (g) => g.ghl_location_id === selectedClient.id
            )
            if (match) groupId = match.id
          }
        } catch { /* ignore — targets fall back to onboarding state */ }
      }
      if (!groupId) {
        setCreationError("Client creation failed — please try again.")
        return false
      }
      setFirstGroupId(groupId)
      persistState({ data: { first_client: {
        group_id: groupId,
        name: clientName,
        ghl_location_id: selectedClient.id,
        meta_ad_account_id: selectedAd?.id || null,
        currency: groupCurrency,
      } } })
      if (pendingTargetsRef.current) {
        applyTargets(groupId, pendingTargetsRef.current)
        pendingTargetsRef.current = null
      }
      return true
    } catch (e) {
      console.error("Client creation failed:", e)
      setCreationError("Client creation failed — check your connection and try again.")
      return false
    }
  }, [selectedClient, selectedAd, clientNameConfirm, salesTool, currency, firstGroupId, persistState, applyTargets])

  // Fire-and-forget wrapper. The creation request blocks on a full GHL history
  // fetch and routinely takes tens of seconds; making the user watch a
  // "Creating client…" spinner for that long, before they have seen a single
  // thing Birdy does, was the worst dead spot in the wizard.
  //
  // Nothing between here and the completion step needs the group id: the KPI
  // step already parks its targets in pendingTargetsRef and createFirstClient
  // applies them the moment the id lands, and the sync badge already has a
  // branch for "creation still running". So the wizard carries on and the
  // result is reported asynchronously — as a badge while it runs, and as a
  // blocking error on the completion step if it fails, which is the last
  // point at which we can still do something about it.
  const startFirstClientCreation = useCallback((chosenCurrency) => {
    if (firstGroupId || creationState === "creating") return
    setCreationState("creating")
    setCreationError(null)
    createFirstClient(chosenCurrency).then(
      (ok) => setCreationState(ok ? "done" : "error"),
      () => setCreationState("error")
    )
  }, [createFirstClient, firstGroupId, creationState])

  // ── Background sync badge ───────────────────────────────────────────────

  useEffect(() => {
    if (!syncing) return
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      if (!firstGroupId) {
        // Creation request still running server-side (it blocks on the GHL
        // fetch) — show honest-but-approximate movement until it resolves.
        setSyncGhlPct((p) => Math.min(90, p + 3 + Math.round(Math.random() * 5)))
        setSyncMetaPct((p) => Math.min(25, p + 1 + Math.round(Math.random() * 3)))
        return
      }
      try {
        const res = await apiRequest(`/api/client-groups/${firstGroupId}/refresh-status`)
        if (!res.ok) return
        const d = await res.json()
        // The creation endpoint awaits the GHL fetch, so once the group id
        // exists GHL history is in unless a refresh is actively running.
        setSyncGhlPct(d.ghl_refresh_status === "running" ? 60 : 100)
        const p = d.meta_refresh_progress
        if (!p) {
          setSyncMetaPct(selectedAd ? 30 : 100)
        } else if (p.status === "success" || p.current_step === "done") {
          setSyncMetaPct(100)
        } else {
          const presetPct = p.presets_total ? Math.round((p.presets_done / p.presets_total) * 85) : 10
          setSyncMetaPct(Math.min(95, presetPct + (p.leads_status === "success" ? 10 : 0)))
        }
      } catch { /* transient — keep last values */ }
    }
    const timer = setInterval(poll, firstGroupId ? 4000 : 900)
    poll()
    return () => { cancelled = true; clearInterval(timer) }
  }, [syncing, firstGroupId, selectedAd])

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
      const targets = {
        cpa: cpa ? Number(cpa) : null,
        monthly_wins: wins ? Number(wins) : null,
        conversion_rate: convRate ? Number(convRate) : null,
        save_as_default: saveAsDefault,
      }
      if (firstGroupId) applyTargets(firstGroupId, targets)
      else pendingTargetsRef.current = targets
      next({ kpi: { cpa, wins, conv_rate: convRate, save_default: saveAsDefault } })
    },
    [cpa, wins, convRate, firstGroupId, applyTargets, next]
  )

  const saveChannel = useCallback(() => {
    if (selectedChannel) {
      apiRequest("/api/integrations/slack/channel", {
        method: "PUT",
        body: JSON.stringify({ channel_id: selectedChannel.id, channel_name: selectedChannel.name }),
      }).catch(() => {})
    }
    next({ slack: { channel_id: selectedChannel?.id, channel_name: selectedChannel?.name } })
  }, [selectedChannel, next])

  const saveBrief = useCallback(() => {
    if (slackStatus === "success" && frequency) {
      apiRequest("/api/integrations/slack/brief", {
        method: "PUT",
        body: JSON.stringify({
          frequency,
          time: notifyTime,
          day: frequency === "weekly" ? notifyDay : null,
          items: briefItems,
        }),
      }).catch(() => {})
    }
    next({ slack: {
      channel_id: selectedChannel?.id,
      channel_name: selectedChannel?.name,
      frequency, time: notifyTime, day: notifyDay, brief_items: briefItems,
    } })
  }, [slackStatus, frequency, notifyTime, notifyDay, briefItems, selectedChannel, next])

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
  const resolveFirstClientPath = useCallback(async () => {
    if (firstGroupId) return `/clients/${firstGroupId}`

    try {
      const res = await apiRequest("/api/onboarding/status")
      if (res.ok) {
        const state = await res.json()
        const saved = state?.data?.first_client?.group_id
        if (saved) return `/clients/${saved}`
      }
    } catch { /* fall through to the list */ }

    // Last resort: the group exists, we just never learned its id — creation
    // succeeded while the tab was away, or the persist that followed it failed.
    // Matching on the GHL location is exact, so this is a lookup, not a guess.
    if (selectedClient?.id) {
      try {
        const res = await apiRequest("/api/client-groups?date_preset=today&include_daily=false")
        if (res.ok) {
          const list = await res.json()
          const match = (list?.client_groups || []).find(
            (g) => g.ghl_location_id === selectedClient.id
          )
          if (match?.id) return `/clients/${match.id}`
        }
      } catch { /* fall through to the hub */ }
    }

    return "/clients"
  }, [firstGroupId, selectedClient])

  const finish = useCallback(async () => {
    setCompleting(true)
    try {
      await apiRequest("/api/onboarding/complete", { method: "POST" })
    } catch { /* flag stays server-side incomplete; still let them in */ }
    const destination = await resolveFirstClientPath()
    localStorage.removeItem("onboarding_incomplete")
    router.push(destination)
  }, [router, resolveFirstClientPath])

  // "I don't use Slack". Marking the opt-out drops SLACK_CONFIG_STEPS from
  // visibleSteps, so the plain next() lands on sub_accounts_review — the same
  // mechanism that hides hp_key for a non-HotProspector user. Deliberately not
  // a jump: a jump would have to know what comes after Slack, and the last
  // thing that did (the old "Skip for now") sent people straight past the
  // mandatory billing gate.
  const declineSlack = useCallback(() => {
    setSlackOptOut(true)
    next({ slack_opt_out: true })
  }, [next])

  // ── Derived lists ───────────────────────────────────────────────────────

  const clientQuery = clientSearch.toLowerCase()
  const clientItems = (locations || [])
    .filter((l) => (l.name || "").toLowerCase().includes(clientQuery))
    .map((l) => {
      // GHL's location shape varies by which upstream endpoint answered
      // (see fetch_locations in integrations/gohighlevel.py) — some only
      // carry `locationId`, not `id`/`_id`. Missing this fallback left every
      // row's id `undefined`, so every row compared equal to the (also
      // undefined) unselected state and all looked selected at once.
      const id = l.id || l._id || l.locationId
      return {
        id,
        title: l.name || "Unknown",
        sub: [l.city, l.state].filter(Boolean).join(", ") || l.address || "GHL sub-account",
        leading: <InitialsAvatar name={l.name} />,
        raw: { id, name: l.name },
      }
    })

  const adQuery = adSearch.toLowerCase()
  const adItems = (adAccounts || [])
    .filter((a) => (a.name || "").toLowerCase().includes(adQuery))
    .map((a) => ({
      id: a.id,
      title: a.name || a.id,
      sub: a.id,
      leading: (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-pd-info-bg text-pd-info">
          <FacebookGlyph size={15} />
        </div>
      ),
      raw: a,
    }))

  const channelQuery = channelSearch.toLowerCase()
  const channelItems = (channels || [])
    .filter((c) => (c.name || "").toLowerCase().includes(channelQuery))
    .map((c) => ({
      id: c.id,
      title: c.name,
      sub: null,
      leading: <span className="text-[14px] text-pd-faint">#</span>,
      raw: c,
    }))

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

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderConnectStates = ({ status, onConnect, onRetry, onContinue, connectLabel, connectingLabel, successLabel, errorTitle, errorBody, connectDisabled }) => (
    <>
      {/* Boot hasn't finished asking whether this is already connected. Show
          the wait rather than a Connect button we may be about to replace —
          the button was live and pressable for the whole round-trip, so
          returning from an OAuth hop invited a second, pointless one. */}
      {status === "checking" && (
        <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-faint">
          <SpinnerRing />
          Checking connection…
        </div>
      )}
      {status === "idle" && (
        <PrimaryButton onClick={onConnect} disabled={connectDisabled} arrow={false}>
          {connectLabel}
          <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2.4} />
        </PrimaryButton>
      )}
      {status === "connecting" && (
        <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-primary">
          <SpinnerRing />
          {connectingLabel}
        </div>
      )}
      {status === "error" && (
        <>
          <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-[18px] py-4 text-left">
            <div className="mb-[6px] flex items-center gap-2">
              <AlertCircle className="h-[15px] w-[15px] text-pd-danger" strokeWidth={2.2} />
              <span className="font-pd-display text-[13.5px] font-semibold text-pd-danger">{errorTitle}</span>
            </div>
            <div className="text-[12.5px] leading-normal text-pd-body">{errorBody}</div>
          </div>
          <PrimaryButton onClick={onRetry || onConnect} arrow={false}>
            Try again
            <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
          </PrimaryButton>
        </>
      )}
      {status === "success" && (
        <>
          <SuccessRow>{successLabel}</SuccessRow>
          <PrimaryButton onClick={onContinue || (() => next())}>Continue</PrimaryButton>
        </>
      )}
    </>
  )

  // ── Layout ──────────────────────────────────────────────────────────────

  if (booting) {
    return (
      <div className={`${pdFontClass} flex min-h-svh items-center justify-center bg-white`}>
        <SpinnerRing size={26} />
      </div>
    )
  }

  if (bootError) {
    return (
      <div className={`${pdFontClass} flex min-h-svh items-center justify-center bg-white px-6`}>
        <div className="max-w-md rounded-[20px] border border-pd-border-strong bg-white p-8 text-center shadow-[0_20px_60px_-24px_rgba(30,25,60,0.3)]">
          <div className="mb-3 font-pd-display text-lg font-bold text-pd-ink">Something went wrong</div>
          <div className="mb-6 text-[13.5px] text-pd-body">{bootError}</div>
          <PrimaryButton onClick={() => window.location.reload()} arrow={false}>Reload</PrimaryButton>
        </div>
      </div>
    )
  }

  const stepNum = Math.max(stepIndex, 1)
  const stepTotal = visibleSteps.length - 1

  return (
    // The wizard owns the whole viewport rather than floating as a card on a
    // grey page. It is the only thing the user can do at this point — there is
    // no app behind it to look at — so the card's border, shadow and 1080px cap
    // were framing emptiness. Full-bleed also stops the taller steps (the
    // sub-accounts table, the billing tiers) scrolling inside a box that is
    // itself shorter than the screen.
    <div className={`${pdFontClass} flex h-svh flex-col bg-white`}>
      <div className="relative flex h-full w-full flex-col overflow-hidden">

        {/* top bar */}
        {currentKey !== "welcome" && (
          <div className="shrink-0 border-b border-pd-divider px-[18px] pb-[14px] pt-4 sm:px-8 sm:pb-4 sm:pt-5">
            {/* The bar spans the window, its contents do not: a progress bar
                stretched across an ultrawide monitor reads as a loading screen
                rather than a step indicator. */}
            <div className="mx-auto flex w-full max-w-[1080px] items-center gap-[14px]">
            <button
              type="button"
              onClick={back}
              className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] border border-pd-border text-pd-body transition-colors hover:border-pd-chevron"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-[7px] flex items-center justify-between">
                <span className="font-pd-display text-[11px] font-semibold text-pd-primary sm:text-xs">
                  {PHASE_LABEL[phase]}
                </span>
                <span className="text-[11.5px] text-pd-faint">Step {stepNum} of {stepTotal}</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <div
                    key={p}
                    className="h-1 flex-1 rounded-sm"
                    style={{
                      background: p < phase ? "#6B4EE6" : p === phase ? "#A98BF5" : "#F1F1F5",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* "Skip for now" used to live here. It was removed deliberately:
                every step it let people past — the first client, the KPI
                targets, the sales tool — is something the product cannot work
                without, so skipping produced an account that looked set up and
                showed nothing. Steps that genuinely are optional now say so in
                their own words ("I don't currently call my leads", "I don't
                use Slack") rather than being bypassed by a generic escape
                hatch that also skipped the things that weren't optional. */}
            </div>
          </div>
        )}

        {/* Background-work corner badge. Since client creation stopped
            blocking the wizard, this is the only place the user can see that
            it is happening — and the only place a failure surfaces before the
            completion step, so the error branch has to be actionable. */}
        {creationState === "error" ? (
          <div className="absolute right-4 top-[76px] z-10 w-[228px] rounded-[11px] border border-pd-danger-border bg-pd-danger-bg px-[13px] py-[10px] text-left shadow-[0_10px_24px_-10px_rgba(30,25,60,0.25)] sm:top-[88px]">
            <div className="mb-[2px] flex items-center gap-[7px]">
              <AlertCircle className="h-[13px] w-[13px] shrink-0 text-pd-danger" strokeWidth={2.4} />
              <span className="text-[11.5px] font-semibold text-pd-danger">
                Couldn&apos;t add {clientDisplayName}
              </span>
            </div>
            <div className="mb-[7px] text-[10.5px] leading-normal text-pd-body">
              {creationError || "We'll ask you to retry before you finish."}
            </div>
            <button
              type="button"
              onClick={startFirstClientCreation}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-pd-primary underline"
            >
              Try again
            </button>
          </div>
        ) : creationState === "creating" ? (
          <div className="absolute right-4 top-[76px] z-10 w-[210px] rounded-[11px] border border-pd-border bg-white px-[13px] py-[10px] text-left shadow-[0_10px_24px_-10px_rgba(30,25,60,0.25)] sm:top-[88px]">
            <div className="mb-[7px] flex items-center gap-[9px]">
              <SpinnerRing />
              <span className="text-[11.5px] font-semibold text-pd-ink">Adding {clientDisplayName}</span>
            </div>
            <FakeProgressBar expectedMs={18000} />
          </div>
        ) : showSyncBadge ? (
          <div className="absolute right-4 top-[76px] z-10 w-[210px] rounded-[11px] border border-pd-border bg-white px-[13px] py-[10px] text-left shadow-[0_10px_24px_-10px_rgba(30,25,60,0.25)] sm:top-[88px]">
            <div className="mb-[8px] flex items-center gap-[9px]">
              <SpinnerRing />
              <span className="text-[11.5px] font-semibold text-pd-ink">Syncing historical data</span>
            </div>
            <div className="mb-[3px] flex items-center justify-between text-[10.5px] text-pd-faint">
              <span>GHL</span><span>{Math.round(syncGhlPct)}%</span>
            </div>
            <ProgressBar value={syncGhlPct} className="mb-[7px]" />
            <div className="mb-[3px] flex items-center justify-between text-[10.5px] text-pd-faint">
              <span>Meta</span><span>{Math.round(syncMetaPct)}%</span>
            </div>
            <ProgressBar value={syncMetaPct} />
          </div>
        ) : null}

        {/* content */}
        <div className="pd-scrolly relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-7 text-center sm:p-10">

          {currentKey === "welcome" && (
            <div className="w-full max-w-[440px]">
              <div className="mx-auto mb-[26px] flex h-20 w-20 items-end justify-center overflow-hidden rounded-full border border-pd-border-strong bg-white">
                <Birdy state={birdyState} size={65} />
              </div>
              <div className="mb-3"><StepHeading>Welcome to Birdy!</StepHeading></div>
              <div className="mb-[30px] text-[15px] leading-relaxed text-pd-body">
                We&apos;ll get you set up with your first client in under 10 minutes.
              </div>
              <PrimaryButton onClick={() => next()}>Get started</PrimaryButton>
            </div>
          )}

          {currentKey === "welcome_name" && (
            <div className="w-full max-w-[440px]">
              <div className="mb-3"><StepHeading>What should we call you?</StepHeading></div>
              <UnderlineInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                autoFocus
              />
              <PrimaryButton disabled={!name.trim()} onClick={() => next({ name: name.trim() })}>
                Continue
              </PrimaryButton>
            </div>
          )}

          {currentKey === "agency" && (
            <div className="w-full max-w-[440px]">
              <div className="mb-2"><StepHeading>What&apos;s your agency called?</StepHeading></div>
              <div className="mb-[26px] text-[14px] text-pd-faint">
                This is how it&apos;ll show up across Birdy, {name || "friend"}.
              </div>
              <UnderlineInput
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder="Agency name"
              />
              <PrimaryButton disabled={!agency.trim()} onClick={() => next({ agency: agency.trim() })}>
                Continue
              </PrimaryButton>
            </div>
          )}

          {currentKey === "connect_ghl" && (
            <div className="w-full max-w-[440px]">
              <IconChip bg="#F1EEFC" color="#6B4EE6"><Home className="h-[26px] w-[26px]" strokeWidth={2} /></IconChip>
              <div className="mb-[10px]">
                <StepHeading>Great{name ? `, ${name}` : ""} — let&apos;s get you connected to GHL.</StepHeading>
              </div>
              <div className="mb-7 text-[14px] leading-relaxed text-pd-body">
                Birdy will read your sub-accounts, contacts, and opportunity pipelines so it can
                track leads and conversions. We never modify your GHL data.
              </div>
              {renderConnectStates({
                status: ghlStatus,
                onConnect: () => startOAuth("/api/connect", setGhlStatus),
                connectLabel: "Connect GHL",
                connectingLabel: "Connecting to GHL…",
                successLabel: "GHL connected",
                errorTitle: "Connection failed",
                errorBody: "GHL didn't authorize the request — this usually means the popup was closed early. Let's try again.",
              })}
            </div>
          )}

          {currentKey === "client_picker" && (
            <div className="w-full max-w-[620px] text-left">
              <div className="mb-4 text-center">
                <StepHeading small>Let&apos;s choose your first client to onboard!</StepHeading>
              </div>
              {ghlStatus === "checking" ? (
                <div className="py-10"><FakeProgressBar expectedMs={2500} caption="Checking your GHL connection…" /></div>
              ) : ghlStatus !== "success" ? (
                <div className="py-6 text-center text-[13px] text-pd-faint">
                  Connect GHL first and your sub-accounts will show up here.
                </div>
              ) : locationsError ? (
                <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-4 py-3 text-center text-[12.5px] text-pd-body">
                  {locationsError}
                </div>
              ) : locations === null ? (
                // A large agency's location list is genuinely slow — hundreds
                // of sub-accounts, paged out of GHL. A bare spinner here reads
                // as "hung" and people reload mid-fetch.
                <div className="py-10">
                  <FakeProgressBar expectedMs={9000} caption="Fetching your GHL sub-accounts…" />
                </div>
              ) : (
                <>
                  <SearchInput
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder={`Search ${locations.length} sub-account${locations.length === 1 ? "" : "s"}…`}
                  />
                  <PickList
                    items={clientItems}
                    selectedId={selectedClient?.id}
                    onPick={(item) => {
                      setSelectedClient(item.raw)
                      setClientNameConfirm(item.raw.name || "")
                      // connect_meta (the very next step) does a full OAuth
                      // redirect away and back, which wipes any React state
                      // that isn't persisted — save the pick immediately so
                      // it survives that round-trip (restored in boot() via
                      // data.first_client).
                      persistState({ data: { first_client: {
                        ghl_location_id: item.raw.id,
                        name: item.raw.name,
                      } } })
                    }}
                    emptyText="No sub-accounts match that search"
                  />
                </>
              )}
              <div className="text-center">
                <PrimaryButton disabled={!selectedClient} onClick={() => next()}>Continue</PrimaryButton>
              </div>
            </div>
          )}

          {currentKey === "connect_meta" && (
            <div className="w-full max-w-[440px]">
              <IconChip bg="#EAF1FD" color="#3B7DD6"><FacebookGlyph /></IconChip>
              <div className="mb-[10px]"><StepHeading>Next up, let&apos;s connect Meta.</StepHeading></div>
              <div className="mb-7 text-[14px] leading-relaxed text-pd-body">
                Birdy reads ad spend, impressions and results from your ad accounts so it can
                calculate cost-per-lead and flag underperforming ads. We can&apos;t post or spend
                on your behalf.
              </div>
              {renderConnectStates({
                status: metaStatus,
                onConnect: () => startOAuth("/api/connect/facebook", setMetaStatus),
                connectLabel: "Connect Meta",
                connectingLabel: "Connecting to Meta…",
                successLabel: "Meta connected",
                errorTitle: "Connection failed",
                errorBody: "Meta didn't authorize the request — this usually means the popup was closed early. Let's try again.",
              })}
            </div>
          )}

          {currentKey === "meta_ad_picker" && (
            <div className="w-full max-w-[620px] text-left">
              <div className="mb-4 text-center">
                <StepHeading small>Which Meta ad account is {clientDisplayName}?</StepHeading>
              </div>
              {metaStatus === "checking" ? (
                <div className="py-10"><FakeProgressBar expectedMs={2500} caption="Checking your Meta connection…" /></div>
              ) : metaStatus !== "success" ? (
                <div className="py-6 text-center text-[13px] text-pd-faint">
                  Connect Meta first and your ad accounts will show up here.
                </div>
              ) : adError ? (
                <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-4 py-3 text-center text-[12.5px] text-pd-body">
                  {adError}
                </div>
              ) : adAccounts === null ? (
                <div className="py-10">
                  <FakeProgressBar expectedMs={6000} caption="Fetching your Meta ad accounts…" />
                </div>
              ) : (
                <>
                  <SearchInput
                    value={adSearch}
                    onChange={(e) => setAdSearch(e.target.value)}
                    placeholder="Search ad accounts…"
                  />
                  <PickList
                    items={adItems}
                    selectedId={selectedAd?.id}
                    onPick={(item) => {
                      setSelectedAd(item.raw)
                      // Same reasoning as client_picker's onPick — persist the
                      // full draft (not just the ad account) since $set on
                      // onboarding.data.first_client replaces the whole field
                      // rather than merging into what client_picker saved.
                      persistState({ data: { first_client: {
                        ghl_location_id: selectedClient?.id,
                        name: clientNameConfirm || selectedClient?.name,
                        meta_ad_account_id: item.raw.id,
                        currency: item.raw.currency || null,
                      } } })
                    }}
                    emptyText="No ad accounts match that search"
                  />
                </>
              )}
              <div className="text-center">
                <PrimaryButton disabled={!selectedAd} onClick={() => next()}>Continue</PrimaryButton>
              </div>
            </div>
          )}

          {currentKey === "sales_tool" && (
            <div className="w-full max-w-[620px]">
              <div className="mb-2"><StepHeading>What do you use for sales?</StepHeading></div>
              <div className="mb-7 text-[14px] text-pd-faint">
                This decides where Birdy pulls call and close data from.
              </div>
              <div className="flex flex-col gap-[14px] sm:flex-row">
                {[
                  {
                    id: "ghl",
                    label: "GHL",
                    desc: ghlStatus === "success" ? "Already connected" : "Uses your GHL connection",
                    icon: <Home className="h-[18px] w-[18px]" strokeWidth={2} />,
                    chip: "bg-pd-primary-tint text-pd-primary",
                  },
                  {
                    id: "hp",
                    label: "Hot Prospector",
                    desc: "Connect with an API key",
                    icon: <Phone className="h-[18px] w-[18px]" strokeWidth={2} />,
                    chip: "bg-pd-warning-bg text-pd-warning",
                  },
                  // The honest third answer. Without it, an agency that doesn't
                  // call its leads had to claim a dialler it doesn't use, and
                  // then every call-centre metric in the product reported a
                  // confident 0 — indistinguishable from "you made no calls".
                  // Answering "none" makes those read "not available" instead,
                  // with a route to connect a tool later.
                  {
                    id: "none",
                    label: "I don't call my leads",
                    desc: "Skip call tracking for now",
                    icon: <PhoneOff className="h-[18px] w-[18px]" strokeWidth={2} />,
                    chip: "bg-pd-table-head text-pd-subtle",
                  },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => { setSalesTool(opt.id); next({ sales_tool: opt.id }) }}
                    className="flex-1 cursor-pointer rounded-[14px] border-2 px-4 py-[22px] transition-colors"
                    style={{
                      borderColor: salesTool === opt.id ? "#6B4EE6" : "#ECECF2",
                      background: salesTool === opt.id ? "#F1EEFC" : "#fff",
                    }}
                  >
                    <div className={`mx-auto mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] ${opt.chip}`}>
                      {opt.icon}
                    </div>
                    <div className="mb-1 font-pd-display text-[14.5px] font-semibold text-pd-ink">{opt.label}</div>
                    <div className="text-[11.5px] text-pd-faint">{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentKey === "hp_key" && (
            <div className="w-full max-w-[440px]">
              <div className="mb-2"><StepHeading>Connect your Hot Prospector account.</StepHeading></div>
              <div className="mb-[22px] text-[14px] leading-normal text-pd-body">
                Paste your API UID and key below — both are in your Hot Prospector settings.
              </div>
              {hpStatus !== "success" && hpStatus !== "checking" && (
                <>
                  <input
                    value={hpUid}
                    onChange={(e) => setHpUid(e.target.value)}
                    placeholder="API UID"
                    className="mb-2 w-full rounded-[10px] border-[1.5px] border-pd-border px-[14px] py-[13px] font-mono text-[14px] text-pd-ink outline-none transition-colors placeholder:text-pd-faint focus:border-pd-primary"
                  />
                  <div className="relative mb-[14px]">
                    <input
                      value={hpKey}
                      onChange={(e) => setHpKey(e.target.value)}
                      type={hpVisible ? "text" : "password"}
                      placeholder="API key"
                      className="w-full rounded-[10px] border-[1.5px] border-pd-border py-[13px] pl-[14px] pr-11 font-mono text-[14px] text-pd-ink outline-none transition-colors placeholder:text-pd-faint focus:border-pd-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setHpVisible((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent text-pd-faint"
                    >
                      {hpVisible ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                    </button>
                  </div>
                </>
              )}
              {/* Same reason as the OAuth steps: don't offer the key form
                  before we know whether a key is already on file. */}
              {hpStatus === "checking" && (
                <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-faint">
                  <SpinnerRing />
                  Checking connection…
                </div>
              )}
              {hpStatus === "idle" && (
                <PrimaryButton disabled={!hpUid.trim() || !hpKey.trim()} onClick={connectHp} arrow={false}>
                  Connect Hot Prospector
                  <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2.4} />
                </PrimaryButton>
              )}
              {hpStatus === "connecting" && (
                <div className="inline-flex items-center gap-[10px] text-[14px] font-semibold text-pd-primary">
                  <SpinnerRing />
                  Verifying key…
                </div>
              )}
              {hpStatus === "error" && (
                <>
                  <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-4 py-[14px] text-left text-[12.5px] leading-normal text-pd-body">
                    <strong className="text-pd-danger">That key was rejected.</strong>{" "}
                    {hpError || "Double check you copied the full UID and key from Hot Prospector settings, then try again."}
                  </div>
                  <PrimaryButton onClick={connectHp} arrow={false}>
                    Try again
                    <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
                  </PrimaryButton>
                </>
              )}
              {hpStatus === "success" && (
                <>
                  <SuccessRow>Hot Prospector connected</SuccessRow>
                  <PrimaryButton onClick={() => next()}>Continue</PrimaryButton>
                </>
              )}
            </div>
          )}

          {currentKey === "client_confirm" && (
            <div className="w-full max-w-[440px]">
              <div className="mb-2"><StepHeading>Want to change the client name?</StepHeading></div>
              <div className="mb-[22px] text-[13.5px] text-pd-faint">
                Pulled from their GHL sub-account. Edit it if you&apos;d like something different.
              </div>
              <UnderlineInput
                value={clientNameConfirm}
                onChange={(e) => setClientNameConfirm(e.target.value)}
                placeholder="Client name"
              />
              {/* Creation used to fire here and be awaited. It now happens on
                  the next step (client_currency), because the currency is part
                  of the payload and because nothing about naming a client
                  needs a network round-trip. */}
              <PrimaryButton
                disabled={!clientNameConfirm.trim() || !selectedClient}
                // $set on onboarding.data.first_client replaces the whole
                // field, so the draft has to be re-sent complete — including
                // a group_id if creation already succeeded and the user came
                // back to rename. Dropping it would strand the group.
                onClick={() => next({ first_client: {
                  ...(firstGroupId ? { group_id: firstGroupId } : {}),
                  ghl_location_id: selectedClient?.id,
                  name: clientNameConfirm.trim(),
                  meta_ad_account_id: selectedAd?.id || null,
                  currency: currency || selectedAd?.currency || null,
                } })}
              >
                Confirm
              </PrimaryButton>
            </div>
          )}

          {currentKey === "client_currency" && (
            <div className="w-full max-w-[440px]">
              <div className="mb-2">
                <StepHeading small>What currency does {clientDisplayName} report in?</StepHeading>
              </div>
              <div className="mb-[26px] text-[13.5px] leading-normal text-pd-body">
                Every spend, cost and revenue figure for this client is shown in this currency.
                {selectedAd?.currency
                  ? ` We've pre-filled it from their Meta ad account.`
                  : ""}
              </div>
              <select
                value={currency || selectedAd?.currency || "GBP"}
                onChange={(e) => setCurrency(e.target.value)}
                className="mb-[30px] w-full rounded-[10px] border-[1.5px] border-pd-border bg-white px-[14px] py-[13px] text-[15px] text-pd-ink outline-none transition-colors focus:border-pd-primary"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label} ({getSymbolFromCurrency(c.code) || c.code})
                  </option>
                ))}
              </select>
              <PrimaryButton
                onClick={() => {
                  const chosen = currency || selectedAd?.currency || "GBP"
                  setCurrency(chosen)
                  // Also the account-wide default. The sign-up form used to ask
                  // for this; now this step is the only place it gets set, and
                  // useCurrency reads the localStorage copy synchronously on
                  // first render, so writing it here stops the rest of the app
                  // rendering "$" for a user who just said GBP.
                  try {
                    localStorage.setItem(STORAGE_KEYS.DEFAULT_CURRENCY, chosen)
                  } catch { /* private mode — the server copy still wins on next login */ }
                  startFirstClientCreation(chosen)
                  next({ currency: chosen })
                }}
              >
                Continue
              </PrimaryButton>
            </div>
          )}

          {currentKey === "sync_prompt" && (
            <>
              {/* confetti */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0"
                    style={{
                      left: `${(i * 41 + 7) % 100}%`,
                      width: 6 + (i % 3) * 3,
                      height: 6 + (i % 3) * 3,
                      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                      borderRadius: i % 2 ? 2 : "50%",
                      animation: `ob-confetti ${(1.6 + (i % 5) * 0.25).toFixed(2)}s ease-in ${((i % 7) * 0.09).toFixed(2)}s 1 both`,
                    }}
                  />
                ))}
              </div>
              <div className="w-full max-w-[440px]">
                <SuccessRow>{clientDisplayName} connected</SuccessRow>
                <div className="mb-3"><StepHeading>Congratulations! You connected your first client.</StepHeading></div>
                <div className="mb-[30px] text-[14.5px] leading-relaxed text-pd-body">
                  Whilst we finish onboarding, Birdy can add the rest of your clients for you in
                  the background.
                </div>
                <PrimaryButton onClick={acceptSync}>Continue onboarding</PrimaryButton>
              </div>
            </>
          )}

          {currentKey === "kpi_targets" && (
            <div className="w-full max-w-[440px] text-left">
              <div className="mb-[10px] text-center">
                <StepHeading small>Now, let&apos;s set some targets for {clientDisplayName}.</StepHeading>
              </div>
              <div className="mb-[26px] text-center text-[14px] leading-normal text-pd-body">
                What are your KPI targets for {clientDisplayName}? Birdy uses these to flag when
                something needs attention.
              </div>
              <div className="mb-[18px]">
                <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Cost per acquisition target</div>
                <div className="flex items-center rounded-[10px] border-[1.5px] border-pd-border px-[14px] focus-within:border-pd-primary">
                  <span className="mr-[6px] text-[14px] text-pd-faint">{currencySymbol}</span>
                  <input
                    value={cpa}
                    onChange={(e) => setCpa(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="45"
                    inputMode="numeric"
                    className="flex-1 border-0 py-3 text-[15px] text-pd-ink outline-none placeholder:text-pd-faint"
                  />
                </div>
                <div className="mt-[5px] text-[11px] text-[#B4B4C0]">Most agencies in your niche target {currencySymbol}30–60.</div>
              </div>
              <div className="mb-[18px]">
                <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Monthly wins target</div>
                <div className="flex items-center rounded-[10px] border-[1.5px] border-pd-border px-[14px] focus-within:border-pd-primary">
                  <input
                    value={wins}
                    onChange={(e) => setWins(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="20"
                    inputMode="numeric"
                    className="flex-1 border-0 py-3 text-[15px] text-pd-ink outline-none placeholder:text-pd-faint"
                  />
                  <span className="text-[14px] text-pd-faint">clients closed</span>
                </div>
              </div>
              <div className="mb-[26px]">
                <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Conversion rate target</div>
                <div className="flex items-center rounded-[10px] border-[1.5px] border-pd-border px-[14px] focus-within:border-pd-primary">
                  <input
                    value={convRate}
                    onChange={(e) => setConvRate(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="15"
                    inputMode="numeric"
                    className="flex-1 border-0 py-3 text-[15px] text-pd-ink outline-none placeholder:text-pd-faint"
                  />
                  <span className="text-[14px] text-pd-faint">%</span>
                </div>
              </div>
              <div className="text-center">
                <PrimaryButton onClick={() => next({ kpi: { cpa, wins, conv_rate: convRate } })}>
                  Apply targets
                </PrimaryButton>
              </div>
            </div>
          )}

          {currentKey === "kpi_default" && (
            <div className="w-full max-w-[440px]">
              <SuccessRow>Targets applied</SuccessRow>
              <div className="mb-3"><StepHeading>Save these as your defaults?</StepHeading></div>
              <div className="mb-[30px] text-[14.5px] leading-relaxed text-pd-body">
                We&apos;ll pre-fill every new client with these numbers — you can always adjust per
                client later.
              </div>
              <div className="flex justify-center gap-3">
                <SecondaryButton onClick={() => applyKpiTargets(false)}>Just this client</SecondaryButton>
                <PrimaryButton onClick={() => applyKpiTargets(true)} className="px-6 py-3">
                  Yes, set as default
                </PrimaryButton>
              </div>
            </div>
          )}

          {currentKey === "slack_connect" && (
            <div className="w-full max-w-[440px]">
              <IconChip bg="#FDF6EC" color="#E0920A"><SlackGlyph /></IconChip>
              <div className="mb-[10px]"><StepHeading>Let&apos;s connect Birdy to your Slack for notifications.</StepHeading></div>
              <div className="mb-7 text-[14px] leading-relaxed text-pd-body">
                Birdy will post alerts and daily summaries to a channel you choose. It only ever
                posts — it can&apos;t read your other messages.
              </div>
              {renderConnectStates({
                status: slackStatus,
                onConnect: () => startOAuth("/api/connect/slack", setSlackStatus),
                // Connecting Slack un-does an earlier "I don't use Slack" —
                // otherwise someone who opted out, went back and connected
                // anyway would still have the channel and brief steps hidden,
                // and would finish onboarding with a workspace Birdy never
                // asked them where to post in.
                onContinue: () => {
                  if (slackOptOut) {
                    setSlackOptOut(false)
                    next({ slack_opt_out: false })
                  } else {
                    next()
                  }
                },
                connectLabel: "Connect Slack",
                connectingLabel: "Connecting to Slack…",
                successLabel: "Slack connected",
                errorTitle: "Connection failed",
                errorBody: "Slack didn't authorize the request — this usually means the popup was closed early. Let's try again.",
              })}
              {/* The one genuine opt-out in the wizard. Slack is the only
                  integration Birdy works fully without, and plenty of agencies
                  don't run one — with "Skip for now" gone, this step would
                  otherwise be a wall they cannot get past. Stated as a real
                  answer, so the product knows the difference between "not set
                  up yet" and "doesn't use Slack". */}
              {(slackStatus === "idle" || slackStatus === "error") && (
                <button
                  type="button"
                  onClick={declineSlack}
                  className="mt-5 cursor-pointer border-0 bg-transparent text-[13px] font-semibold text-pd-subtle underline transition-colors hover:text-pd-body"
                >
                  I don&apos;t use Slack
                </button>
              )}
            </div>
          )}

          {currentKey === "slack_channel" && (
            <div className="w-full max-w-[620px]">
              <div className="mb-[22px] text-center">
                <StepHeading small>Where should Birdy briefs go on Slack?</StepHeading>
              </div>
              <div className="flex flex-col items-start gap-6 text-left sm:flex-row">
                <div className="w-full flex-1">
                  {channels === null ? (
                    <div className="flex justify-center py-10"><SpinnerRing size={22} /></div>
                  ) : (
                    <>
                      <SearchInput
                        value={channelSearch}
                        onChange={(e) => setChannelSearch(e.target.value)}
                        placeholder="Search channels…"
                      />
                      <PickList
                        items={channelItems}
                        selectedId={selectedChannel?.id}
                        onPick={(item) => setSelectedChannel(item.raw)}
                        maxHeight={220}
                        emptyText="No channels found — invite the Birdy app to a channel in Slack"
                      />
                    </>
                  )}
                </div>
                <div className="w-full flex-1">
                  <div className="mb-[9px] text-[11px] font-bold tracking-[0.05em] text-pd-faint">PREVIEW</div>
                  <SlackPreviewCard time="9:02 AM">
                    CPA for {clientDisplayName} is {currencySymbol}{cpa || "45"} — right on target. Yesterday&apos;s
                    spend was {currencySymbol}142 across 3 ad sets.
                  </SlackPreviewCard>
                  <div className="mt-5 text-center">
                    <PrimaryButton disabled={!selectedChannel} onClick={saveChannel}>Continue</PrimaryButton>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentKey === "slack_frequency" && (
            <div className="w-full max-w-[440px]">
              <div className="mb-[26px]"><StepHeading>How often should Birdy send you a brief?</StepHeading></div>
              <div className="mb-5 flex gap-[14px]">
                {[
                  { id: "daily", label: "Daily", desc: "A summary every morning" },
                  { id: "weekly", label: "Weekly", desc: "One digest each Monday" },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setFrequency(opt.id)}
                    className="flex-1 cursor-pointer rounded-[14px] border-2 px-4 py-[22px] transition-colors"
                    style={{
                      borderColor: frequency === opt.id ? "#6B4EE6" : "#ECECF2",
                      background: frequency === opt.id ? "#F1EEFC" : "#fff",
                    }}
                  >
                    <div className="mb-1 font-pd-display text-[14.5px] font-semibold text-pd-ink">{opt.label}</div>
                    <div className="text-[11.5px] text-pd-faint">{opt.desc}</div>
                  </div>
                ))}
              </div>
              {frequency === "daily" && (
                <div className="mb-[22px] text-left">
                  <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">What time?</div>
                  <select
                    value={notifyTime}
                    onChange={(e) => setNotifyTime(e.target.value)}
                    className="w-full rounded-[10px] border-[1.5px] border-pd-border bg-white px-[14px] py-[11px] text-[14.5px] text-pd-ink outline-none"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              {frequency === "weekly" && (
                <div className="mb-[22px] flex gap-3 text-left">
                  <div className="flex-1">
                    <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">Which day?</div>
                    <select
                      value={notifyDay}
                      onChange={(e) => setNotifyDay(e.target.value)}
                      className="w-full rounded-[10px] border-[1.5px] border-pd-border bg-white px-[14px] py-[11px] text-[14.5px] text-pd-ink outline-none"
                    >
                      {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <div className="mb-[7px] text-[12.5px] font-semibold text-pd-body">What time?</div>
                    <select
                      value={notifyTime}
                      onChange={(e) => setNotifyTime(e.target.value)}
                      className="w-full rounded-[10px] border-[1.5px] border-pd-border bg-white px-[14px] py-[11px] text-[14.5px] text-pd-ink outline-none"
                    >
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <PrimaryButton disabled={!frequency} onClick={() => next({ slack: {
                channel_id: selectedChannel?.id, channel_name: selectedChannel?.name,
                frequency, time: notifyTime, day: notifyDay,
              } })}>
                Continue
              </PrimaryButton>
            </div>
          )}

          {currentKey === "brief_content" && (
            <div className="w-full max-w-[640px]">
              <div className="mb-2 text-center">
                <StepHeading small>What information do you want in your morning brief?</StepHeading>
              </div>
              <div className="mb-[22px] text-center text-[13.5px] text-pd-faint">
                We&apos;ve pre-selected what most agencies find useful — untick anything you
                don&apos;t need.
              </div>
              <div className="flex flex-col items-start gap-6 text-left sm:flex-row">
                <div className="w-full flex-[1.2] overflow-hidden rounded-xl border border-pd-border">
                  {BRIEF_DEFS.map((def) => {
                    const on = !!briefItems[def.id]
                    return (
                      <div
                        key={def.id}
                        onClick={() => setBriefItems((prev) => ({ ...prev, [def.id]: !prev[def.id] }))}
                        className="flex cursor-pointer items-center gap-[11px] border-b border-pd-row-border px-[14px] py-[13px] last:border-b-0"
                      >
                        <span
                          className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-white"
                          style={{
                            borderColor: on ? "#6B4EE6" : "#DFDFE8",
                            background: on ? "#6B4EE6" : "#fff",
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold text-pd-ink">{def.label}</div>
                          <div className="text-[11.5px] text-pd-faint">{def.desc}</div>
                        </div>
                        {def.rec && (
                          <span className="shrink-0 rounded-[5px] bg-pd-primary-tint px-[7px] py-[2px] text-[10px] font-bold text-pd-primary">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="w-full flex-1">
                  <div className="mb-[9px] text-[11px] font-bold tracking-[0.05em] text-pd-faint">PREVIEW</div>
                  <SlackPreviewCard time={notifyTime}>
                    {briefItems.spend && <div>💰 Spend yesterday: <strong className="text-white">{currencySymbol}142</strong> across 3 ad sets</div>}
                    {briefItems.leads && <div>📈 New leads: <strong className="text-white">18</strong></div>}
                    {briefItems.conversion && <div>🎯 Conversion rate: <strong className="text-white">14.2%</strong></div>}
                    {briefItems.top && <div>🏆 Top performer: <strong className="text-white">{clientDisplayName}</strong></div>}
                    {briefItems.alerts && <div>🔔 Alerts: <strong className="text-white">1 triggered</strong> — CPA over target</div>}
                    {briefItems.underperform && <div>⚠️ Underperforming: <strong className="text-white">2 ads</strong> flagged for review</div>}
                    {!Object.values(briefItems).some(Boolean) && (
                      <div className="text-[#A9A0B0]">Tick something on the left to see it here.</div>
                    )}
                  </SlackPreviewCard>
                </div>
              </div>
              <div className="mt-[26px] text-center">
                <PrimaryButton onClick={saveBrief}>Continue</PrimaryButton>
              </div>
            </div>
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
              accountCount={(pendingImportRef.current || []).length}
              onSubscribed={handleBillingSubscribed}
              importing={importing}
            />
          )}

          {currentKey === "completion" && (
            <div className="w-full max-w-[440px]">
              <div className="mx-auto mb-[22px] flex h-[136px] w-[136px] items-end justify-center overflow-hidden rounded-full border border-pd-border bg-white">
                <Birdy state={birdyState} size={114} />
              </div>
              <div className="mb-2"><StepHeading>You&apos;re all set{name ? `, ${name}` : ""}.</StepHeading></div>
              <div className="mb-[26px] text-[14px] text-pd-faint">
                Here&apos;s everything Birdy just connected{agency ? ` for ${agency}` : ""}. We&apos;ll
                keep importing the rest in the background.
              </div>

              {/* Last chance to notice that the background creation failed.
                  Everything after client_currency ran without needing the
                  group, so this is the first point where "you have no first
                  client" actually costs the user something — they'd land on an
                  empty Clients page with no idea why. Offered as a retry, not
                  a wall: if GHL is down, trapping them in the wizard helps
                  nobody, so they can still go in without it. */}
              {creationState === "error" && (
                <div className="mb-5 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-[18px] py-4 text-left">
                  <div className="mb-[6px] flex items-center gap-2">
                    <AlertCircle className="h-[15px] w-[15px] text-pd-danger" strokeWidth={2.2} />
                    <span className="font-pd-display text-[13.5px] font-semibold text-pd-danger">
                      {clientDisplayName} wasn&apos;t added
                    </span>
                  </div>
                  <div className="mb-[14px] text-[12.5px] leading-normal text-pd-body">
                    {creationError || "Something went wrong setting up your first client."}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <PrimaryButton onClick={() => startFirstClientCreation()} arrow={false}>
                      Try again
                      <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
                    </PrimaryButton>
                    <SecondaryButton onClick={finish}>Continue without it</SecondaryButton>
                  </div>
                </div>
              )}

              {creationState === "creating" && (
                <div className="mb-5">
                  <FakeProgressBar expectedMs={18000} caption={`Still adding ${clientDisplayName} — you can go on in.`} />
                </div>
              )}

              {creationState !== "error" && (
                <PrimaryButton onClick={finish} disabled={completing}>
                  {completing ? "Opening Birdy…" : "Take a look at Birdy"}
                </PrimaryButton>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
