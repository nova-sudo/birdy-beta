import { describe, it, expect, vi } from "vitest"
import { createRef } from "react"
import { render, screen, act } from "@testing-library/react"

let lastProps
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    lastProps = props
    return <div data-testid="chat">{props.renderAfterMessage?.(MESSAGE, 1)}</div>
  },
}))

let MESSAGE
import { TrainingChat, changeChips, describeChange } from "../TrainingChat"

describe("TrainingChat", () => {
  it("describes each training tool's change", () => {
    expect(
      describeChange({ tool: "set_rule_param", changed: { rule_kind: "pause_over_target", param: "patience_spend", before: 60, after: 80 } }, "€")
    ).toBe("Pause ads over target: Spend before judging €60 → €80")
    expect(describeChange({ client: "Palm Peach", param: "cpl", before: null, after: 24 }, "£")).toBe(
      "Palm Peach CPL target none → £24"
    )
    expect(
      describeChange({ rule_kind: "pause_over_target", param: "cpl_multiple", client: "Tyla", before: 1.5, after: 2 })
    ).toBe("Tyla: CPL multiple of target 1.5× → 2×")
    expect(describeChange({ text: "Never touch Evergreen ads" })).toBe("Remembered: Never touch Evergreen ads")
    expect(describeChange({ text: "Skip weekends", filter: { weekdays: [5, 6] } })).toBe("Exception: Skip weekends")
    expect(describeChange({ topic: "revive", answered: true })).toBe("When to revive covered")
    expect(describeChange({})).toBeNull()
  })

  it("falls back to a generic chip when the reply only names the tools", () => {
    expect(changeChips({ tools_used: ["get_playbook", "set_rule_param"] }, "$")).toEqual(["Playbook updated"])
    expect(changeChips({ tools_used: ["get_playbook"] }, "$")).toEqual([])
  })

  it("renders rule-updated chips under Birdy's reply and refreshes after write tools", () => {
    MESSAGE = { role: "assistant", content: "Saved.", agent_changes: [{ changed: { topic: "pause", answered: true } }] }
    const onChanged = vi.fn()
    render(<TrainingChat agentId="ag1" onChanged={onChanged} />)
    expect(screen.getByText("When to pause covered")).toBeInTheDocument()
    expect(lastProps.page).toBe("agent_training")
    expect(lastProps.showScopePicker).toBe(false)
    lastProps.onToolUsed("get_playbook")
    expect(onChanged).not.toHaveBeenCalled()
    lastProps.onToolUsed("set_client_target")
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it("send goes through the chat's own send and reports whether it was taken", async () => {
    MESSAGE = { role: "assistant", content: "Hi" }
    const ref = createRef()
    render(<TrainingChat ref={ref} agentId="ag1" />)
    lastProps.sendRef.current = null
    await expect(ref.current.send("x")).resolves.toBe(false)

    const send = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    lastProps.sendRef.current = send
    let sent
    await act(async () => {
      sent = await ref.current.send("Practice case c1: I chose Pause.")
    })
    expect(send).toHaveBeenCalledWith("Practice case c1: I chose Pause.")
    expect(sent).toBe(true)
    await act(async () => {
      sent = await ref.current.send("again")
    })
    expect(sent).toBe(false)
  })
})
