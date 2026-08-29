// Global background-jobs registry.
//
// Long-running work (call analysis from the Calls tab, a slow Birdy chat
// analysis) registers here so the sidebar can show a "working…" indicator the
// user can see from anywhere, instead of the only signal being a spinner
// inside a modal they may have closed.
//
// Module-level store + useSyncExternalStore rather than a context provider:
// jobs are started from non-React code (lib/chat-store.js) as well as from
// components, and a module store is reachable from both. Mirrors the pattern
// of lib/ask-birdy.js (two ends in different subtrees, nothing in between
// needs to know).

import { useSyncExternalStore } from "react"

let jobs = [] // [{ id, label, detail, status: "running"|"done"|"error", startedAt }]
const listeners = new Set()
let nextId = 1

// How long a finished job stays visible in the sidebar list before vanishing.
const DONE_LINGER_MS = 6000

function emit() {
  jobs = [...jobs] // new identity so useSyncExternalStore sees the change
  listeners.forEach((fn) => fn())
}

/** Register a running job. Returns its id for finishJob(). */
export function startJob(label, { detail = null } = {}) {
  const id = nextId++
  jobs.push({ id, label, detail, status: "running", startedAt: Date.now() })
  emit()
  return id
}

/** Mark a job finished (status "done" or "error"); it lingers briefly, then disappears. */
export function finishJob(id, { status = "done", detail } = {}) {
  const job = jobs.find((j) => j.id === id)
  if (!job) return
  job.status = status
  if (detail !== undefined) job.detail = detail
  emit()
  setTimeout(() => {
    jobs = jobs.filter((j) => j.id !== id)
    emit()
  }, DONE_LINGER_MS)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const getSnapshot = () => jobs

/** Reactive list of current jobs (running + recently finished). */
export function useJobs() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
