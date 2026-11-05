import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  it("is a glass bezel round a grey frame, over the scrim", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    const content = screen.getByRole("dialog")
    expect(content.getAttribute("data-ds")).toBe("dialog")
    expect(content.getAttribute("data-slot")).toBe("dialog-content")
    expect(content.className).toContain("rounded-bezel")
    expect(content.className).toContain("bg-bezel")
    expect(content.className).toContain("shadow-bezel")
    const frame = content.querySelector("[data-slot=dialog-frame]")
    expect(frame.className).toContain("rounded-overlay")
    expect(frame.className).toContain("bg-frame")
    expect(frame.className).toContain("shadow-overlay-frame")
    expect(frame.className).toContain("w-[520px]")
    expect(document.querySelector("[data-slot=dialog-overlay]").className).toContain("bg-scrim")
  })

  it("sizes the frame and hides the close on request", () => {
    render(
      <Dialog open>
        <DialogContent size="sm" showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    expect(document.querySelector("[data-slot=dialog-frame]").className).toContain("w-[400px]")
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull()
  })

  it("lays out header strip, flush white body and footer strip", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a client</DialogTitle>
            <DialogDescription>Connect later.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <input aria-label="name" />
          </DialogBody>
          <DialogFooter>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
    const header = document.querySelector("[data-slot=dialog-header]")
    expect(header.className).toContain("pr-14")
    expect(screen.getByText("Add a client").className).toContain("text-lg")
    const body = document.querySelector("[data-slot=dialog-body]")
    expect(body.className).toContain("rounded-frame")
    expect(body.className).toContain("bg-background")
    expect(body.className).toContain("p-5")
    expect(body.className).toContain("shadow-surface")
    expect(document.querySelector("[data-slot=dialog-footer]").className).toContain("min-h-16")
    expect(document.querySelectorAll("[data-slot=dialog-body]").length).toBe(1)
    const close = screen.getByRole("button", { name: "Close" })
    expect(close.getAttribute("data-slot")).toBe("dialog-close-button")
    expect(close.className).toContain("size-10")
  })

  it("gathers loose children between the strips into one body, fragments included", () => {
    const showFooter = true
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>T</DialogTitle>
            <DialogDescription>D</DialogDescription>
          </DialogHeader>
          <p>first</p>
          <>
            <p>second</p>
            {showFooter && (
              <DialogFooter>
                <button>Go</button>
              </DialogFooter>
            )}
          </>
        </DialogContent>
      </Dialog>
    )
    const bodies = document.querySelectorAll("[data-slot=dialog-body]")
    expect(bodies.length).toBe(1)
    expect(bodies[0].textContent).toBe("firstsecond")
    const footer = document.querySelector("[data-slot=dialog-footer]")
    expect(footer.parentElement.getAttribute("data-slot")).toBe("dialog-frame")
  })

  it("leaves children alone without strips, or when a body or own slot is given", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogDescription>D</DialogDescription>
          <form data-testid="f" />
        </DialogContent>
      </Dialog>
    )
    expect(document.querySelector("[data-slot=dialog-body]")).toBeNull()
    expect(screen.getByTestId("f").parentElement.getAttribute("data-slot")).toBe("dialog-frame")
  })

  it("leaves a form that is the frame's only child alone, its own strips and body inside it", () => {
    // NewDashboardDialog's shape: the form wraps the strips so Enter submits from any field.
    render(
      <Dialog open>
        <DialogContent>
          <form data-testid="f">
            <DialogHeader>
              <DialogTitle>T</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <input aria-label="Name" />
            </DialogBody>
            <DialogFooter>
              <button type="submit">Create</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
    const form = screen.getByTestId("f")
    // A child without a data-slot is the frame's flex column, so the strips inside it lay out as if on the frame.
    expect(form.parentElement.getAttribute("data-slot")).toBe("dialog-frame")
    expect(Array.from(form.children).map((c) => c.getAttribute("data-slot"))).toEqual([
      "dialog-header",
      "dialog-body",
      "dialog-footer",
    ])
    expect(document.querySelectorAll("[data-slot=dialog-body]")).toHaveLength(1)
  })

  it("treats an element that names a strip's data-slot as that strip", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle className="sr-only">T</DialogTitle>
          <p>loose</p>
          <div data-slot="dialog-footer">
            <button>Go</button>
          </div>
        </DialogContent>
      </Dialog>
    )
    const body = document.querySelector("[data-slot=dialog-body]")
    expect(body).not.toBeNull()
    expect(body.textContent).toContain("loose")
    expect(screen.getByRole("button", { name: "Go" }).closest("[data-slot=dialog-footer]").parentElement.getAttribute("data-slot")).toBe(
      "dialog-frame"
    )
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

  it("is the grey frame on its edge, with the side's sheet shadow and a 440 width", () => {
    const { rerender } = render(sheet())
    let content = screen.getByRole("dialog")
    expect(content.className).toContain("bg-frame")
    expect(content.className).toContain("shadow-sheet")
    expect(content.className).toContain("rounded-l-overlay")
    expect(content.className).toContain("w-[440px]")
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("top-2.5")
    rerender(sheet("left"))
    content = screen.getByRole("dialog")
    expect(content.className).toContain("shadow-sheet-left")
    rerender(sheet("bottom"))
    expect(screen.getByRole("dialog").className).toContain("shadow-sheet-bottom")
  })

  it("gathers content between its header and footer into the body", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>T</SheetTitle>
            <SheetDescription>D</SheetDescription>
          </SheetHeader>
          <p>content</p>
          <SheetFooter>
            <button>Done</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
    const body = document.querySelector("[data-slot=sheet-body]")
    expect(body.textContent).toBe("content")
    expect(body.className).toContain("bg-background")
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

  it("draws the list surface, 40 rows at 16, label and edge-to-edge separator", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Group</DropdownMenuLabel>
          <DropdownMenuItem>One</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const menu = screen.getByRole("menu")
    expect(menu.className).toContain("rounded-control-lg")
    expect(menu.className).toContain("p-1.5")
    expect(menu.className).toContain("motion-safe:data-[state=open]:[animation-duration:200ms]")
    expect(menu.className).toContain("motion-safe:data-[side=bottom]:slide-in-from-top-1")
    const item = screen.getByRole("menuitem", { name: "One" })
    expect(item.className).toContain("min-h-10")
    expect(item.className).toContain("rounded-control-sm")
    expect(item.className).toContain("text-base")
    expect(item.className).toContain("data-highlighted:bg-muted")
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("data-[variant=destructive]:text-menu-destructive")
    expect(screen.getByText("Group").className).toContain("text-xs")
    expect(document.querySelector("[data-slot=dropdown-menu-separator]").className).toContain("-mx-1.5")
    expect(document.querySelector("[data-slot=dropdown-menu-separator]").className).toContain("bg-divider")
  })

  it("sm menus open 32 rows at 14", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent size="sm">
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const item = screen.getByRole("menuitem", { name: "One" })
    expect(item.className).toContain("min-h-8")
    expect(item.className).toContain("text-sm")
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
    expect(el.className).toContain("rounded-control-lg")
    expect(el.className).toContain("motion-safe:data-[state=closed]:[animation-duration:140ms]")
    expect(el.getAttribute("data-ds")).toBe("popover")
  })
})

