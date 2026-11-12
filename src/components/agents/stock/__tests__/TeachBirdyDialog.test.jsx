import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: () => <span data-testid="birdy-avatar" /> }))

const mutate = vi.fn()
vi.mock("swr", async (importOriginal) => ({ ...(await importOriginal()), useSWRConfig: () => ({ mutate }) }))

// The real chat needs AI keys and credits; this stand-in renders the store's messages and reports them.
vi.mock("@/components/chat/ChatConversation", async () => {
  const { useChat } = await import("@/lib/chat-store")
  return {
    default: function ChatStub(props) {
      const { messages } = useChat(props.sessionKey)
      const { onMessagesChange } = props
      useEffect(() => onMessagesChange?.(messages), [messages, onMessagesChange])
      return (
        <div data-testid="chat" data-page={props.page}>
          {messages.map((m, i) => (
            <div key={i}>
              <p>{m.content}</p>
              {m.role !== "user" && props.renderAfterMessage?.(m, i)}
            </div>
          ))}
        </div>
      )
    },
  }
})

import { appendMessage, resetChat } from "@/lib/chat-store"
import { queryKeys } from "@/lib/query-keys"
import { TeachBirdyDialog, lessonChips } from "../TeachBirdyDialog"

const KEY = "stock_lessons:ag1"

beforeEach(() => {
  mutate.mockClear()
  resetChat(KEY)
})

describe("TeachBirdyDialog", () => {
  it("chips come from what the BE's lesson tools changed (save_lesson, not add_lesson)", () => {
    expect(lessonChips({ agent_changes: [{ tool: "save_lesson", changed: "lesson" }] })).toEqual(["Lesson saved"])
    expect(lessonChips({ agent_changes: [{ tool: "edit_lesson", changed: "lesson_edited" }] })).toEqual(["Lesson changed"])
    expect(lessonChips({ agent_changes: [{ tool: "remove_lesson", changed: "lesson_removed" }] })).toEqual(["Lesson removed"])
    expect(lessonChips({ agent_changes: [{ tool: "list_lessons" }] })).toEqual([])
    expect(lessonChips({})).toEqual([])
  })

  it("a saved lesson shows its chip and re-reads the Lessons list", async () => {
    const onChanged = vi.fn()
    render(<TeachBirdyDialog agentId="ag1" onChanged={onChanged} />)
    fireEvent.click(screen.getByRole("button", { name: "Teach Birdy" }))
    expect(screen.getByTestId("chat")).toHaveAttribute("data-page", "stock_lessons")
    act(() => appendMessage(KEY, { role: "user", content: "never pause ads on Fridays" }))
    act(() =>
      appendMessage(KEY, {
        role: "assistant",
        content: "Saved.",
        tools_used: ["save_lesson"],
        agent_changes: [{ tool: "save_lesson", changed: "lesson" }],
      })
    )
    expect(await screen.findByText("Lesson saved")).toBeInTheDocument()
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(queryKeys.stockLessons("ag1")))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalledWith("lesson")
  })

  it("a reply that changed nothing doesn't re-read the list", async () => {
    render(<TeachBirdyDialog agentId="ag1" />)
    fireEvent.click(screen.getByRole("button", { name: "Teach Birdy" }))
    act(() => appendMessage(KEY, { role: "assistant", content: "Here are your lessons.", tools_used: ["list_lessons"] }))
    expect(await screen.findByText("Here are your lessons.")).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })
})
