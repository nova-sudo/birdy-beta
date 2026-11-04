"use client"

import useSWR, { useSWRConfig } from "swr"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { STOCK_AGENT_TYPE, revalidateAgentWork, send, useAgents } from "@/lib/agents-api"

// ─── The Birdy Media Buying Agent ────────────────────────────────────────────
// One per user. Its routes live under /api/agents/{id}; every hook and mutation
// below matches one of them. Backend routes with no hook here yet:
//   GET  /runs                      past reports (a later task adds it if the history list needs it)
//   POST /outcomes/{row}/clear      take a wrong result off the scoreboard

export { STOCK_AGENT_TYPE }
export const STOCK_AGENT_PATH = "/hub/agents/media-buying"
export const STOCK_SETUP_PATH = `${STOCK_AGENT_PATH}/setup`

// ─── Plain words for reason codes ────────────────────────────────────────────
// One place for every reason a line or card can stop, so the report, the setup
// preview and the Slack editor say the same thing. The server also sends its own
// message with each code; use that when a code is new (see reasonCopy).

export const REASON_COPY = {
  // Adding a creative
  no_words: "Birdy couldn't find the words for this ad, so it didn't post one. Post it by hand in Ads Manager if you want it.",
  unsupported_landing:
    "This client's live ads don't send people to a form, WhatsApp or a website, so Birdy can't tell where a new ad should go. Nothing was posted.",
  no_destination: "Birdy couldn't find a live ad in this client's main ad set to copy from, so nothing was posted.",
  no_source: "Birdy doesn't know which creative this line means, so nothing was posted.",
  already_run: "This ad account has already run this creative, so Birdy didn't post it again.",
  // The server sends three different messages for this code (one says the ad exists and is paused in Meta),
  // so reasonCopy prefers its message over this fallback.
  already_posted: "Birdy has already posted this creative to this ad account. Look for it in Ads Manager.",
  add_writes_off: "Posting new ads is switched off, so Birdy didn't post this.",
  needs_file: "Meta won't share this file, so Birdy needs you to upload it before it can post the ad.",
  no_token: "Meta isn't connected, so nothing was changed. Reconnect Meta and try again.",
  // The ad exists but isn't on
  left_paused:
    "Birdy made this ad and it is paused in Meta, because a newer card replaced this one before it went live. Turn it on in Ads Manager if you want it.",
  unconfirmed:
    "Birdy tried to turn this ad on and couldn't confirm it worked. Check the ad in Ads Manager, or try again. Birdy looks first, so it won't post it twice.",
  // The change no longer applies
  now_flag: "This change is now set to Flag, so Birdy didn't make it. Make it in Meta if you want it.",
  not_auto: "This change no longer runs by itself, so it is waiting for you.",
  not_acting_agent: "Another agent now handles this client, so Birdy didn't change it.",
  agent_off: "This agent is off, so it can't change this client. Turn it on and try again.",
  on_hold: "This client is on hold, so Birdy won't change its ads.",
  superseded: "A newer card replaced this one, so it can't be applied.",
  dismissed: "This card was dismissed, so it can't be applied.",
  // Safety checks
  last_live_ad: "Pausing this would leave its ad set with no live ads, so Birdy didn't do it.",
  max_ads_live: "This ad set is at its live ad limit, so Birdy didn't add another.",
  no_adset: "Birdy doesn't know which ad set this ad is in, so nothing was changed.",
  no_ad: "This line doesn't name an ad, so nothing was changed.",
  several_ads: "This line names more than one ad, so nothing was changed.",
  live_check_failed: "Birdy couldn't read this ad set from Meta, so it didn't change anything. Try again in a few minutes.",
  removed: "This ad was removed in Meta before it went live.",
  post_refused: "Meta didn't accept this ad, so nothing was posted. Try again.",
  no_permission: "This agent isn't allowed to change this kind of thing. Change its permissions to allow it.",
  protected_tag: "This ad has a tag you told Birdy never to touch, so it left it alone.",
  pause_cap: "This client has hit today's limit on pauses, so Birdy didn't pause more. It can try again tomorrow.",
  exception: "You told Birdy to leave this alone, so it did.",
  flag_only: "This change is set to Flag, so Birdy only points it out. Make it in Meta if you want it.",
  default: "Birdy didn't make this change. Look at the card for what to do next.",
}

