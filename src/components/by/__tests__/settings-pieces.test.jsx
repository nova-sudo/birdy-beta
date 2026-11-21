import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { Disclosure } from ".."

describe("Disclosure", () => {
  it("starts folded and opens on click", async () => {
    render(<Disclosure label="Where credits went" count="30 days"><p>Breakdown</p></Disclosure>)
    const row = screen.getByRole("button", { name: /Where credits went/ })
    expect(row).toHaveAttribute("aria-expanded", "false")
    expect(row).toHaveTextContent("30 days")
    expect(screen.queryByText("Breakdown")).toBeNull()
    await userEvent.click(row)
    expect(row).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Breakdown")).toBeInTheDocument()
  })

  it("can be controlled", async () => {
    const onOpenChange = vi.fn()
    render(<Disclosure label="Change password" open onOpenChange={onOpenChange}><p>Fields</p></Disclosure>)
    expect(screen.getByText("Fields")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Change password" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.getByText("Fields")).toBeInTheDocument()
  })
})

describe("SelectField", () => {
  it("shows the chosen option and reports a new choice", async () => {
    const { SelectField } = await import("..")
    const onValueChange = vi.fn()
    render(<SelectField label="Currency" value="GBP" onValueChange={onValueChange} options={[{ value: "GBP", label: "GBP (£)" }, { value: "USD", label: "USD ($)" }]} />)
    const trigger = screen.getByLabelText("Currency")
    expect(trigger).toHaveTextContent("GBP (£)")
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("menuitem", { name: "USD ($)" }))
    expect(onValueChange).toHaveBeenCalledWith("USD")
  })

  it("shows the placeholder when nothing matches", async () => {
    const { SelectField } = await import("..")
    render(<SelectField aria-label="Timezone" value="" onValueChange={() => {}} options={[{ value: "UTC", label: "UTC" }]} placeholder="Select a timezone" />)
    expect(screen.getByRole("button", { name: "Timezone" })).toHaveTextContent("Select a timezone")
  })
})
