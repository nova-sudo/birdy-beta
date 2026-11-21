import { describe, it, expect, vi } from "vitest"

const redirect = vi.fn()
vi.mock("next/navigation", () => ({ redirect: (to) => redirect(to) }))

const { default: OnboardingRedirect } = await import("../page")

describe("/onboarding", () => {
  it("sends the old address to /welcome", async () => {
    await OnboardingRedirect({ searchParams: Promise.resolve({}) })
    expect(redirect).toHaveBeenLastCalledWith("/welcome")
  })

  it("keeps the query", async () => {
    await OnboardingRedirect({ searchParams: Promise.resolve({ s: "mb", tag: ["a", "b"] }) })
    expect(redirect).toHaveBeenLastCalledWith("/welcome?s=mb&tag=a&tag=b")
  })
})
