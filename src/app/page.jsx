"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Sparkles } from "lucide-react"

export default function Home() {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push('/login')
  }

  return (
    <div className="w-full min-h-dvh bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Logo/Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-600 rounded-2xl shadow-lg">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-bold text-gray-900">
            Birdy AI
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto">
            Streamline your marketing workflows with intelligent automation
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto pt-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="text-purple-600 font-semibold mb-2">Connect</div>
            <p className="text-gray-600 text-sm">
              Integrate with GoHighLevel, Meta, and more
            </p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="text-purple-600 font-semibold mb-2">Automate</div>
            <p className="text-gray-600 text-sm">
              Smart campaigns that run on autopilot
            </p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="text-purple-600 font-semibold mb-2">Grow</div>
            <p className="text-gray-600 text-sm">
              Scale your business with AI-powered insights
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-8">
          <button
            onClick={handleGetStarted}
            className="group inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Footer */}
        <p className="text-sm text-gray-500 pt-8">
          Already have an account?{" "}
          <button
            onClick={() => router.push('/login')}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}