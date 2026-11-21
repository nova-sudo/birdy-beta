import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import {
  BirdyAvatar, Button, Card, ClientTile, CountBadge, CplChip, Delta, EmptyState, KpiTile, Menu, MenuContent, MenuItem, MenuTrigger,
  Pill, RowArrow, TabPanel, TabPill, Table, TableBody, TableHead, Td, Th, Tooltip, Tr, UserAvatar,
  Funnel, LineChart, Notice, RankList,
} from ".."
import { niceMax } from "../line-chart"

const TABS = [
  { value: "chat", label: "Chat" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions", count: 8 },
  { value: "reports", label: "Reports", count: 0 },
]

describe("TabPill", () => {
  it("marks the open tab and shows its panel", () => {
    render(
      <TabPill items={TABS} value="dashboard" onValueChange={() => {}} aria-label="Views">
        <TabPanel value="dashboard">The dashboard</TabPanel>
      </TabPill>,
    )
    expect(screen.getByRole("tablist", { name: "Views" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("The dashboard")
  })

  it("shows a count only when it is above zero", () => {
    render(<TabPill items={TABS} value="chat" onValueChange={() => {}} aria-label="Views" />)
    expect(screen.getByRole("tab", { name: /Suggestions/ })).toHaveTextContent("8")
    expect(screen.getByRole("tab", { name: "Reports" })).toHaveTextContent(/^Reports$/)
  })

  it("changes tab on click and with the arrow keys", async () => {
    const onValueChange = vi.fn()
    render(<TabPill items={TABS} value="chat" onValueChange={onValueChange} aria-label="Views" />)
    await userEvent.click(screen.getByRole("tab", { name: "Dashboard" }))
    expect(onValueChange).toHaveBeenLastCalledWith("dashboard")
    screen.getByRole("tab", { name: "Chat" }).focus()
    onValueChange.mockClear()
    await userEvent.keyboard("{ArrowRight}")
    await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith("dashboard"))
  })

  it("renders a trailing entry inside the pill", () => {
    render(<TabPill items={TABS} value="chat" onValueChange={() => {}} aria-label="Views" trailing={<button>More</button>} />)
    expect(within(screen.getByRole("tablist")).getByRole("button", { name: "More" })).toBeInTheDocument()
  })

  it("says why a tab is disabled and shows a badge after a label", () => {
    const items = [
      { value: "ops", label: "Agency Ops" },
      { value: "buyer", label: "Media Buyer", badge: <span>New</span> },
      { value: "coach", label: "Sales Coach", disabled: true, hint: "Unlocks after Media Buyer" },
      { value: "later", label: "Later", disabled: true },
    ]
    render(<TabPill items={items} value="ops" onValueChange={() => {}} aria-label="Setup" />)
    expect(screen.getByRole("tab", { name: /Media Buyer/ })).toHaveTextContent("Media BuyerNew")
    expect(screen.getByRole("tab", { name: "Sales Coach" })).toHaveAttribute("title", "Unlocks after Media Buyer")
    expect(screen.getByRole("tab", { name: "Later" })).toHaveAttribute("title", "Coming soon")
  })
})

describe("Menu and Tooltip", () => {
  it("opens, picks with the keyboard and closes", async () => {
    const onSelect = vi.fn()
    render(
      <Menu>
        <MenuTrigger asChild><Button>All clients</Button></MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect}>Beauty Hub MCR</MenuItem>
          <MenuItem>Healthy Glow</MenuItem>
        </MenuContent>
      </Menu>,
    )
    await userEvent.click(screen.getByRole("button", { name: "All clients" }))
    expect(await screen.findAllByRole("menuitem")).toHaveLength(2)
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(onSelect).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("closes the menu on Escape without picking", async () => {
    const onSelect = vi.fn()
    render(
      <Menu>
        <MenuTrigger asChild><Button>Open</Button></MenuTrigger>
        <MenuContent><MenuItem onSelect={onSelect}>One</MenuItem></MenuContent>
      </Menu>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    await screen.findByRole("menu")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("shows the tooltip on keyboard focus", async () => {
    render(<Tooltip label="4,359 credits left"><Button>Credits</Button></Tooltip>)
    await userEvent.tab()
    expect(await screen.findByRole("tooltip")).toHaveTextContent("4,359 credits left")
  })
})

describe("Pill, CplChip and CountBadge", () => {
  it.each([
    ["danger", "text-by-danger"],
    ["warning", "text-by-warning"],
    ["success", "text-by-success"],
    ["accent", "text-by-accent"],
    ["neutral", "text-by-text-2"],
  ])("colours the %s tone", (tone, cls) => {
    render(<Pill tone={tone}>Status</Pill>)
    expect(screen.getByText("Status")).toHaveClass(cls)
  })

  it("has a dot, which the CPL chip leaves out", () => {
    const { container } = render(<><Pill tone="danger">At risk</Pill><CplChip tone="danger">£12.46</CplChip></>)
    expect(screen.getByText("At risk").querySelector("[aria-hidden]")).not.toBeNull()
    expect(screen.getByText("£12.46").querySelector("[aria-hidden]")).toBeNull()
    expect(container).toHaveTextContent("£12.46")
  })

  it("falls back to neutral for an unknown tone", () => {
    render(<Pill tone="nope">Odd</Pill>)
    expect(screen.getByText("Odd")).toHaveClass("bg-by-sunken")
  })

  it("renders the count", () => {
    render(<CountBadge>8</CountBadge>)
    expect(screen.getByText("8")).toHaveClass("bg-by-accent")
  })
})

describe("Delta and KpiTile", () => {
  it("colours by good or bad, not by direction", () => {
    const { rerender } = render(<Delta value={-2.1} goodWhen="down" data-testid="d" />)
    expect(screen.getByTestId("d")).toHaveClass("text-by-success")
    rerender(<Delta value={-2.1} goodWhen="up" data-testid="d" />)
    expect(screen.getByTestId("d")).toHaveClass("text-by-danger")
    rerender(<Delta value={4} goodWhen="up" data-testid="d" />)
    expect(screen.getByTestId("d")).toHaveClass("text-by-success")
    rerender(<Delta value={-3} data-testid="d" />)
    expect(screen.getByTestId("d")).toHaveClass("text-by-muted")
  })

  it("says the direction in words and shows one decimal", () => {
    render(<Delta value={-53.24} goodWhen="up" data-testid="d" />)
    expect(screen.getByTestId("d")).toHaveTextContent("Down53.2%")
  })

  it("reads zero as no change, with no arrow", () => {
    render(<Delta value={0} goodWhen="up" data-testid="d" />)
    expect(screen.getByTestId("d")).toHaveTextContent("No change0.0%")
    expect(screen.getByTestId("d").querySelector("svg")).toBeNull()
  })

  it("gives screen readers the final figure whatever the count-up shows", () => {
    render(<KpiTile label="Spend" value={2888} format={(n) => `£${Math.round(n).toLocaleString("en-GB")}`} />)
    expect(screen.getByLabelText("£2,888")).toBeInTheDocument()
  })

  it("shows the figure at once when count-up is off", () => {
    render(<KpiTile label="Leads" value={962} countUp={false} delta={<Delta value={-0.9} goodWhen="up" />} />)
    expect(screen.getByLabelText("962")).toHaveTextContent("962")
    expect(screen.getByText("Leads")).toBeInTheDocument()
  })

  it("does not count up when the system asks for reduced motion", () => {
    const original = window.matchMedia
    window.matchMedia = (query) => ({ ...original(query), matches: true })
    try {
      render(<KpiTile label="Closed" value={29} />)
      expect(screen.getByLabelText("29")).toHaveTextContent("29")
    } finally {
      window.matchMedia = original
    }
  })
})

describe("Table, Card and EmptyState", () => {
  it("lays out headers, numeric cells and a clickable row", async () => {
    const onClick = vi.fn()
    render(
      <Card>
        <Table>
          <TableHead><tr><Th>Client</Th><Th numeric>CPL</Th><Th><span className="sr-only">Open</span></Th></tr></TableHead>
          <TableBody>
            <Tr interactive onClick={onClick}><Td>Aura</Td><Td numeric>£12.46</Td><RowArrow /></Tr>
          </TableBody>
        </Table>
      </Card>,
    )
    expect(screen.getByRole("columnheader", { name: "Client" })).toHaveAttribute("scope", "col")
    expect(screen.getByRole("columnheader", { name: "CPL" })).toHaveClass("text-right")
    expect(screen.getByRole("cell", { name: "£12.46" })).toHaveClass("tabular-nums")
    await userEvent.click(screen.getByRole("row", { name: /Aura/ }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("gives the empty state a heading, an explanation and one action", () => {
    render(
      <EmptyState title="No suggestions for Aura" action={<Button>Ask Media Buyer</Button>}>
        Media Buyer checks every client each morning.
      </EmptyState>,
    )
    expect(screen.getByRole("heading", { name: "No suggestions for Aura" })).toBeInTheDocument()
    expect(screen.getByText("Media Buyer checks every client each morning.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ask Media Buyer" })).toBeInTheDocument()
  })
})

describe("Avatars", () => {
  it("always frames the mascot, in the kit's colours, hidden from screen readers", () => {
    const { container } = render(<BirdyAvatar size={56} />)
    const frame = container.firstChild
    expect(frame).toHaveAttribute("aria-hidden", "true")
    expect(frame).toHaveClass("rounded-full", "overflow-hidden", "bg-by-accent-soft", "border-by-accent-line")
    expect(frame).toHaveStyle({ width: "56px", height: "56px" })
    expect(frame.querySelector("svg")).not.toBeNull()
  })

  it("shows a client as its initial and a user by name", () => {
    render(<><ClientTile name="  beauty Hub MCR" /><UserAvatar name="Hadley" /></>)
    expect(screen.getByText("B")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Hadley" })).toHaveTextContent("H")
  })
})

describe("LineChart", () => {
  it("names itself and lists every point for screen readers", () => {
    render(<LineChart aria-label="Leads per day" values={[3, 5]} labels={["1 Nov", ""]} pointLabels={["1 Nov 2026", "2 Nov 2026"]} />)
    expect(screen.getByRole("img", { name: "Leads per day" })).toBeInTheDocument()
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1 Nov 2026: 3", "2 Nov 2026: 5"])
  })

  it("draws the period before as a second, dashed line and reads both out", () => {
    const { container } = render(<LineChart aria-label="Leads" values={[3, 5]} previous={[4, 9]} labels={["1 Nov", "2 Nov"]} />)
    expect(container.querySelector("path[stroke-dasharray]")).not.toBeNull()
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("2 Nov: 5, 9 the period before")
  })

  it("leaves the dashed line out when the earlier period does not line up point for point", () => {
    const { container } = render(<LineChart aria-label="Leads" values={[3, 5]} previous={[4]} labels={["1 Nov", "2 Nov"]} />)
    expect(container.querySelector("path[stroke-dasharray]")).toBeNull()
  })

  it("picks an axis top that divides into four round steps, whole ones for counts", () => {
    expect(niceMax(158)).toBe(200)
    expect(niceMax(410)).toBe(600)
    expect(niceMax(0.8)).toBeCloseTo(0.8)
    expect(niceMax(3, true)).toBe(4)
    expect(niceMax(1, true)).toBe(4)
    expect(niceMax(0, true)).toBe(4)
    expect(niceMax(0)).toBe(1)
  })
})

describe("Funnel and RankList", () => {
  it("lists the funnel's steps in order with their counts", () => {
    render(<Funnel stages={[{ key: "a", label: "Meta leads", icon: null, value: "962" }, { key: "b", label: "Called", icon: null, value: "—", muted: true, note: "No call centre" }]} />)
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Meta leads962", "Called—No call centre"])
  })

  it("links a ranked name when it has somewhere to go, and marks a row over its limit", () => {
    render(<RankList items={[{ id: "1", name: "Aura", value: "£2.00", bar: 40, href: "/dashboard?client=a" }, { id: "2", name: "Timelapse", value: "£12.00", bar: 100, tone: "danger" }]} />)
    expect(screen.getByRole("link", { name: "Aura" })).toHaveAttribute("href", "/dashboard?client=a")
    expect(screen.queryByRole("link", { name: "Timelapse" })).not.toBeInTheDocument()
    expect(screen.getByText("£12.00")).toHaveClass("text-by-danger")
  })
})

describe("additions for Bird's Eye", () => {
  it("shows a dash for a figure that does not exist, and a note under a tile", () => {
    render(<KpiTile label="Leads called" value={null} note="No client has a call centre" />)
    expect(screen.getByLabelText("No data")).toHaveTextContent("—")
    expect(screen.getByText("No client has a call centre")).toBeInTheDocument()
  })

  it("greys a tab that is not built yet", () => {
    render(<TabPill aria-label="Views" value="a" onValueChange={() => {}} items={[{ value: "a", label: "Bird's Eye" }, { value: "b", label: "Dashboard", disabled: true }]} />)
    expect(screen.getByRole("tab", { name: "Dashboard" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("title", "Coming soon")
  })

  it("has a success notice", () => {
    render(<Notice tone="success">All looking good</Notice>)
    expect(screen.getByRole("status")).toHaveClass("bg-by-success-bg")
  })
})
