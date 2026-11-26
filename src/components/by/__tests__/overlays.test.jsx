import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import "./jsdom"
import { Button, ColumnsMenu, Dialog, DialogBody, DialogContent, DialogFooter, Notice, OptionCard, Skeleton, Stepper, Table, TableHead, TableScroll, Th } from ".."

function Harness({ onOpenChange = () => {} }) {
  const [open, setOpen] = useState(false)
  const change = (o) => { setOpen(o); onOpenChange(o) }
  return (
    <>
      <Button onClick={() => change(true)}>Open</Button>
      <Dialog open={open} onOpenChange={change}>
        <DialogContent title="Add client" description="Link a client’s accounts.">
          <DialogBody><input aria-label="Client name" /></DialogBody>
          <DialogFooter><Button onClick={() => change(false)}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe("Dialog", () => {
  it("is named by its title and described by its description", async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    const dialog = await screen.findByRole("dialog", { name: "Add client" })
    expect(dialog).toHaveAccessibleDescription("Link a client’s accounts.")
  })

  it("keeps Tab inside the dialog", async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    const dialog = await screen.findByRole("dialog")
    for (let i = 0; i < 6; i++) {
      await userEvent.tab()
      expect(dialog).toContainElement(document.activeElement)
    }
  })

  it("closes on Escape and from its close button", async () => {
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    await screen.findByRole("dialog")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    await userEvent.click(await screen.findByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
})

describe("Stepper", () => {
  it("marks the current step and says which are done", () => {
    render(<Stepper steps={["Name", "GoHighLevel", "Meta"]} current={1} />)
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[1]).toHaveAttribute("aria-current", "step")
    expect(items[0]).not.toHaveAttribute("aria-current")
    expect(items[0]).toHaveTextContent("Name (done)")
    expect(items[2]).toHaveTextContent("3Meta")
  })
})

describe("OptionCard", () => {
  it("is a radio by default, or a checkbox, and reports being picked", async () => {
    const onSelect = vi.fn()
    render(<><OptionCard selected={false} onSelect={onSelect} title="Hot Prospector" subtitle="Calls sync." /><OptionCard role="checkbox" selected onSelect={() => {}} title="All campaigns" /></>)
    const radio = screen.getByRole("radio", { name: /Hot Prospector/ })
    expect(radio).toHaveAttribute("aria-checked", "false")
    await userEvent.click(radio)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.getByRole("checkbox", { name: "All campaigns" })).toBeChecked()
  })

  it("cannot be picked when disabled", async () => {
    const onSelect = vi.fn()
    render(<OptionCard selected={false} onSelect={onSelect} disabled title="Taken" />)
    await userEvent.click(screen.getByRole("radio", { name: "Taken" }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe("Notice and Skeleton", () => {
  it("announces a problem as an alert and a hint as a status", () => {
    render(<><Notice tone="danger" action={<Button>Retry</Button>}>Couldn’t load.</Notice><Notice>A hint.</Notice></>)
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load.")
    expect(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("A hint.")
  })

  it("hides placeholders from screen readers", () => {
    const { container } = render(<Skeleton className="w-10" />)
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
  })
})

describe("sortable header", () => {
  const header = (props) => render(<Table><TableHead><tr><Th {...props}>Spend</Th></tr></TableHead></Table>)

  it("is plain text with no sort button unless it can sort", () => {
    header({})
    expect(screen.getByRole("columnheader", { name: "Spend" })).not.toHaveAttribute("aria-sort")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("reports its direction and asks to sort when pressed", async () => {
    const onSort = vi.fn()
    const { rerender } = header({ onSort, sort: null })
    expect(screen.getByRole("columnheader", { name: "Spend" })).toHaveAttribute("aria-sort", "none")
    await userEvent.click(screen.getByRole("button", { name: "Spend" }))
    expect(onSort).toHaveBeenCalledOnce()
    rerender(<Table><TableHead><tr><Th onSort={onSort} sort="desc">Spend</Th></tr></TableHead></Table>)
    expect(screen.getByRole("columnheader", { name: "Spend" })).toHaveAttribute("aria-sort", "descending")
  })
})

describe("tables scroll inside themselves", () => {
  it("keeps the header row in place and scrolls only the table's own container", () => {
    render(<TableScroll data-testid="scroll"><Table><TableHead><tr><Th>Client</Th></tr></TableHead></Table></TableScroll>)
    expect(screen.getByTestId("scroll")).toHaveClass("min-h-0", "overflow-auto")
    expect(screen.getByRole("columnheader", { name: "Client" })).toHaveClass("sticky", "top-0", "bg-by-canvas")
  })
})

describe("ColumnsMenu", () => {
  const COLUMNS = [{ id: "spend", label: "Spend", group: "Last 7 days" }, { id: "leads", label: "Leads", group: "Last 7 days" }, { id: "ctr", label: "CTR", group: "Ads" }, { id: "won", label: "Won Opps", group: "GoHighLevel" }]
  const VIEWS = [{ name: "Default", ids: ["spend", "leads"] }, { name: "Ads", ids: ["spend", "leads", "ctr"] }]
  const openMenu = async (props) => {
    render(<ColumnsMenu columns={COLUMNS} value={["spend", "leads"]} onChange={() => {}} {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /^Views/ }))
    return screen.findByRole("dialog", { name: "Views and columns" })
  }

  it("groups the columns under their headings and ticks what is shown", async () => {
    await openMenu()
    expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Last 7 days", "Ads", "GoHighLevel"])
    expect(screen.getByRole("checkbox", { name: "Spend" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "CTR" })).not.toBeChecked()
  })

  it("keeps the table's order when a column is added, and removes without reordering", async () => {
    const onChange = vi.fn()
    await openMenu({ value: ["spend", "won"], onChange })
    await userEvent.click(screen.getByRole("checkbox", { name: "CTR" }))
    expect(onChange).toHaveBeenLastCalledWith(["spend", "ctr", "won"])
    await userEvent.click(screen.getByRole("checkbox", { name: "Spend" }))
    expect(onChange).toHaveBeenLastCalledWith(["won"])
  })

  it("lists the views first, marks the one on screen and applies another in one click", async () => {
    const onChange = vi.fn()
    await openMenu({ views: VIEWS, onChange })
    expect(screen.getAllByRole("group")[0]).toHaveAccessibleName("Views")
    expect(screen.getByRole("button", { name: "Default" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Ads" })).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(screen.getByRole("button", { name: "Ads" }))
    expect(onChange).toHaveBeenLastCalledWith(["spend", "leads", "ctr"])
  })

  it("names the view on the button unless it is the default, and says Custom for anything else", () => {
    const { rerender } = render(<ColumnsMenu columns={COLUMNS} value={["spend", "leads"]} onChange={() => {}} views={VIEWS} />)
    expect(screen.getByRole("button", { name: "Views" })).toBeInTheDocument()
    rerender(<ColumnsMenu columns={COLUMNS} value={["spend", "leads", "ctr"]} onChange={() => {}} views={VIEWS} />)
    expect(screen.getByRole("button", { name: /^Views\s*·\s*Ads$/ })).toBeInTheDocument()
    rerender(<ColumnsMenu columns={COLUMNS} value={["won"]} onChange={() => {}} views={VIEWS} />)
    expect(screen.getByRole("button", { name: /^Views\s*·\s*Custom$/ })).toBeInTheDocument()
  })

  it("offers to save the current view only when saving is possible, and reports opening", async () => {
    const onSaveView = vi.fn()
    const onOpenChange = vi.fn()
    await openMenu({ views: VIEWS, onSaveView, onOpenChange })
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole("button", { name: "Save as new view" }))
    expect(onSaveView).toHaveBeenCalledOnce()
  })

  it("offers to update the current view when the page can, and heads the columns as the view's contents", async () => {
    const onUpdateView = vi.fn()
    await openMenu({ views: VIEWS, onUpdateView })
    expect(screen.getByText("Columns in this view")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Update view" }))
    expect(onUpdateView).toHaveBeenCalledOnce()
  })
})
