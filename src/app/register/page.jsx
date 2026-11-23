"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, Mail } from "lucide-react"
import { Button, Notice, PasswordField, TextField } from "@/components/by"
import { AuthHeading, AuthLayout, LegalLinks, SwitchLink } from "@/components/auth/auth-layout"
import { publicRequest } from "@/lib/api"
import { useBirdy } from "@/components/birdy/use-birdy"

export default function RegisterPage() {
  // Email + password only. Name and currency used to live on this form, but
  // asking for them before the account exists is friction with no payoff —
  // the onboarding wizard collects both immediately afterwards (its
  // welcome_name step PUTs to /api/onboarding/state, which writes users.name).
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { state: birdyState, flash: flashBirdy } = useBirdy()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // publicRequest (not a raw fetch at a hardcoded host) so the base URL
      // comes from NEXT_PUBLIC_API_URL like every other call, and so the
      // auth_token / refresh_token cookies this endpoint sets are actually
      // stored — it sends credentials: "include".
      const response = await publicRequest("/api/register", {
        method: "POST",
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok && data.message === "Registration successful") {
        // /api/register already mints the session cookies, so the user is
        // genuinely signed in here. Mirror what LoginForm persists, because
        // ProtectedLayout gates on these localStorage keys rather than on the
        // cookie — without them a brand-new account was bounced to /login
        // immediately after signing up.
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days, matching JWT_EXPIRY_MINUTES

        localStorage.setItem("user", JSON.stringify(data.user))
        localStorage.setItem(
          "user_authenticated",
          JSON.stringify({ value: true, expires_at: expiresAt.toISOString() })
        )
        // A just-created account has by definition not finished the wizard, so
        // this needs no /api/onboarding/status round-trip the way login does.
        localStorage.setItem("onboarding_incomplete", "1")

        flashBirdy("celebrate")
        router.push("/welcome")
      } else {
        setError(data.detail || "Registration failed. Please try again.")
        flashBirdy("error")
      }
    } catch (err) {
      setError("Registration failed. Please try again.")
      flashBirdy("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      birdyState={birdyState}
      legal={<LegalLinks lead="By creating an account, you agree to our" />}
    >
      <AuthHeading title="Create your account">Set up Birdy for your agency in a few minutes.</AuthHeading>

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
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Create a strong password"
          help="Must be at least 8 characters long"
          required
        />
        <Button type="submit" kind="primary" size="lg" loading={isLoading} className="mt-1 w-full">
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <SwitchLink prompt="Already have an account?" href="/login">Sign in</SwitchLink>
    </AuthLayout>
  )
}
