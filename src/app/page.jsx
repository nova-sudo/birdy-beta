"use client"

import React from "react"

import { useRouter } from "next/navigation"
import { ChevronRight, Zap, Brain, BarChart3, Sparkles } from "lucide-react"

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen w-[calc(100dvw-15px)] bg-white text-slate-900">
      <nav className="fixed top-0 left-0 right-0 w-full z-50 border-b border-purple-200 bg-white/80 backdrop-blur-xl">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-violet-600">
              Birdy
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => router.push("/login")} className="text-slate-600 hover:text-purple-600 transition">
              Sign in
            </button>
            <button
              onClick={() => router.push("/register")}
              className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-semibold transition shadow-lg hover:shadow-purple-600/25"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-20 pb-20 ">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 border border-purple-300 text-purple-700 text-sm font-medium">
            <Zap className="w-4 h-4" />
            AI Marketing Revolution Starts Now
          </div>

          {/* Main Headline */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-tight text-balance">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600">
              Unleash Your
            </span>
            <br />
            <span className="text-slate-900">Marketing Genius</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Birdy isn't just AI—it's your strategic partner. Watch campaigns write themselves, audiences expand, and
            revenue soar. The future of marketing doesn't require a team. Just Birdy.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => router.push("/login")}
              className="group px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold text-lg transition shadow-2xl hover:shadow-purple-600/30 flex items-center gap-2"
            >
              Start Free Trial
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 border-t border-purple-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <StatCard number="2.5M+" label="Campaigns Analyzed" icon={<Brain className="w-6 h-6" />} />
          <StatCard number="340%" label="Average ROI Increase" icon={<BarChart3 className="w-6 h-6" />} />
          <StatCard number="98%" label="Accuracy Rate" icon={<Zap className="w-6 h-6" />} />
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-violet-600">
              Superpowers for Marketers
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you need to dominate your market in one intelligent platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FeatureCard
              title="Smart Campaign Generation"
              description="AI creates data-driven campaigns tailored to your audience. Connect to Meta, GoHighLevel, TikTok & more."
              icon={<Sparkles className="w-8 h-8 text-purple-600" />}
            />
            <FeatureCard
              title="Real-Time Analytics"
              description="Watch every metric that matters. Get instant insights that help you optimize on the fly."
              icon={<BarChart3 className="w-8 h-8 text-violet-600" />}
            />
            <FeatureCard
              title="Automated Scaling"
              description="Your campaigns grow automatically. Birdy increases budgets on winners and pauses underperformers instantly."
              icon={<Zap className="w-8 h-8 text-purple-600" />}
            />
            <FeatureCard
              title="Market Intelligence"
              description="Stay ahead of trends. Get competitive analysis, audience insights, and strategic recommendations daily."
              icon={<Brain className="w-8 h-8 text-violet-600" />}
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-purple-200 bg-purple-50">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900">Works With Your Stack</h2>
            <p className="text-xl text-slate-600">Seamlessly integrate with the tools you already love</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
            {["Meta", "GoHighLevel"].map((tool) => (
              <div
                key={tool}
                className="p-4 rounded-xl border border-purple-300 bg-white hover:bg-purple-100 transition text-center font-semibold text-purple-600 hover:text-purple-700"
              >
                {tool}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-purple-200">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900">Trusted by Growth Leaders</h2>
            <p className="text-xl text-slate-600">Powering marketing teams at companies scaling fast</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {[
              { company: "TechFlow", results: "450% growth in 6 months" },
              { company: "GrowthLabs", results: "$2.3M revenue generated" },
              { company: "ScaleUp", results: "10x efficiency gain" },
              { company: "MarketPro", results: "89% cost reduction" },
              { company: "BuildCo", results: "3M+ impressions/mo" },
              { company: "DataDriven", results: "95% campaign success" },
            ].map((item) => (
              <div
                key={item.company}
                className="p-6 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 space-y-2 hover:border-purple-400 transition"
              >
                <p className="font-bold text-slate-900">{item.company}</p>
                <p className="text-sm text-purple-600 font-semibold">{item.results}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-purple-200">
        <div className="max-w-4xl mx-auto text-center space-y-8 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl p-12 border border-purple-300">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900">Ready to Transform Your Marketing?</h2>
          <p className="text-xl text-slate-700">Join hundreds of brands already scaling with Birdy</p>
          <button
            onClick={() => router.push("/login")}
            className="group mx-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold text-lg transition shadow-2xl hover:shadow-purple-600/30 flex items-center gap-2"
          >
            Start Free Trial
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </button>
          <p className="text-sm text-slate-600">No credit card required. Full access for 14 days.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-200 px-6 py-12 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-600 text-sm">© 2025 Birdy AI. Bringing marketing into the future.</p>
          <div className="flex items-center gap-6 text-slate-600 text-sm">
            <button className="hover:text-purple-600 transition">Privacy</button>
            <button className="hover:text-purple-600 transition">Terms</button>
            <button className="hover:text-purple-600 transition">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StatCard({ number, label, icon }) {
  return (
    <div className="p-8 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 hover:border-purple-400 transition space-y-4">
      <div className="text-purple-600">{icon}</div>
      <div className="space-y-2">
        <p className="text-4xl font-black text-slate-900">{number}</p>
        <p className="text-slate-600 font-medium">{label}</p>
      </div>
    </div>
  )
}

function FeatureCard({ title, description, icon }) {
  return (
    <div className="p-8 rounded-xl border border-purple-200 bg-white hover:border-purple-400 hover:shadow-lg transition space-y-4 group">
      <div className="flex items-start justify-between">
        <div>{icon}</div>
      </div>
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
