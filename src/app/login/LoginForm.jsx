"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { checkAndRefreshExpiredTokens } from "@/lib/checkExpiredTokens"

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://birdy-backend.vercel.app"

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok || data.message !== "Login successful") {
        setError(data.detail || "Login failed. Please try again.")
        return
      }

      // ── 2. Persist session ───────────────────────────────────────────────
      const now = new Date()
      const expiresAt = formData.rememberMe
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
        : new Date(now.getTime() + 60 * 60 * 1000)            // 1 hour

      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem(
        "user_authenticated",
        JSON.stringify({ value: true, expires_at: expiresAt.toISOString() })
      )

      // ── 3. Check for expired integration tokens ──────────────────────────
      // checkAndRefreshExpiredTokens returns:
      //   null   → it already kicked off an OAuth redirect; do nothing here
      //   string → the path we should navigate to
      const intendedRedirect = searchParams.get("redirect") || "/clients"
      const nextPath = await checkAndRefreshExpiredTokens(intendedRedirect)

      if (nextPath !== null) {
        router.push(nextPath)
      }
      // If nextPath === null the browser is already navigating to the OAuth
      // provider, so we intentionally do nothing further.
    } catch (err) {
      console.error("Login error:", err)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-[calc(100dvw-0px)] max-w-md">
        <Card className="shadow-md border bg-white">
          <CardHeader className="space-y-1 text-center pb-8">
            <div className="mx-auto w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">Welcome back</CardTitle>
            <CardDescription className="text-gray-600">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-red-300 bg-red-50">
                <AlertDescription className="text-sm text-red-600">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-800">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <Input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 h-11 bg-white border-gray-300 focus:border-purple-600 focus:ring-purple-600/20"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-800">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10 h-11 bg-white border-gray-300 focus:border-purple-600 focus:ring-purple-600/20"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors border-0 p-0 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="text-center text-sm text-gray-600">
              {"Don't have an account? "}
              <a
                href="/register"
                className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
              >
                Create one here
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}