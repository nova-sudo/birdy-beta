import { describe, it, expect } from "vitest"
import { parseChatUI } from "@/lib/chat-ui-parser"

const card = { test_id: "t1", code: "CT-0048", name: "Spring", accounts: [], warnings: [] }

describe("parseChatUI :::creative", () => {
  it("extracts a creative block with a closing fence", () => {
    const { segments } = parseChatUI(`Here:\n:::creative ${JSON.stringify(card)}:::\nOK?`)
    expect(segments.map(s => s.type)).toEqual(["text", "creative", "text"])
    expect(segments[1].payload.code).toBe("CT-0048")
  })

  it("extracts a creative block without a closing fence", () => {
    const { segments } = parseChatUI(`:::creative ${JSON.stringify(card)}`)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ type: "creative", payload: { test_id: "t1" } })
  })

  it("leaves malformed JSON as text instead of throwing", () => {
    const { segments } = parseChatUI(":::creative {not json}:::")
    expect(segments.every(s => s.type === "text")).toBe(true)
  })
})
