"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import Silk from "@/components/Silk"
import BirdyLogo from "@/components/BirdyLogo"

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", default_currency: "" })
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8001/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      })

      const data = await response.json()

      if (response.ok && data.message === "Registration successful") {
        router.push("/clients")
      } else {
        setError(data.detail || "Registration failed. Please try again.")
      }
    } catch (err) {
      setError("Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Card className="shadow-md border bg-white">
              <CardHeader className="space-y-1 text-center pb-8">
                <div className="mx-auto mb-4 flex justify-center">
                  <BirdyLogo variant="icon" theme="light" size={56} priority />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Create your account</CardTitle>
                <CardDescription className="text-gray-600">Get started with your free account</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive" className="border-red-300 bg-red-50">
                    <AlertDescription className="text-sm text-red-600">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-800">Full name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <Input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="pl-10 h-11 bg-white border-gray-300 focus:border-purple-600 focus:ring-purple-600/20"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-800">Email address</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-800">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="pl-10 pr-10 h-11 bg-white border-gray-300 focus:border-purple-600 focus:ring-purple-600/20"
                        placeholder="Create a strong password"
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
                    <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
                  </div>

                  <div className="space-y-2">
                    <select
                      value={formData.default_currency}
                      onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="">Select your currency</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="CNY">CNY - Chinese Yuan</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="INR">INR - Indian Rupee</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CHF">CHF - Swiss Franc</option>
                      <option value="MXN">MXN - Mexican Peso</option>
                      <option value="AED">AED - UAE Dirham</option>
                      <option value="SAR">SAR - Saudi Riyal</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-600">
                  {"Already have an account? "}
                  <a href="/login" className="text-purple-600 hover:text-purple-700 font-medium transition-colors">
                    Sign in here
                  </a>
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-gray-500 mt-6">
              By creating an account, you agree to our{" "}
              <a href="/terms" className="text-purple-600 hover:text-purple-700">Terms of Service</a>{" "}
              and{" "}
              <a href="/privacy" className="text-purple-600 hover:text-purple-700">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>

      {/* Right: Silk wallpaper */}
      <div className="relative hidden lg:block p-4">
        <div className="relative h-full w-full overflow-hidden rounded-3xl">
          <Silk
            speed={5}
            scale={1}
            color="#7C3AED"
            noiseIntensity={1.5}
            rotation={0}
          />
          <div className="pointer-events-none absolute inset-0 text-white">
            {/* Top-left: Birdy lockup */}
            <div className="absolute left-8 top-8">
              <BirdyLogo variant="lockup" theme="dark" size={36} />
            </div>

            {/* Centered hero */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <h2 className="text-6xl font-semibold tracking-tight drop-shadow-lg">
                Join Birdy
              </h2>
              <p className="mt-5 max-w-lg text-2xl text-white/90 drop-shadow-md">
                Start growing smarter campaigns, conversations, and conversions in minutes.
              </p>
            </div>

            {/* Bottom-left */}
            <span className="absolute bottom-10 left-8 max-w-xs text-sm leading-relaxed text-white/75 drop-shadow">
              Built for teams that move fast and close faster.
            </span>

            {/* Bottom-right */}
            <span className="absolute bottom-10 right-10 text-sm font-medium tracking-wider text-white/80 drop-shadow">
              © Birdy 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
