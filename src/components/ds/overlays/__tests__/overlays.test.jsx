import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  Toaster,
  toast,
  confirm,
  ConfirmHost,
} from "@/components/ds"

// jsdom lacks ResizeObserver (Radix tooltip, cmdk) and scrollIntoView (cmdk).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}

// jsdom has no matchMedia breakpoints; fake one that answers `matches`.
function withMatches(matches, fn) {
  const original = window.matchMedia
  window.matchMedia = (query) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  try {
    fn()
  } finally {
    window.matchMedia = original
  }
}

function sheet(side) {
  return (
    <Sheet open>
      <SheetContent side={side}>
        <SheetTitle>T</SheetTitle>
        <SheetDescription>D</SheetDescription>
      </SheetContent>
    </Sheet>
  )
}

describe("Dialog", () => {
  it("content is rounded-overlay with shadow-overlay and the overlay uses bg-scrim", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    const content = screen.getByRole("dialog")
    expect(content.className).toContain("rounded-overlay")
    expect(content.className).toContain("shadow-overlay")
    expect(content.getAttribute("data-ds")).toBe("dialog")
    expect(document.querySelector("[data-slot=dialog-overlay]").className).toContain("bg-scrim")
  })
})

describe("Sheet", () => {
  it("defaults to the right side with the edge easing", () => {
    render(sheet())
    const content = screen.getByRole("dialog")
    expect(content.getAttribute("data-side")).toBe("right")
    expect(content.className).toContain("ease-edge")
    expect(content.getAttribute("data-ds")).toBe("sheet")
  })

  it("supports left and bottom", () => {
    const { rerender } = render(sheet("left"))
    expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("left")
    rerender(sheet("bottom"))
    expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("bottom")
  })

  it("renders a right sheet as a bottom sheet below 768px", () => {
    withMatches(true, () => {
      render(sheet("right"))
      expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("bottom")
    })
  })

  it("keeps a left sheet on the left below 768px", () => {
    withMatches(true, () => {
      render(sheet("left"))
      expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("left")
    })
  })
})

describe("DropdownMenu", () => {
  it("content carries shadow-floating", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const menu = screen.getByRole("menu")
    expect(menu.className).toContain("shadow-floating")
    expect(menu.getAttribute("data-ds")).toBe("dropdown-menu")
  })
})

describe("Popover", () => {
  it("content carries shadow-floating", () => {
    render(
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>hi</PopoverContent>
      </Popover>
    )
    const el = document.querySelector("[data-slot=popover-content]")
    expect(el.className).toContain("shadow-floating")
    expect(el.getAttribute("data-ds")).toBe("popover")
  })
})

describe("Tooltip", () => {
  it("content carries shadow-floating", () => {
    render(
      <Tooltip open>
        <TooltipTrigger>t</TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>
    )
    const el = document.querySelector("[data-slot=tooltip-content]")
    expect(el.className).toContain("shadow-floating")
    expect(el.getAttribute("data-ds")).toBe("tooltip")
  })
})

describe("Command", () => {
  it("renders an input and items", () => {
    const { container } = render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem>Campaigns</CommandItem>
        </CommandList>
      </Command>
    )
    expect(screen.getByPlaceholderText("Search")).toBeTruthy()
    expect(screen.getByText("Campaigns")).toBeTruthy()
    expect(container.firstChild.getAttribute("data-ds")).toBe("command")
  })
})

describe("Toaster", () => {
  it("re-exports toast and tags its root", () => {
    const { container } = render(<Toaster />)
    expect(typeof toast).toBe("function")
    expect(container.querySelector("[data-ds=toaster]")).toBeTruthy()
  })
})

describe("confirm()", () => {
  it("rejects with a clear error when no ConfirmHost is mounted", async () => {
    await expect(confirm({ title: "x" })).rejects.toThrow(/ConfirmHost/)
  })

  it("resolves true on the confirm click", async () => {
    render(<ConfirmHost />)
    let p
    act(() => {
      p = confirm({ title: "Delete?", description: "Gone for good", confirmLabel: "Delete it" })
    })
    expect(await screen.findByText("Delete?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Delete it" }))
    await expect(p).resolves.toBe(true)
  })

  it("resolves false on cancel", async () => {
    render(<ConfirmHost />)
    let p
    act(() => {
      p = confirm({ title: "Sure?" })
    })
    await screen.findByText("Sure?")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await expect(p).resolves.toBe(false)
  })

  it("resolves false on Escape", async () => {
    render(<ConfirmHost />)
    let p
    act(() => {
      p = confirm({ title: "Esc?" })
    })
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.keyDown(dialog, { key: "Escape" })
    await expect(p).resolves.toBe(false)
  })

  it("danger tone (default) uses the destructive button, other tones do not", async () => {
    render(<ConfirmHost />)
    act(() => {
      confirm({ title: "A", confirmLabel: "Go" })
    })
    const btn = await screen.findByRole("button", { name: "Go" })
    expect(btn.className).toContain("bg-destructive")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    act(() => {
      confirm({ title: "B", confirmLabel: "Go", tone: "default" })
    })
    const btn2 = await screen.findByRole("button", { name: "Go" })
    expect(btn2.className).toContain("bg-primary")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  })
})
