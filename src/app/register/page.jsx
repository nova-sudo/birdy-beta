"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label, Notice } from "@/components/ds"
import { publicRequest } from "@/lib/api"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { useBirdy } from "@/components/birdy/use-birdy"
import AuthLayout from "@/components/auth/AuthLayout"
import PasswordInput from "@/components/auth/PasswordInput"

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
        router.push("/onboarding")
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
      prompt="Already have an account?"
      linkHref="/login"
      linkLabel="Sign in"
      panelHeadline="Join Birdy"
      panelSub="Start growing smarter campaigns, conversations, and conversions in minutes."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <BirdyAvatar state={birdyState} size={52} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-base text-muted-foreground">Get started with your free account</p>
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
              placeholder="Create a strong password"
              required
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters long</p>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <a href="/billing/terms-of-service" className="text-primary hover:underline">Terms of Service</a>{" "}
          and{" "}
          <a href="/billing/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>
    </AuthLayout>
  )
}
