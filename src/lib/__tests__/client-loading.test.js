import { describe, it, expect } from "vitest"
import { isAwaitingFirstData, isBeingCreated } from "@/lib/client-loading"

/** A client that has finished loading everything it is connected to. */
const settled = (extra = {}) => ({
  status: "complete",
  ghl_location_id: "loc_1",
  meta_ad_account_id: "act_1",
  call_log_provider: "ghl",
  last_ghl_refresh: "2026-09-06T10:00:00Z",
  last_meta_refresh: "2026-09-06T10:00:00Z",
  ...extra,
})

describe("isAwaitingFirstData", () => {
  it("is false once every connected integration has refreshed", () => {
    expect(isAwaitingFirstData(settled())).toBe(false)
  })

  it("is true for a bulk-imported client whose data has not landed", () => {
    // The exact case this exists for: the import's background task sets
    // status "complete" as soon as the GHL token is minted, seconds in, while
    // the contacts arrive later on a cron tick. Twenty-five rows sat there
    // reporting 0 and looking finished.
    expect(isAwaitingFirstData(settled({
      status: "complete",
      last_ghl_refresh: null,
      last_meta_refresh: null,
    }))).toBe(true)
  })

  it("is true while the document itself is still being written", () => {
    expect(isAwaitingFirstData(settled({ status: "creating" }))).toBe(true)
    expect(isAwaitingFirstData(settled({ status: "pending" }))).toBe(true)
  })

  it("does not wait on GHL for a client that has no GHL location", () => {
    // Keying off last_ghl_refresh alone would leave a Meta-only client
    // shimmering forever, because nothing will ever write that timestamp.
    expect(isAwaitingFirstData(settled({
      ghl_location_id: null,
      last_ghl_refresh: null,
    }))).toBe(false)
  })

  it("does not wait on Meta for a client with no ad account", () => {
    expect(isAwaitingFirstData(settled({
      meta_ad_account_id: null,
      last_meta_refresh: null,
    }))).toBe(false)
  })

  it("waits on HotProspector only when that is the client's dialler", () => {
    const noHpRefresh = { last_hp_refresh: null }
    expect(isAwaitingFirstData(settled({ ...noHpRefresh, call_log_provider: "hotprospector" }))).toBe(true)
    expect(isAwaitingFirstData(settled({ ...noHpRefresh, call_log_provider: "ghl" }))).toBe(false)
    // "I don't call my leads" — there is no dialler and never will be.
    expect(isAwaitingFirstData(settled({ ...noHpRefresh, call_log_provider: "none" }))).toBe(false)
  })

  it("is still waiting if only one of two integrations has landed", () => {
    expect(isAwaitingFirstData(settled({ last_meta_refresh: null }))).toBe(true)
    expect(isAwaitingFirstData(settled({ last_ghl_refresh: null }))).toBe(true)
  })

  it("handles a missing group without throwing", () => {
    expect(isAwaitingFirstData(null)).toBe(false)
    expect(isAwaitingFirstData(undefined)).toBe(false)
  })
})

describe("isBeingCreated", () => {
  it("separates 'no document yet' from 'no data yet'", () => {
    // Only the first should stop the row being clickable.
    expect(isBeingCreated({ status: "creating" })).toBe(true)
    expect(isBeingCreated({ status: "complete", last_ghl_refresh: null })).toBe(false)
  })
})
