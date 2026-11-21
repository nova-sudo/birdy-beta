import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { SelectField } from ".."

const ZONES = [{ value: "Europe/London", label: "London" }, { value: "Asia/Dubai", label: "Dubai" }]

describe("SelectField", () => {
  it("is a labelled select of the options given", () => {
    render(<SelectField label="Timezone" options={ZONES} defaultValue="Asia/Dubai" />)
    const select = screen.getByRole("combobox", { name: "Timezone" })
    expect(select).toHaveValue("Asia/Dubai")
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["London", "Dubai"])
  })

  it("reports the choice made", async () => {
    const onChange = vi.fn()
    render(<SelectField label="Timezone" options={ZONES} value="Europe/London" onChange={(e) => onChange(e.target.value)} />)
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Timezone" }), "Asia/Dubai")
    expect(onChange).toHaveBeenCalledWith("Asia/Dubai")
  })

  it("reads out its hint, and its error in place of the hint", () => {
    const { rerender } = render(<SelectField label="Channel" options={ZONES} help="Private channels need Birdy invited." />)
    expect(screen.getByRole("combobox", { name: "Channel" })).toHaveAccessibleDescription("Private channels need Birdy invited.")
    rerender(<SelectField label="Channel" options={ZONES} help="hint" error="Choose a channel" />)
    const select = screen.getByRole("combobox", { name: "Channel" })
    expect(select).toHaveAttribute("aria-invalid", "true")
    expect(select).toHaveAccessibleDescription("Choose a channel")
  })
})
