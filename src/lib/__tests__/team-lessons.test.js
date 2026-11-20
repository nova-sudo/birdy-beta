import { describe, it, expect, vi, beforeEach } from "vitest"
const request = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/context-api", () => ({ request: (...a) => request(...a) }))
import { addLesson, changeLesson, lessonErrorMessage, lessonsKey, normalizeLesson, removeLesson, sortLessons } from "../team-lessons"

beforeEach(() => request.mockReset())

describe("an agent's lessons", () => {
  it("are read per agent, with a client when there is one", () => {
    expect(lessonsKey("media_buyer")).toBe("/api/team/media_buyer/lessons")
    expect(lessonsKey("sales_coach", "g 1")).toBe("/api/team/sales_coach/lessons?client_group_id=g%201")
    expect(lessonsKey(null)).toBeNull()
  })

  it("are made safe to draw", () => {
    expect(normalizeLesson({ id: "l1", text: "Keep it", client_group_id: "", source: 4 })).toEqual({ id: "l1", text: "Keep it", client_group_id: null, client_name: null, source: null, created_at: null, updated_at: null })
    expect(normalizeLesson({ text: "no id" })).toBeNull()
  })

  it("come newest first, and inside a client its own first", () => {
    const list = [
      { id: "a", client_group_id: null, created_at: "2026-11-10T00:00:00Z" },
      { id: "b", client_group_id: "g0", created_at: "2026-11-01T00:00:00Z" },
      { id: "c", client_group_id: null, created_at: "2026-11-12T00:00:00Z" },
    ]
    expect(sortLessons(list).map((l) => l.id)).toEqual(["c", "a", "b"])
    expect(sortLessons(list, "g0").map((l) => l.id)).toEqual(["b", "c", "a"])
  })

  it("are added, changed and deleted at the agent's own address", async () => {
    await addLesson("media_buyer", { text: "Hi", clientId: null })
    await addLesson("sales_coach", { text: "Hi", clientId: "g0" })
    await changeLesson("media_buyer", "l 1", "New")
    await removeLesson("media_buyer", "l1")
    expect(request.mock.calls).toEqual([
      ["/api/team/media_buyer/lessons", "POST", { text: "Hi" }],
      ["/api/team/sales_coach/lessons", "POST", { text: "Hi", client_group_id: "g0" }],
      ["/api/team/media_buyer/lessons/l%201", "PATCH", { text: "New" }],
      ["/api/team/media_buyer/lessons/l1", "DELETE"],
    ])
  })

  it("show the server's reason for a refusal", () => {
    expect(lessonErrorMessage({ status: 400, detail: "Too long." })).toBe("Too long.")
    expect(lessonErrorMessage({ status: 500 })).toMatch(/didn’t save/)
  })
})
