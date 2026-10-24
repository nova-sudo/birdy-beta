"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Input, Label, Notice } from "@/components/ds"
import PasswordInput from "@/components/auth/PasswordInput"
import { checkAndRefreshExpiredTokens } from "@/lib/checkExpiredTokens"
import { prefetchAfterLogin } from "@/lib/prefetch"
import { writeSession, ADMIN_HOME } from "@/lib/session"
import { apiRequest, publicRequest } from "@/lib/api"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [id]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // ── 1. Authenticate ──────────────────────────────────────────────────
      const response = await publicRequest("/api/login", {
        method: "POST",
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok || data.message !== "Login successful") {
        setError(data.detail || "Login failed. Please try again.")
        return
      }

      // ── 2. Persist session ───────────────────────────────────────────────
      // Client-side auth flag matches the backend JWT_EXPIRY_MINUTES (30 days).
      // We used to give un-remembered logins a 1-hour TTL here, but that flag
      // is what ProtectedLayout reads to gate the app — so users were getting
      // bounced to /login every hour even though their cookie was still valid.
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem(
        "user_authenticated",
        JSON.stringify({ value: true, expires_at: expiresAt.toISOString() })
      )
      // Same fact, in a place the server can read it, so middleware can route
      // the next request without waiting for the app to hydrate. Onboarding is
      // still unknown at this point — the check is a few lines below — so it
      // starts false and gets rewritten there.
      writeSession({
        expiresAt: expiresAt.toISOString(),
        role: data.user?.role ?? null,
        onboardingIncomplete: false,
      })

      // ✅ Save currency so useUserCurrency hook reads it instantly on first render
      if (data.user?.default_currency) {
        localStorage.setItem("user_default_currency", data.user.default_currency)
      }

      // ── 2.5 Admins go to the admin console, and nowhere else ────────────
      // No onboarding, no agency prefetch, no integration token checks: an
      // admin's account holds no clients. Agency screens are reached only by
      // impersonating from the console.
      if (data.user?.role === "admin") {
        localStorage.removeItem("onboarding_incomplete")
        router.push(ADMIN_HOME)
        return
      }

      // ── 3. Prefetch client-groups + views (fire-and-forget) ─────────────
      prefetchAfterLogin()

      // ── 3.5 First-run onboarding gate ────────────────────────────────────
      // A user who has never completed onboarding goes straight to the wizard
      // instead of the app. Grandfathering for pre-wizard accounts happens
      // server-side, so existing users always come back completed here.
      try {
        const obRes = await apiRequest("/api/onboarding/status")
        if (obRes.ok) {
          const ob = await obRes.json()
          if (!ob.completed) {
            localStorage.setItem("onboarding_incomplete", "1")
            writeSession({
              expiresAt: expiresAt.toISOString(),
              role: data.user?.role ?? null,
              onboardingIncomplete: true,
            })
            router.push("/onboarding")
            return
          }
          localStorage.removeItem("onboarding_incomplete")
        }
      } catch {
        // Status check failing should never block login — fall through.
      }

      // ── 4. Check for expired integration tokens ──────────────────────────
      const intendedRedirect = searchParams.get("redirect") || "/dashboard"
      const nextPath = await checkAndRefreshExpiredTokens(intendedRedirect)

      if (nextPath !== null) {
        router.push(nextPath)
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BirdyAvatar size={52} />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-base text-muted-foreground">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            type="email"
            id="email"
            value={formData.email}
            onChange={handleChange}
            className="h-control-lg text-base"
            placeholder="Enter your email"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
