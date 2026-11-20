import { describe, it, expect, beforeEach } from "vitest"
import { conversationsFor, rememberSectionChat, sectionChatIds } from "../section-chats"

beforeEach(() => localStorage.clear())

describe("a section's conversations", () => {
  it("remembers the ones started in a section, newest first, once each", () => {
    rememberSectionChat("buyer", "a")
    rememberSectionChat("buyer", "b")
    rememberSectionChat("buyer", "a")
    rememberSectionChat("coach", "c")
    expect([...sectionChatIds("buyer")]).toEqual(["a", "b"])
    expect([...sectionChatIds("coach")]).toEqual(["c"])
    expect(sectionChatIds("ops").size).toBe(0)
  })

  it("lists a conversation by its agent when the server says, otherwise by what this browser remembers", () => {
    const list = [{ session_id: "a" }, { session_id: "b", agent: "sales_coach" }, { session_id: "c", agent: "media_buyer" }, { session_id: "d" }]
    expect(conversationsFor(list, "media_buyer", new Set(["a", "b"])).map((c) => c.session_id)).toEqual(["a", "c"])
  })

  it("survives storage that cannot be read", () => {
    localStorage.setItem("by_section_chats", "not json")
    expect(sectionChatIds("buyer").size).toBe(0)
    rememberSectionChat("buyer", "x")
    expect([...sectionChatIds("buyer")]).toEqual(["x"])
  })
})
