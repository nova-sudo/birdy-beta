import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "../../__tests__/jsdom"
import { ClientSwitcher, CreditsRing, Rail, SECTIONS, SectionHeader, visibleSections } from "../.."

const CLIENTS = [
  { id: "fallon", name: "Fallon Physique", status: "warning" },
  { id: "aura", name: "Aura", status: "danger" },
  { id: "glow", name: "Healthy Glow", status: "success" },
]
const TABS = [
  { value: "chat", label: "Chat" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions", count: 8 },
]
const section = (id) => SECTIONS.find((s) => s.id === id)

describe("sections", () => {
  it("keeps Creative Strategist off the rail", () => {
    expect(visibleSections().map((s) => s.name)).toEqual(["Agency Ops", "Media Buyer", "Sales Coach", "Clients"])
  })
})

describe("Rail", () => {
  it("lists the sections and marks the open one", () => {
    render(<Rail activeId="buyer" />)
    const nav = screen.getByRole("navigation", { name: "Sections" })
    expect(within(nav).getAllByRole("button")).toHaveLength(4)
    expect(screen.getByRole("button", { name: "Media Buyer" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Sales Coach" })).not.toHaveAttribute("aria-current")
    expect(screen.queryByRole("button", { name: /Creative/ })).not.toBeInTheDocument()
  })

  it("flags a section only when it has something waiting", () => {
    render(<Rail activeId="ops" counts={{ buyer: 8, coach: 0 }} />)
    expect(screen.getByRole("button", { name: "Media Buyer, 8 waiting" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sales Coach" })).toBeInTheDocument()
  })

  it("shows the mascot for Agency Ops inside its round frame", () => {
    render(<Rail activeId="ops" />)
    const frame = screen.getByRole("button", { name: "Agency Ops" }).querySelector(".rounded-full.overflow-hidden")
    expect(frame).not.toBeNull()
    expect(frame.querySelector("svg")).not.toBeNull()
  })

  it("reports the section or settings that was chosen", async () => {
    const onSelect = vi.fn()
    render(<Rail activeId="ops" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole("button", { name: "Clients" }))
    await userEvent.click(screen.getByRole("button", { name: "Settings" }))
    expect(onSelect.mock.calls).toEqual([["clients"], ["settings"]])
  })

  it("shows credits and the user when given", () => {
    render(<Rail activeId="ops" credits={{ left: 4359, percent: 44 }} user={{ name: "Hadley" }} />)
    expect(screen.getByRole("img", { name: "4,359 credits left, 44%" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Hadley" })).toBeInTheDocument()
  })
})

describe("CreditsRing", () => {
  it("clamps the share between 0 and 100", () => {
    render(<CreditsRing left={0} percent={140} />)
    expect(screen.getByRole("img", { name: "0 credits left, 140%" }).querySelectorAll("circle")).toHaveLength(2)
  })
})

describe("ClientSwitcher", () => {
  const open = async (props = {}) => {
    const onChange = vi.fn()
    render(<ClientSwitcher clients={CLIENTS} value={null} onChange={onChange} {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /Switch client/ }))
    await screen.findByRole("listbox")
    return onChange
  }

  it("says what it is scoped to", () => {
    const { rerender } = render(<ClientSwitcher clients={CLIENTS} value={null} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Switch client, showing all clients" })).toBeInTheDocument()
    rerender(<ClientSwitcher clients={CLIENTS} value="aura" onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Switch client, showing Aura" })).toHaveTextContent("A")
  })

  it("lists the two actions, then every client A to Z, with the search focused", async () => {
    await open()
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Add new client", "Agency view3 clients", "Aura, at risk", "Fallon Physique, at risk", "Healthy Glow, on track",
    ])
    expect(screen.getByRole("combobox", { name: "Search clients" })).toHaveFocus()
  })

  it("filters as you type and picks the match with Enter", async () => {
    const onChange = await open()
    await userEvent.keyboard("fall")
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Add new client", "Agency view3 clients", "Fallon Physique, at risk"])
    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith("fallon")
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
  })

  it("moves with the arrow keys and returns to the agency view", async () => {
    const onChange = await open({ value: "aura" })
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("wraps from the first row to the last", async () => {
    const onChange = await open()
    await userEvent.keyboard("{ArrowUp}{Enter}")
    expect(onChange).toHaveBeenCalledWith("glow")
  })

  it("offers to add the typed name when nothing matches", async () => {
    const onAddClient = vi.fn()
    await open({ onAddClient })
    await userEvent.keyboard("zzz")
    expect(screen.getByText("No client called “zzz”.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("option", { name: "Add “zzz” as a new client" }))
    expect(onAddClient).toHaveBeenCalledWith("zzz")
  })

  it("shows placeholders while the list loads, with the actions still usable", async () => {
    await open({ status: "loading" })
    expect(screen.getByRole("status", { name: "Loading clients" })).toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(2)
  })

  it("says so when the list fails and retries", async () => {
    const onRetry = vi.fn()
    await open({ status: "error", onRetry })
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load your clients.")
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("opens with ⌘K from a clean search and closes with Escape", async () => {
    render(<ClientSwitcher clients={CLIENTS} value={null} onChange={() => {}} />)
    fireEvent.keyDown(window, { key: "k", metaKey: true })
    const box = await screen.findByRole("combobox", { name: "Search clients" })
    await userEvent.type(box, "aur")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
    fireEvent.keyDown(window, { key: "K", ctrlKey: true })
    expect(await screen.findByRole("combobox", { name: "Search clients" })).toHaveValue("")
    expect(screen.getAllByRole("option")).toHaveLength(5)
  })
})

describe("SectionHeader", () => {
  const base = { tabs: TABS, tab: "dashboard", onTabChange: () => {} }

  it("names the section and falls back to its description", () => {
    render(<SectionHeader section={section("buyer")} {...base} />)
    expect(screen.getByRole("heading", { level: 1, name: "Media Buyer" })).toBeInTheDocument()
    expect(screen.getByText("Your entire agency")).toBeInTheDocument()
    expect(screen.getByRole("tablist", { name: "Media Buyer views" })).toBeInTheDocument()
  })

  it("shows the client when scoped", () => {
    render(<SectionHeader section={section("buyer")} subtitle="Aura · At risk" {...base} />)
    expect(screen.getByText("Aura · At risk")).toBeInTheDocument()
    expect(screen.queryByText("Your entire agency")).not.toBeInTheDocument()
  })

  it("shows the date range and the More menu only when given", () => {
    const { rerender } = render(<SectionHeader section={section("buyer")} {...base} />)
    expect(screen.queryByText("Last 7 days")).not.toBeInTheDocument()
    rerender(<SectionHeader section={section("buyer")} {...base} dateRange={<button>Last 7 days</button>} more={<button>More</button>} />)
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument()
    expect(within(screen.getByRole("tablist")).getByRole("button", { name: "More" })).toBeInTheDocument()
  })

  it("uses an icon tile for Agency Ops, not the mascot", () => {
    const { container } = render(<SectionHeader section={section("ops")} {...base} />)
    expect(container.querySelector(".rounded-full.overflow-hidden")).toBeNull()
    expect(container.querySelector("header svg")).not.toBeNull()
  })

  it("passes tab changes up", async () => {
    const onTabChange = vi.fn()
    render(<SectionHeader section={section("coach")} tabs={TABS} tab="chat" onTabChange={onTabChange} />)
    await userEvent.click(screen.getByRole("tab", { name: /Suggestions/ }))
    expect(onTabChange).toHaveBeenCalledWith("suggestions")
  })
})
