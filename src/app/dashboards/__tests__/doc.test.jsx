// useDashboardDoc: a stored v2 doc (saved with dashkit 0.3) is upgraded to v3
// as it loads, with the catalog, the way the backend migrates the same doc.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { CURRENT_VERSION, migrate, validate } from "dashkit/core"
import { registry } from "@/lib/dashkit/registry"
import BIRDY_V2 from "./fixtures/birdy-v2.json"
import CATALOG from "./fixtures/birdy-catalog.json"
import { useDashboardDoc } from "../[id]/useDashboardDoc"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  text: async () => JSON.stringify(body),
})

let stored = BIRDY_V2
let catalogStatus = 200
beforeEach(() => {
  stored = BIRDY_V2
  catalogStatus = 200
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === "/api/dashboards/catalog") return res(CATALOG, catalogStatus)
    if (path === `/api/dashboards/${stored.id}`) return res(stored)
    return res({}, 404)
  })
})

const wrapper = ({ children }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
)
const load = (id = stored.id) => renderHook(() => useDashboardDoc(id), { wrapper })

const byId = (doc) => Object.fromEntries(doc.widgets.map((w) => [w.id, w]))

describe("useDashboardDoc", () => {
  it("useDashboardDoc migrates a v2 doc to v3 on load", async () => {
    const { result } = load()

    await waitFor(() => expect(result.current.doc).not.toBeNull())
    const doc = result.current.doc
    expect(CURRENT_VERSION).toBe(3)
    expect(doc.version).toBe(3)
    // Ids, titles and order survive; every data widget carries one query.
    expect(doc.widgets.map((w) => w.id)).toEqual(BIRDY_V2.widgets.map((w) => w.id))
    const w = byId(doc)
    expect(w.w_kpi_spend).toMatchObject({
      type: "kpi",
      title: "Spend (last 7 days)",
      bindings: { query: { metrics: [{ metric: "spend" }], window: { preset: "last_7d" }, compare: "previous", spark: true } },
    })
    expect(w.w_kpi_strip.bindings.query.metrics.map((m) => m.metric)).toEqual(["spend", "meta_leads", "clicks", "ctr"])
    expect(w.w_trend_day).toMatchObject({ type: "trend", bindings: { query: { over: "day" } } })
    expect(w.w_trend_client).toMatchObject({ type: "chart", bindings: { query: { by: "client" } } })
    expect(w.w_bar).toMatchObject({ type: "chart", data: { chart: "bar" }, bindings: { query: { by: "client" } } })
    expect(w.w_funnel).toMatchObject({ type: "funnel", bindings: { query: { metrics: [{ metric: "impressions" }] } } })
    expect(w.w_leaders).toMatchObject({ type: "leaderboard", bindings: { query: { by: "client", sort: { metric: "spend", dir: "desc" }, limit: 5 } } })
    expect(w.w_table).toMatchObject({ type: "table", bindings: { query: { by: "client" } } })
    expect(w.w_briefing).toMatchObject({ type: "briefing", data: {} })
    expect(w.w_briefing.bindings).toBeUndefined()
    // A migrated doc passes validation against the catalog it was migrated with.
    expect(validate(doc, { registry, catalog: CATALOG }).errors).toEqual([])
  })

  // The catalog changes what a v2 widget becomes: the backend migrates with it
  // too, so the editor and the backend see the same v3 doc.
  it("migrates with the catalog, as the backend does", async () => {
    const { result } = load()

    await waitFor(() => expect(result.current.doc).not.toBeNull())
    const w = byId(result.current.doc)
    // CTR is not additive, so the v2 donut of it becomes a bar chart.
    expect(w.w_donut).toMatchObject({ type: "chart", data: { chart: "bar" } })
    // One value axis: the comparison keeps only the metrics in spend's format.
    expect(w.w_compare.bindings.query.metrics.map((m) => m.metric)).toEqual(["spend"])
    expect(result.current.doc).toEqual(migrate(BIRDY_V2, { registry, catalog: CATALOG }))
    // Without the catalog both would differ: the test above is not vacuous.
    const blind = byId(migrate(BIRDY_V2, { registry }))
    expect(blind.w_donut.data.chart).toBe("donut")
    expect(blind.w_compare.bindings.query.metrics).toHaveLength(2)
  })

  it("a v3 doc loads unchanged", async () => {
    stored = { ...migrate(BIRDY_V2, { registry, catalog: CATALOG }), id: "d3" }
    const { result } = load("d3")

    await waitFor(() => expect(result.current.doc).not.toBeNull())
    expect(result.current.doc).toEqual(stored)
  })

  it("waits for the catalog: no doc, and an error when the catalog can't load", async () => {
    catalogStatus = 500
    const { result } = load()

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.doc).toBeNull()
  })
})
