import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HistoryProgress } from "../HistoryProgress"

const client = (i, status, error = null) => ({ client_group_id: `g${i}`, name: `Client ${i}`, status, error })

function history({ ready, total, errors = [] }) {
  const clients = [
    ...Array.from({ length: ready }, (_, i) => client(i, "ready")),
    ...errors,
    ...Array.from({ length: Math.max(0, total - ready - errors.length) }, (_, i) => client(100 + i, "pending")),
  ]
  return { total, ready, clients }
}

describe("HistoryProgress", () => {
  it("shows ready of total and the can't-read list", async () => {
    const user = userEvent.setup()
    const h = history({
      ready: 18,
      total: 45,
      errors: [client(900, "error", "no_access"), client(901, "error", "failed")],
    })
    render(<HistoryProgress history={h} />)

    expect(screen.getByText("Getting your ad history from Meta")).toBeInTheDocument()
    expect(screen.getByText("18 of 45 clients ready. Cases appear as each one finishes.")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40")
    expect(
      screen.getByText("2 clients can't be read: Meta hasn't given access to their ad accounts.")
    ).toBeInTheDocument()
    expect(screen.queryByText("Client 900")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "See which" }))
    expect(screen.getByText("Client 900")).toBeInTheDocument()
    expect(screen.getByText("Client 901")).toBeInTheDocument()
  })

  it("uses the singular for one client", () => {
    render(<HistoryProgress history={history({ ready: 1, total: 3, errors: [client(900, "error", "no_access")] })} />)
    expect(
      screen.getByText("1 client can't be read: Meta hasn't given access to their ad accounts.")
    ).toBeInTheDocument()
  })

  it("asks to reconnect Meta for a client with no token", () => {
    render(<HistoryProgress history={history({ ready: 1, total: 3, errors: [client(900, "error", "no_token")] })} />)
    expect(screen.getByText(/Reconnect Meta in Settings/)).toBeInTheDocument()
    expect(screen.queryByText(/Meta hasn't given access/)).not.toBeInTheDocument()
  })

  it("shows both lines when both kinds of error exist", () => {
    const errors = [client(900, "error", "no_token"), client(901, "error", "failed")]
    render(<HistoryProgress history={history({ ready: 1, total: 4, errors })} />)
    expect(screen.getByText(/Reconnect Meta in Settings/)).toBeInTheDocument()
    expect(screen.getByText(/Meta hasn't given access/)).toBeInTheDocument()
  })

  it("does not list a ready client whose later top-up failed", () => {
    const h = history({ ready: 1, total: 3 })
    h.clients[0].error = "failed"
    render(<HistoryProgress history={h} />)
    expect(screen.queryByText(/can't be read/)).not.toBeInTheDocument()
  })

  it("renders nothing once every client is ready", () => {
    const { container } = render(<HistoryProgress history={history({ ready: 3, total: 3 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing while history is loading", () => {
    const { container } = render(<HistoryProgress history={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows only the can't-read line when the rest are ready", () => {
    const h = history({ ready: 2, total: 3, errors: [client(900, "error", "failed")] })
    render(<HistoryProgress history={h} />)
    expect(screen.queryByText("Getting your ad history from Meta")).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.getByText(/1 client can't be read/)).toBeInTheDocument()
  })
})