describe("Tooltip", () => {
  it("is the ink pill on the tooltip tokens", () => {
    render(
      <Tooltip open>
        <TooltipTrigger>t</TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>
    )
    const el = document.querySelector("[data-slot=tooltip-content]")
    expect(el.className).toContain("shadow-tooltip")
    expect(el.className).toContain("bg-tooltip")
    expect(el.className).toContain("text-tooltip-foreground")
    expect(el.className).not.toContain("shadow-floating")
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

  it("items are list rows and follow the command's size", () => {
    const { rerender } = render(
      <Command>
        <CommandList>
          <CommandItem>Campaigns</CommandItem>
        </CommandList>
      </Command>
    )
    let item = document.querySelector("[data-slot=command-item]")
    expect(item.className).toContain("min-h-10")
    expect(item.className).toContain("data-[selected=true]:bg-muted")
    expect(document.querySelector("[data-slot=command-list]").className).toContain("p-1.5")
    rerender(
      <Command size="sm">
        <CommandList>
          <CommandItem>Campaigns</CommandItem>
        </CommandList>
      </Command>
    )
    item = document.querySelector("[data-slot=command-item]")
    expect(item.className).toContain("min-h-8")
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
    const dialog = screen.getByRole("alertdialog")
    expect(dialog.className).toContain("rounded-bezel")
    expect(dialog.querySelector("[data-slot=dialog-frame]").className).toContain("w-[400px]")
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
