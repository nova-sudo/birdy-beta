import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { AskBar, Button, Checkbox, DropdownTrigger, Radio, RadioGroup, SearchField, Switch, TextField } from ".."

describe("Button", () => {
  it("is a plain button by default so it never submits a form by accident", () => {
    render(<Button>Dismiss</Button>)
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute("type", "button")
  })

  it.each([
    ["primary", "shadow-by-primary"],
    ["secondary", "bg-by-surface"],
    ["soft", "bg-by-accent-soft"],
    ["ghost", "text-by-text-2"],
    ["danger", "bg-by-danger-bg"],
  ])("draws the %s kind", (kind, cls) => {
    render(<Button kind={kind}>Go</Button>)
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass(cls)
  })

  it("does not fire when disabled", async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Off</Button>)
    await userEvent.click(screen.getByRole("button", { name: "Off" }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("while loading: says it is busy, keeps its label and blocks clicks", async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Working</Button>)
    const button = screen.getByRole("button", { name: "Working" })
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("shows a keyboard focus outline", () => {
    render(<Button>Focus</Button>)
    expect(screen.getByRole("button", { name: "Focus" }).className).toMatch(/focus-visible:outline-2/)
    expect(screen.getByRole("button", { name: "Focus" }).className).not.toMatch(/(^|\s)outline-none/)
  })
})

describe("TextField", () => {
  it("ties the label to the input", () => {
    render(<TextField label="Client name" defaultValue="Aura" />)
    expect(screen.getByLabelText("Client name")).toHaveValue("Aura")
  })

  it("marks an error and reads the message with the field", () => {
    render(<TextField label="Slack channel" error="Channel names can’t contain spaces." help="hidden while there is an error" />)
    const input = screen.getByLabelText("Slack channel")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Channel names can’t contain spaces.")
    expect(screen.queryByText("hidden while there is an error")).not.toBeInTheDocument()
  })

  it("shows help text when there is no error", () => {
    render(<TextField label="CPL limit" help="Birdy flags ads above this." />)
    expect(screen.getByLabelText("CPL limit")).toHaveAccessibleDescription("Birdy flags ads above this.")
    expect(screen.getByLabelText("CPL limit")).not.toHaveAttribute("aria-invalid")
  })
})

describe("SearchField and DropdownTrigger", () => {
  it("names the search box from its placeholder", () => {
    render(<SearchField placeholder="Search clients" />)
    expect(screen.getByRole("searchbox", { name: "Search clients" })).toBeInTheDocument()
  })

  it("draws the dropdown trigger as a button", async () => {
    const onClick = vi.fn()
    render(<DropdownTrigger onClick={onClick}>Last 7 days</DropdownTrigger>)
    await userEvent.click(screen.getByRole("button", { name: "Last 7 days" }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe("AskBar", () => {
  it("cannot send until something is typed", () => {
    render(<AskBar placeholder="Ask Media Buyer" />)
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("sends the trimmed text on Enter and clears", async () => {
    const onSubmit = vi.fn()
    render(<AskBar placeholder="Ask Media Buyer" onSubmit={onSubmit} />)
    const input = screen.getByRole("textbox", { name: "Ask Media Buyer" })
    await userEvent.type(input, "  Why is Aura flagged?  {Enter}")
    expect(onSubmit).toHaveBeenCalledWith("Why is Aura flagged?")
    expect(input).toHaveValue("")
  })

  it("ignores Enter on only spaces", async () => {
    const onSubmit = vi.fn()
    render(<AskBar placeholder="Ask Media Buyer" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByRole("textbox", { name: "Ask Media Buyer" }), "   {Enter}")
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("Switch, Checkbox and Radio", () => {
  it("toggles the switch from its label and from Space", async () => {
    const onCheckedChange = vi.fn()
    render(<Switch label="Auto-run" onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole("switch", { name: "Auto-run" })
    await userEvent.click(screen.getByText("Auto-run"))
    expect(control).toBeChecked()
    control.focus()
    await userEvent.keyboard(" ")
    expect(control).not.toBeChecked()
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
  })

  it("toggles the checkbox with Space", async () => {
    render(<Checkbox label="Spend" defaultChecked />)
    const box = screen.getByRole("checkbox", { name: "Spend" })
    box.focus()
    await userEvent.keyboard(" ")
    expect(box).not.toBeChecked()
  })

  it("leaves a disabled control alone", async () => {
    render(<Checkbox label="CPL" defaultChecked disabled />)
    await userEvent.click(screen.getByText("CPL"))
    expect(screen.getByRole("checkbox", { name: "CPL" })).toBeChecked()
  })

  it("moves between radio buttons with the arrow keys", async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup defaultValue="one" aria-label="How to add clients">
        <Radio value="one" label="One client" />
        <Radio value="bulk" label="Bulk import" />
      </RadioGroup>,
    )
    screen.getByRole("radio", { name: "One client" }).focus()
    // Radix moves focus on the next tick and selects only while the key is
    // still down, so hold it rather than tapping it.
    await user.keyboard("{ArrowRight>}")
    await waitFor(() => expect(screen.getByRole("radio", { name: "Bulk import" })).toBeChecked())
    await user.keyboard("{/ArrowRight}")
    expect(screen.getByRole("radio", { name: "One client" })).not.toBeChecked()
  })
})
