import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import "./jsdom"
import { Button, ColumnsMenu, Dialog, DialogBody, DialogContent, DialogFooter, Notice, OptionCard, Skeleton, Stepper, Table, TableHead, Th } from ".."

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

describe("ColumnsMenu", () => {
  const COLUMNS = [{ id: "spend", label: "Spend", group: "Meta" }, { id: "ctr", label: "CTR", group: "Meta" }, { id: "won", label: "Won Opps", group: "GHL" }]

  it("ticks what is shown, adds to the end and removes without reordering", async () => {
    const onChange = vi.fn()
    render(<ColumnsMenu columns={COLUMNS} value={["spend", "won"]} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: "Columns" }))
    expect(await screen.findByRole("checkbox", { name: "Spend" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "CTR" })).not.toBeChecked()
    await userEvent.click(screen.getByRole("checkbox", { name: "CTR" }))
    expect(onChange).toHaveBeenLastCalledWith(["spend", "won", "ctr"])
    await userEvent.click(screen.getByRole("checkbox", { name: "Spend" }))
    expect(onChange).toHaveBeenLastCalledWith(["won"])
  })

  it("filters by search and says when nothing matches", async () => {
    render(<ColumnsMenu columns={COLUMNS} value={[]} onChange={() => {}} footer={<Button>Save as my view</Button>} />)
    await userEvent.click(screen.getByRole("button", { name: "Columns" }))
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search columns" }), "opp")
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Save as my view" })).toBeInTheDocument()
    await userEvent.type(screen.getByRole("searchbox", { name: "Search columns" }), "zzz")
    expect(screen.getByText("No column matches “oppzzz”.")).toBeInTheDocument()
  })
})
