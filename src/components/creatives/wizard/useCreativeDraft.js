"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { createCreativeTest, updateCreativeTest, useCreativeTest } from "@/lib/creatives-api"
import { slugify } from "@/lib/creative-naming"

export const SAVE_DELAY_MS = 800

/** Fields copied from a revived ad; editing one makes the test a variant. */
export const COPIED_FIELDS = ["media", "format", "primary_text", "headline", "description", "cta_type", "destination", "website_url"]

export const EMPTY_DRAFT = {
  id: null,
  code: null,
  name: "",
  slug: "",
  origin: "new",
  source: null,
  creative: {
    format: null,
    media: null,
    primary_text: "",
    headline: "",
    description: "",
    cta_type: "LEARN_MORE",
    destination: "lead_form",
    website_url: "",
  },
}

function setIn(obj, path, value) {
  const [head, ...rest] = path.split(".")
  return { ...obj, [head]: rest.length ? setIn(obj[head] ?? {}, rest.join("."), value) : value }
}

/** What goes to the API. `source` and `origin` are fixed at creation. */
const patchOf = (d) => ({ name: d.name || "Untitled", slug: d.slug || undefined, creative: d.creative })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * The wizard's draft: created on the first change, then saved 800 ms after the last one.
 * Saves are serialised and a value equal to the last saved one is never sent again.
 *
 * @param {string|null} testId Existing draft to load, or null for a new one.
 * @param {{ onCreated?: (test: object) => void }} [opts]
 * @returns {{ draft: object, setField: (path: string, value: any) => void,
 *   setFields: (changes: Record<string, any>, opts?: { silent?: boolean }) => void, save: () => Promise<object|null>,
 *   saving: boolean, error: Error|null }}
 */
export function useCreativeDraft(testId, { onCreated } = {}) {
  const { test } = useCreativeTest(testId)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const draftRef = useRef(EMPTY_DRAFT)
  const idRef = useRef(testId ?? null)
  const savedRef = useRef(null) // last patch body known to be on the server
  const slugTouched = useRef(false)
  const timer = useRef(null)
  const chain = useRef(Promise.resolve(null))
  const hydrated = useRef(false)
  const pending = useRef(0)
  const dirty = useRef(false)
  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated

  const commit = useCallback((next) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  // Load an existing draft once.
  useEffect(() => {
    if (!test || hydrated.current || !testId) return
    hydrated.current = true
    const loaded = {
      ...EMPTY_DRAFT,
      id: test.id,
      code: test.code,
      name: test.name ?? "",
      slug: test.slug ?? "",
      origin: test.origin ?? "new",
      source: test.source ?? null,
      status: test.status,
      creative: { ...EMPTY_DRAFT.creative, ...(test.creative ?? {}) },
    }
    slugTouched.current = loaded.slug !== slugify(loaded.name)
    savedRef.current = patchOf(loaded)
    commit(loaded)
  }, [test, testId, commit])

  const runSave = useCallback(async () => {
    const d = draftRef.current
    try {
      if (!idRef.current) {
        const created = await createCreativeTest({
          name: d.name || "Untitled",
          origin: d.origin,
          creative: d.creative,
          ...(d.source ? { source: d.source } : {}),
          ...(slugTouched.current && d.slug ? { slug: d.slug } : {}),
        })
        idRef.current = created.id
        savedRef.current = patchOf(d)
        commit({ ...draftRef.current, id: created.id, code: created.code, slug: draftRef.current.slug || created.slug || "" })
        onCreatedRef.current?.(created)
        setError(null)
        return created
      }
      const body = patchOf(d)
      const prev = savedRef.current
      const changed = {}
      for (const k of Object.keys(body)) if (!prev || !same(body[k], prev[k])) changed[k] = body[k]
      if (Object.keys(changed).length === 0) return null
      const updated = await updateCreativeTest(idRef.current, changed)
      savedRef.current = body
      setError(null)
      return updated
    } catch (e) {
      setError(e)
      return null
    }
  }, [commit])

  /** Runs after every earlier save so two saves never overlap. */
  const enqueue = useCallback(() => {
    pending.current += 1
    setSaving(true)
    const run = chain.current.then(runSave)
    chain.current = run
    run.finally(() => {
      pending.current -= 1
      if (pending.current === 0) setSaving(false)
    })
    return run
  }, [runSave])

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    if (!idRef.current && pending.current === 0) {
      // First meaningful change: create now, later changes ride the debounce.
      timer.current = null
      dirty.current = false
      enqueue()
      return
    }
    timer.current = setTimeout(() => {
      timer.current = null
      dirty.current = false
      enqueue()
    }, SAVE_DELAY_MS)
  }, [enqueue])

  const apply = useCallback(
    (changes, { markEdited, silent = false }) => {
      let next = draftRef.current
      const before = next
      for (const [path, value] of Object.entries(changes)) {
        if (same(path.split(".").reduce((o, k) => o?.[k], next), value)) continue
        next = setIn(next, path, value)
        if (path === "name" && !slugTouched.current) next = { ...next, slug: slugify(value) }
        if (path === "slug") slugTouched.current = true
        if (markEdited && next.origin === "revive" && path.startsWith("creative.") && COPIED_FIELDS.includes(path.slice(9))) {
          next = setIn(next, "creative.edited", true)
        }
      }
      if (next === before) return
      commit(next)
      if (silent) return
      dirty.current = true
      schedule()
    },
    [commit, schedule]
  )

  const setField = useCallback((path, value) => apply({ [path]: value }, { markEdited: true }), [apply])
  /**
   * Several fields at once, without flagging the test as edited (a pick, not an edit).
   * `silent` keeps it local: no save is scheduled (choosing a path is not a draft yet).
   */
  const setFields = useCallback((changes, { silent = false } = {}) => apply(changes, { markEdited: false, silent }), [apply])

  /** Saves whatever is pending now and resolves once the server has it. */
  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!dirty.current) return chain.current
    dirty.current = false
    return enqueue()
  }, [enqueue])

  // Leaving the page saves what is still waiting on the debounce.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        enqueue()
      }
    },
    [enqueue]
  )

  return { draft, setField, setFields, save, saving, error }
}
