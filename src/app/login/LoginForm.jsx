"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleAlert, Mail } from "lucide-react"
import { Button, Notice, PasswordField, TextField } from "@/components/by"
import { AuthHeading, SwitchLink } from "@/components/auth/auth-layout"
import { checkAndRefreshExpiredTokens } from "@/lib/checkExpiredTokens"
import { prefetchAfterLogin } from "@/lib/prefetch"
import { writeSession, ADMIN_HOME } from "@/lib/session"
import { apiRequest, publicRequest } from "@/lib/api"

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
            router.push("/welcome")
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
    <>
      <AuthHeading title="Welcome back">Sign in to your agency.</AuthHeading>

      {error && (
        <Notice tone="danger" icon={<CircleAlert aria-hidden="true" />} className="mb-4">
          {error}
        </Notice>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          id="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          leading={<Mail aria-hidden="true" />}
          placeholder="you@agency.com"
          required
        />
        <PasswordField
          label="Password"
          id="password"
          autoComplete="current-password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          required
        />
        <Button type="submit" kind="primary" size="lg" loading={isLoading} className="mt-1 w-full">
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <SwitchLink prompt="New to Birdy?" href="/register">Create an account</SwitchLink>
    </>
  )
}
