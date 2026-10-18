import { applyAll, diff, validate } from "dashkit/core"

// ─── Ask Birdy → dashboard edits ────────────────────────────────────────────
// The "My dashboards" chat never writes the stored doc. Its tools return
// dashkit ops (`dashboard_ops` on the /api/chat reply) and the page applies
// them to the doc the user is looking at, unsaved edits included, then saves.
// This module is that apply step, kept free of React so it can be tested
// against a plain history.

/**
 * Validation errors the editor treats as a draft, not a fault: the palette
 * itself adds unbound widgets, so an op batch that adds one is no worse than
 * the user clicking "Add KPI".
 */
const DRAFT_CODES = new Set(["SLOT_REQUIRED"])

/**
 * `validate()` reports paths by index (`sections.0.widgets.2.bindings.value`),
 * which shift when anything moves. Re-key them by section/widget id so an
 * existing error that merely moved is not mistaken for a new one.
 */
function errorKeys(doc, ctx) {
  const keys = new Map()
  for (const e of validate(doc, ctx).errors) {
    if (DRAFT_CODES.has(e.code)) continue
    const path = e.path.replace(/^sections\.(\d+)(?:\.widgets\.(\d+))?/, (whole, si, wi) => {
      const section = doc.sections?.[Number(si)]
      if (!section) return whole
      if (wi === undefined) return `section:${section.id}`
      const widget = section.widgets?.[Number(wi)]
      return widget ? `widget:${widget.id}` : whole
    })
    keys.set(`${path}|${e.code}|${e.message}`, e)
  }
  return keys
}

const messageOf = (err) => (err instanceof Error ? err.message : String(err))

/**
 * Apply one reply's ops to the live dashboard.
 *
 * `target` is anything exposing `getDoc()` and `applyAll(ops, author) → doc`:
 * the editor's imperative handle in edit mode, a thin wrapper around the
 * page's own state in view mode. The ops are dry-run first with dashkit's pure
 * `applyAll`, so a bad batch is rejected with a message before the target (and
 * its undo history) is touched, and the batch is atomic either way.
 *
 * Validation rejects only errors the ops introduce: a doc that already had a
 * problem (a metric since removed from the catalog, say) must not block every
 * AI edit after it. When the catalog has not loaded yet the check is skipped;
 * the backend validated the same ops against the same catalog.
 *
 * Never throws: whatever goes wrong comes back as `error`, for the chat to
 * show under the reply.
 *
 * @param {{ getDoc(): object, applyAll(ops: object[], author?: string): object }} target
 * @param {object[]} ops
 * @param {{ dashboardId: string, currentId: string, registry: object, catalog?: object|null }} ctx
 * @returns {{ applied: boolean, diff: string[], error?: string, doc?: object }}
 */
export function applyIncomingOps(target, ops, { dashboardId, currentId, registry, catalog }) {
  if (dashboardId !== currentId) {
    return { applied: false, diff: [], error: "These changes were for a different dashboard." }
  }
  if (!Array.isArray(ops) || ops.length === 0) return { applied: false, diff: [] }

  const before = target.getDoc()
  let preview
  try {
    preview = applyAll(before, ops, { registry, author: "ai" })
  } catch (err) {
    return { applied: false, diff: [], error: messageOf(err) }
  }

  if (catalog) {
    const existing = errorKeys(before, { registry, catalog })
    const introduced = [...errorKeys(preview, { registry, catalog })].filter(([key]) => !existing.has(key))
    if (introduced.length > 0) {
      return { applied: false, diff: [], error: introduced[0][1].message }
    }
  }

  let after
  try {
    after = target.applyAll(ops, "ai")
  } catch (err) {
    return { applied: false, diff: [], error: messageOf(err) }
  }
  // The editor's handle reports a rejected op by returning the doc unchanged.
  if (after === before) {
    return { applied: false, diff: [], error: "The editor rejected these changes." }
  }
  return { applied: true, diff: diff(before, after), doc: after }
}