/** The words to show for a reason code. Falls back to the server's message, then to a safe line. */
export function reasonCopy(code, serverMessage) {
  if (code === "already_posted" && serverMessage) return serverMessage
  if (code && Object.hasOwn(REASON_COPY, code)) return REASON_COPY[code]
  return serverMessage || REASON_COPY.default
}

/** Activity rows for the stock agent, by kind. */
export const ACTIVITY_COPY = {
  ad_left_paused: "Birdy made an ad and left it paused in Meta. It needs turning on in Ads Manager.",
}

// ─── Reads ───────────────────────────────────────────────────────────────────
// Each takes the agent id and stays idle (null key) until there is one.

/** The user's Birdy Media Buying Agent, or null before they set it up. */
export function useStockAgent() {
  const { agents, error, isLoading, mutate } = useAgents()
  return { agent: agents.find((a) => a.type === STOCK_AGENT_TYPE) ?? null, error, isLoading, mutate }
}

/** The newest report (`run` is null before the first one). @returns {{ run: object|null, openCards: number, error, isLoading, mutate }} */
export function useLatestRun(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.stockLatestRun(id) : null, fetcher)
  return { run: data?.run ?? null, openCards: data?.open_cards ?? 0, error, isLoading, mutate }
}

/**
 * One report: `{run, cards, follow_ups, scoreboard, learned, proposals, weekly}`. `weekly` is the safe
 * view (`values`, `posted`, `post_error`); `run` carries `publish_error`, `slack_pending`, `slack_late`.
 */
export function useRun(id, runId) {
  const { data, error, isLoading, mutate } = useSWR(id && runId ? queryKeys.stockRun(id, runId) : null, fetcher)
  return { report: data ?? null, error, isLoading, mutate }
}

/** The scoreboard rows. */
export function useOutcomes(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.stockOutcomes(id) : null, fetcher)
  return { outcomes: data ?? null, error, isLoading, mutate }
}

/** Every lesson, overruled ones included, oldest first. */
export function useLessons(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.stockLessons(id) : null, fetcher)
  return { lessons: Array.isArray(data) ? data : [], error, isLoading, mutate }
}

/** One Slack template view: the template, its default and a `notice`. @param {string} kind a template kind */
export function useSlackTemplate(id, kind) {
  const { data, error, isLoading, mutate } = useSWR(id && kind ? queryKeys.stockSlackTemplate(id, kind) : null, fetcher)
  return { template: data ?? null, error, isLoading, mutate }
}

// ─── Mutations ───────────────────────────────────────────────────────────────
// A refusal throws an Error with `status` and the server's plain `detail` as its message.

/** Creates the Birdy Media Buying Agent as a draft. 409 when the user already has one. */
export function createStockAgent() {
  return send(queryKeys.agents(), "POST", { type: STOCK_AGENT_TYPE })
}

/**
 * `{settings?, client_group_ids?, move_claims?, only_flag?}`. Settings merge on the server and a bad field is a
 * 400 with `errors`. The server honours `only_flag` only when `client_group_ids` is sent with it.
 */
export function patchSettings(id, patch) {
  return send(queryKeys.stockSettings(id), "PATCH", patch)
}

/** Runs on real data and writes nothing. @returns {Promise<{run_id: string, kind: string, phase: string, done: boolean}>} 409 `{detail, not_ready?}` when it can't start. */
export function startPreview(id) {
  return send(queryKeys.stockPreview(id), "POST")
}

/** Applies a card, or only `lineIds` (naming a failed or blocked line retries it). */
export function applyCard(id, cardId, lineIds) {
  return send(`${queryKeys.stockCard(id, cardId)}/apply`, "POST", lineIds ? { line_ids: lineIds } : {})
}

