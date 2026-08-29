import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useMemo, useState } from "react"
import {
  PageHeaderControls,
  PageHeaderProvider,
  PageHeaderTitle,
  useHasPageHeader,
  usePageHeader,
} from "@/components/page-header"

function Wordmark() {
  return useHasPageHeader() ? null : <span>Birdy</span>
}

function Bar() {
  return (
    <header>
      <PageHeaderTitle />
      <Wordmark />
      <PageHeaderControls />
    </header>
  )
}

/** A route that claims the bar for as long as it is mounted.
 *
 * Memoised, as the hook requires: publishing sets state on the provider, which
 * re-renders the page, so a fresh object every render never settles.
 */
function Owner({ title = "Aura Dental" }) {
  const content = useMemo(
    () => ({ title: <h1>{title}</h1>, controls: <button>Last 30 days</button> }),
    [title]
  )
  usePageHeader(content)
  return null
}

/** A component that renders inside a route but abstains from the bar. */
function Embedded() {
  usePageHeader(null)
  return <p>embedded</p>
}

describe("usePageHeader", () => {
  it("puts the page's title and controls where the wordmark was", () => {
    render(
      <PageHeaderProvider>
        <Bar />
        <Owner />
      </PageHeaderProvider>
    )

    expect(screen.getByRole("heading", { name: "Aura Dental" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeInTheDocument()
    expect(screen.queryByText("Birdy")).not.toBeInTheDocument()
  })

  it("leaves the owner's header alone when an embedded child abstains", async () => {
    // The regression: MarketingContent passes null when it renders inside the
    // client detail page. Publishing that null blanked the client's name and
    // date picker the moment you opened the Marketing tab.
    const user = userEvent.setup()

    function ClientPage() {
      const [tab, setTab] = useState("overview")
      return (
        <>
          <Owner />
          <button onClick={() => setTab(tab === "overview" ? "marketing" : "overview")}>
            switch tab
          </button>
          {tab === "marketing" && <Embedded />}
        </>
      )
    }

    render(
      <PageHeaderProvider>
        <Bar />
        <ClientPage />
      </PageHeaderProvider>
    )

    await user.click(screen.getByRole("button", { name: "switch tab" }))
    expect(screen.getByText("embedded")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Aura Dental" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeInTheDocument()

    // And switching back must not have left anything behind either.
    await user.click(screen.getByRole("button", { name: "switch tab" }))
    expect(screen.getByRole("heading", { name: "Aura Dental" })).toBeInTheDocument()
  })

  it("restores the wordmark once the owning route unmounts", async () => {
    const user = userEvent.setup()

    function App() {
      const [onRoute, setOnRoute] = useState(true)
      return (
        <>
          <button onClick={() => setOnRoute(false)}>leave</button>
          {onRoute && <Owner />}
        </>
      )
    }

    render(
      <PageHeaderProvider>
        <Bar />
        <App />
      </PageHeaderProvider>
    )

    expect(screen.queryByText("Birdy")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "leave" }))
    expect(screen.getByText("Birdy")).toBeInTheDocument()
  })

  it("hands the bar to the incoming route when two overlap", async () => {
    // Next mounts the incoming route before the outgoing one unmounts, so the
    // outgoing cleanup runs last and must not blank what the new page put up.
    const user = userEvent.setup()

    function App() {
      const [both, setBoth] = useState(true)
      return (
        <>
          <button onClick={() => setBoth(false)}>finish navigation</button>
          {both && <Owner title="Aura Dental" />}
          <Owner title="Client Hub" />
        </>
      )
    }

    render(
      <PageHeaderProvider>
        <Bar />
        <App />
      </PageHeaderProvider>
    )

    await user.click(screen.getByRole("button", { name: "finish navigation" }))
    expect(screen.getByRole("heading", { name: "Client Hub" })).toBeInTheDocument()
    expect(screen.queryByText("Birdy")).not.toBeInTheDocument()
  })
})
