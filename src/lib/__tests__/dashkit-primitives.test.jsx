/**
 * The pd primitives dashkit's editor renders through (Button, Input, Select,
 * Menu, Icon). What matters at this seam is the dashkit contract: buttons keep
 * dashkit's own classes beside Birdy's (dashkit's layout rules for controls
 * and palette tiles key off them), Select renders the options it is handed,
 * Menu items fire onSelect, and Icon maps exactly the names dashkit asks for.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PdButton, PdIcon, PdInput, PdMenu, PdSelect } from "@/lib/dashkit/primitives"

describe("PdButton", () => {
  it("keeps dashkit's button class and maps each variant to pd styles", () => {
    const { rerender } = render(<PdButton>Save</PdButton>)
    let button = screen.getByRole("button", { name: "Save" })
    expect(button).toHaveAttribute("type", "button")
    expect(button).toHaveClass("dk-button", "rounded-full", "h-8", "border-pd-border", "bg-pd-surface")

    rerender(<PdButton variant="primary">Save</PdButton>)
    button = screen.getByRole("button", { name: "Save" })
    expect(button).toHaveClass("dk-button", "dk-button-primary", "bg-pd-primary", "text-white")
    expect(button).not.toHaveClass("bg-pd-surface")

    rerender(<PdButton variant="ghost">Undo</PdButton>)
    button = screen.getByRole("button", { name: "Undo" })
    expect(button).toHaveClass("dk-button", "dk-button-ghost", "text-pd-body", "hover:bg-pd-divider")
    expect(button).not.toHaveClass("border-pd-border")
  })

  it("merges the caller's className and passes props through", async () => {
    const onClick = vi.fn()
    render(
      <PdButton className="dk-palette-item" aria-label="Add Text" data-type="text" onClick={onClick}>
        Text
      </PdButton>,
    )
    const button = screen.getByRole("button", { name: "Add Text" })
    expect(button).toHaveClass("dk-button", "dk-palette-item")
    expect(button).toHaveAttribute("data-type", "text")
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe("PdInput", () => {
  it("keeps dashkit's input class with the pd pill look", () => {
    render(<PdInput aria-label="Title" defaultValue="Spend" />)
    const input = screen.getByRole("textbox", { name: "Title" })
    expect(input).toHaveClass("dk-input", "rounded-full", "h-9")
    expect(input).toHaveValue("Spend")
  })
})

describe("PdSelect", () => {
  it("renders the given options as a native select", async () => {
    const onChange = vi.fn()
    render(
      <PdSelect
        aria-label="Type"
        value="kpi"
        onChange={onChange}
        options={[
          { value: "kpi", label: "KPI" },
          { value: "bar", label: "Bar chart" },
        ]}
      />,
    )
    const select = screen.getByRole("combobox", { name: "Type" })
    expect(select.tagName).toBe("SELECT")
    expect(select).toHaveClass("dk-select")
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["KPI", "Bar chart"])
    await userEvent.selectOptions(select, "bar")
    expect(onChange).toHaveBeenCalled()
  })
})

describe("PdMenu", () => {
  it("opens a dropdown whose items call onSelect, and disabled ones do not", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <PdMenu
        label="More"
        items={[
          { label: "Rename", onSelect: onRename },
          { label: "Delete", onSelect: onDelete, disabled: true },
        ]}
      />,
    )
    await user.click(screen.getByRole("button", { name: "More" }))
    expect(await screen.findByRole("menuitem", { name: "Delete" })).toHaveAttribute("data-disabled")
    await user.click(screen.getByRole("menuitem", { name: "Rename" }))
    expect(onRename).toHaveBeenCalledOnce()
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe("PdIcon", () => {
  const NAMES = [
    "gauge",
    "rows-3",
    "text",
    "sparkles",
    "trending-up",
    "bar-chart-3",
    "pie-chart",
    "columns-2",
    "filter",
    "list-ordered",
    "table",
    "grip-vertical",
    "minus",
    "plus",
    "move-diagonal",
    "plus-circle",
    "layout-dashboard",
    "undo-2",
    "redo-2",
  ]

  it("maps every name dashkit uses to an svg, size-4 by default", () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<PdIcon name={name} />)
      const svg = container.querySelector("svg")
      expect(svg, name).not.toBeNull()
      expect(svg.getAttribute("class")).toContain("size-4")
      expect(svg).toHaveAttribute("aria-hidden", "true")
      unmount()
    }
  })

  it("takes its size from className and renders nothing for an unknown name", () => {
    const { container, rerender } = render(<PdIcon name="plus" className="size-3" />)
    expect(container.querySelector("svg").getAttribute("class")).toContain("size-3")
    expect(container.querySelector("svg").getAttribute("class")).not.toContain("size-4")

    rerender(<PdIcon name="no-such-icon" />)
    expect(container.firstChild).toBeNull()
  })
})
