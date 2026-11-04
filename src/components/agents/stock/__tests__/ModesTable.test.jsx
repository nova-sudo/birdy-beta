import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { ModesTable } from "../ModesTable"

const clients = [{ id: "g1", name: "Velvet Laser" }]
const settings = (over = {}) => ({ modes: { remove: "flag", add: "flag", revive: "flag" }, clients: { g1: { modes: { remove: "ask", add: "ask" } } }, ...over })

describe("ModesTable: a client's own Add choice", () => {
  it("shows Flag while posting new ads is off, because that is what the server does", () => {
    render(<ModesTable settings={settings({ add_writes_enabled: false })} clients={clients} onChange={() => {}} />)
    expect(screen.getByRole("combobox", { name: "Add for Velvet Laser" })).toHaveTextContent("Flag")
    expect(screen.getByRole("combobox", { name: "Remove for Velvet Laser" })).toHaveTextContent("Ask me")
  })

  it("shows the saved choice once posting is on", () => {
    render(<ModesTable settings={settings({ add_writes_enabled: true })} clients={clients} onChange={() => {}} />)
    expect(screen.getByRole("combobox", { name: "Add for Velvet Laser" })).toHaveTextContent("Ask me")
  })
})
