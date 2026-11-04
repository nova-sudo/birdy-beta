import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("swr", () => ({ default: vi.fn(() => ({})) }))

import useSWR from "swr"
import { apiRequest } from "@/lib/api"
import {
  STOCK_AGENT_TYPE,
  STOCK_SETUP_PATH,
  STOCK_AGENT_PATH,
  REASON_COPY,
  reasonCopy,
  ACTIVITY_COPY,
  useStockAgent,
  useLatestRun,
  useRun,
  useOutcomes,
  useLessons,
  useSlackTemplate,
  createStockAgent,
  patchSettings,
  startPreview,
  applyCard,
  dismissCard,
  undoCardLine,
  editCard,
  applyRun,
  attachLineFile,
  keepLesson,
  overruleLesson,
  postWeekly,
  saveSlackTemplate,
  resetSlackTemplate,
  previewSlackTemplate,
} from "../stock-agent-api"

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body })
const lastCall = () => {
  const [path, init] = vi.mocked(apiRequest).mock.calls.at(-1)
  return { path, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : undefined }
}

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockResolvedValue(ok())
  vi.mocked(useSWR).mockReset()
  vi.mocked(useSWR).mockReturnValue({})
})

describe("stock agent mutations match the backend routes", () => {
  it("createStockAgent posts the stock type", async () => {
    await createStockAgent()
    expect(lastCall()).toEqual({ path: "/api/agents", method: "POST", body: { type: "stock_media_buying" } })
    expect(STOCK_AGENT_TYPE).toBe("stock_media_buying")
  })

  it("patchSettings sends settings, and only_flag only with the client list", async () => {
    await patchSettings("a1", { settings: { zones: {} }, client_group_ids: ["g1"], move_claims: true, only_flag: ["g1"] })
    expect(lastCall()).toEqual({
      path: "/api/agents/a1/settings",
      method: "PATCH",
      body: { settings: { zones: {} }, client_group_ids: ["g1"], move_claims: true, only_flag: ["g1"] },
    })
  })

  it("startPreview posts to preview", async () => {
    await startPreview("a1")
    expect(lastCall()).toMatchObject({ path: "/api/agents/a1/preview", method: "POST" })
  })

  it("card decisions", async () => {
    await applyCard("a1", "c1", ["l1"])
    expect(lastCall()).toEqual({ path: "/api/agents/a1/cards/c1/apply", method: "POST", body: { line_ids: ["l1"] } })
    await applyCard("a1", "c1")
    expect(lastCall().body).toEqual({})
    await dismissCard("a1", "c1", "not now")
    expect(lastCall()).toEqual({ path: "/api/agents/a1/cards/c1/dismiss", method: "POST", body: { reason: "not now" } })
    await dismissCard("a1", "c1")
    expect(lastCall().body).toEqual({})
    await undoCardLine("a1", "c1", "l1")
    expect(lastCall()).toEqual({ path: "/api/agents/a1/cards/c1/undo", method: "POST", body: { line_id: "l1" } })
    await editCard("a1", "c1", { next_steps: "x" })
    expect(lastCall()).toEqual({ path: "/api/agents/a1/cards/c1", method: "PATCH", body: { next_steps: "x" } })
    await applyRun("a1", "r1")
    expect(lastCall()).toMatchObject({ path: "/api/agents/a1/runs/r1/apply-all", method: "POST" })
    await attachLineFile("a1", "c1", "l1", "https://blob/x")
    expect(lastCall()).toEqual({
      path: "/api/agents/a1/cards/c1/lines/l1/file",
      method: "POST",
      body: { blob_url: "https://blob/x" },
    })
  })

  it("lessons and weekly", async () => {
    await keepLesson("a1", "m1")
    expect(lastCall()).toMatchObject({ path: "/api/agents/a1/lessons/m1/keep", method: "POST" })
    await overruleLesson("a1", "m1")
    expect(lastCall()).toMatchObject({ path: "/api/agents/a1/lessons/m1/overrule", method: "POST" })
    await postWeekly("a1", "r1")
    expect(lastCall()).toMatchObject({ path: "/api/agents/a1/runs/r1/weekly/post", method: "POST" })
  })

  it("slack templates", async () => {
    await saveSlackTemplate("a1", "morning", [{ type: "section" }])
    expect(lastCall()).toEqual({
      path: "/api/agents/a1/slack-templates/morning",
      method: "PUT",
      body: { blocks: [{ type: "section" }] },
    })
    await resetSlackTemplate("a1", "morning")
    expect(lastCall()).toMatchObject({ path: "/api/agents/a1/slack-templates/morning", method: "DELETE" })
    await previewSlackTemplate("a1", "morning", [{ type: "section" }])
    expect(lastCall()).toEqual({
      path: "/api/agents/a1/slack-templates/morning/preview",
      method: "POST",
      body: { blocks: [{ type: "section" }] },
    })
    await previewSlackTemplate("a1", "morning")
    expect(lastCall().body).toEqual({})
  })

  it("a refusal throws with the server's plain reason and status", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: "Choose at least one client first" }) })
    await expect(startPreview("a1")).rejects.toMatchObject({ status: 409, message: "Choose at least one client first" })
  })
})

describe("stock agent reads use the route as the key and idle without an id", () => {
  const key = () => vi.mocked(useSWR).mock.calls.at(-1)[0]
  it("keys", () => {
    useLatestRun("a1")
    expect(key()).toBe("/api/agents/a1/runs/latest")
    useRun("a1", "r1")
    expect(key()).toBe("/api/agents/a1/runs/r1")
    useOutcomes("a1")
    expect(key()).toBe("/api/agents/a1/outcomes")
    useLessons("a1")
    expect(key()).toBe("/api/agents/a1/lessons")
    useSlackTemplate("a1", "morning")
    expect(key()).toBe("/api/agents/a1/slack-templates/morning")
  })
  it("idle keys", () => {
    useLatestRun(null)
    expect(key()).toBeNull()
    useRun("a1", null)
    expect(key()).toBeNull()
    useSlackTemplate("a1", null)
    expect(key()).toBeNull()
  })
  it("useStockAgent finds the stock agent in the list", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: [{ id: "c", type: "custom" }, { id: "s", type: "stock_media_buying", status: "draft" }],
    })
    const { agent } = useStockAgent()
    expect(agent.id).toBe("s")
  })
  it("paths", () => {
    expect(STOCK_AGENT_PATH).toBe("/hub/agents/media-buying")
    expect(STOCK_SETUP_PATH).toBe("/hub/agents/media-buying/setup")
  })
})

describe("plain-language reason copy", () => {
  it("covers the codes the backend sends", () => {
    for (const c of ["no_words", "unsupported_landing", "now_flag", "not_auto", "left_paused", "unconfirmed", "already_run", "needs_file"]) {
      expect(REASON_COPY[c], c).toBeTruthy()
    }
    expect(ACTIVITY_COPY.ad_left_paused).toBeTruthy()
  })
  it("has no developer jargon or em dashes", () => {
    for (const text of [...Object.values(REASON_COPY), ...Object.values(ACTIVITY_COPY)]) {
      expect(text).not.toMatch(/—|_|\bAPI\b|\bsuperseded\b|\bwebhook\b/i)
    }
  })
  it("reasonCopy falls back to the server's message, then to a safe line", () => {
    expect(reasonCopy("left_paused")).toBe(REASON_COPY.left_paused)
    expect(reasonCopy("brand_new_code", "Server said this.")).toBe("Server said this.")
    expect(reasonCopy("brand_new_code")).toBe(REASON_COPY.default)
    expect(reasonCopy(null, null)).toBe(REASON_COPY.default)
  })
})
