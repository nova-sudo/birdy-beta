import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { PasswordField, TeamTree } from ".."

vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

const BRANCHES = [
  { agent: "media_buyer", line: "Spend, creatives", subs: ["Budget watcher"] },
  { agent: "sales_coach", line: "Calls, deals", subs: ["Weekly call check", "Deal review"] },
]

describe("TeamTree", () => {
  it("is one described picture with the question, Birdy, and each agent with its sub-agents", () => {
    const { container } = render(<TeamTree question="Why did calls drop?" lead="Hands work out" branches={BRANCHES} label="Birdy's team" />)
    expect(screen.getByRole("img", { name: "Birdy's team" })).toBeInTheDocument()
    for (const text of ["Why did calls drop?", "Birdy", "Hands work out", "Media Buyer", "Sales Coach", "Budget watcher", "Weekly call check", "Deal review"]) {
      expect(container).toHaveTextContent(text)
    }
    expect(container).toHaveTextContent("Sub-agents")
    expect(container.firstChild.querySelectorAll(":scope > ul > li")).toHaveLength(2)
  })

  it("draws the fork from the gap: each outer half reaches the centre of the gap and drops at its card's centre", () => {
    const { container } = render(<TeamTree lead="x" branches={BRANCHES} label="t" />)
    const [left, right] = [...container.firstChild.querySelectorAll(":scope > ul > li > span[aria-hidden='true']")]
    expect(left.style.left).toBe("calc(50% - 1px)")
    expect(left.style.right).toBe("calc(-0.5rem)")
    expect(right.style.left).toBe("calc(-0.5rem)")
    expect(right.style.right).toBe("calc(50% - 1px)")
  })

  it("draws a three-way fork with a straight middle drop", () => {
    const three = [...BRANCHES, { agent: "media_buyer_2", line: "x" }]
    const { container } = render(<TeamTree lead="x" branches={three} label="t" />)
    const branches = container.firstChild.querySelectorAll(":scope > ul > li")
    expect(branches).toHaveLength(3)
    // The middle one has no curved corner: a bar across and a straight drop.
    const middle = branches[1].firstElementChild
    expect(middle.children).toHaveLength(2)
    expect(middle.style.borderTopLeftRadius).toBe("")
  })
})

describe("PasswordField", () => {
  it("toggles between hidden and shown", async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Password" />)
    const field = screen.getByLabelText("Password")
    expect(field).toHaveAttribute("type", "password")
    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(field).toHaveAttribute("type", "text")
    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(field).toHaveAttribute("type", "password")
  })
})