export function dismissCard(id, cardId, reason) {
  return send(`${queryKeys.stockCard(id, cardId)}/dismiss`, "POST", reason ? { reason } : {})
}

/** Reverses one applied line (within 24 hours). */
export function undoCardLine(id, cardId, lineId) {
  return send(`${queryKeys.stockCard(id, cardId)}/undo`, "POST", { line_id: lineId })
}

/** `{lines?, additional_changes?, thought_process?, next_steps?}`; `lines` keeps only the listed lines, in order. */
export function editCard(id, cardId, patch) {
  return send(queryKeys.stockCard(id, cardId), "PATCH", patch)
}

/** Applies every open Ask me card in the report. */
export function applyRun(id, runId) {
  return send(`${queryKeys.stockRun(id, runId)}/apply-all`, "POST")
}

/** Keeps an uploaded video for an Add line (and any later Add of that creative). */
export function attachLineFile(id, cardId, lineId, blobUrl) {
  return send(`${queryKeys.stockCard(id, cardId)}/lines/${encodeURIComponent(lineId)}/file`, "POST", { blob_url: blobUrl })
}

export function keepLesson(id, lessonId) {
  return send(`${queryKeys.stockLessons(id)}/${encodeURIComponent(lessonId)}/keep`, "POST")
}

export function overruleLesson(id, lessonId) {
  return send(`${queryKeys.stockLessons(id)}/${encodeURIComponent(lessonId)}/overrule`, "POST")
}

/** Posts the weekly message to Slack. 409 for a preview or a post already under way; 502 when Slack refuses. */
export function postWeekly(id, runId) {
  return send(`${queryKeys.stockRun(id, runId)}/weekly/post`, "POST")
}

/** Saves a template's `blocks`. A bad template is a 400 with `errors`. */
export function saveSlackTemplate(id, kind, blocks) {
  return send(queryKeys.stockSlackTemplate(id, kind), "PUT", { blocks })
}

/** Goes back to the default template. */
export function resetSlackTemplate(id, kind) {
  return send(queryKeys.stockSlackTemplate(id, kind), "DELETE")
}

/** Renders `blocks` (the unsaved draft; else the saved template) with sample values. Nothing is sent to Slack. */
export function previewSlackTemplate(id, kind, blocks) {
  return send(`${queryKeys.stockSlackTemplate(id, kind)}/preview`, "POST", blocks === undefined ? {} : { blocks })
}

// ─── Revalidation ────────────────────────────────────────────────────────────

/**
 * Re-reads everything a decision can change for this agent: the agent, its reports (latest and each run),
 * the scoreboard, lessons, Slack templates, and with them the nav badge. Pass the `mutate` from `useSWRConfig()`.
 */
export function revalidateStock(mutate, id) {
  const base = `/api/agents/${id}`
  const mine = (key) =>
    typeof key === "string" &&
    (key === base || ["/runs", "/outcomes", "/lessons", "/slack-templates"].some((p) => key.startsWith(`${base}${p}`)))
  return Promise.all([mutate(mine), revalidateAgentWork(mutate)])
}

/**
 * The mutations above bound to one agent, each re-reading what it changes once it settles (a refusal
 * included, since the page it came from is stale). Pages use these rather than the bare functions.
 */
export function useStockActions(id) {
  const { mutate } = useSWRConfig()
  const run = (fn) => async (...args) => {
    try {
      return await fn(id, ...args)
    } finally {
      await revalidateStock(mutate, id)
    }
  }
  return {
    patchSettings: run(patchSettings),
    startPreview: run(startPreview),
    applyCard: run(applyCard),
    dismissCard: run(dismissCard),
    undoCardLine: run(undoCardLine),
    editCard: run(editCard),
    applyRun: run(applyRun),
    attachLineFile: run(attachLineFile),
    keepLesson: run(keepLesson),
    overruleLesson: run(overruleLesson),
    postWeekly: run(postWeekly),
    saveSlackTemplate: run(saveSlackTemplate),
    resetSlackTemplate: run(resetSlackTemplate),
    previewSlackTemplate: (...args) => previewSlackTemplate(id, ...args),
  }
}
