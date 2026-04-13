"use client"

import React, { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Zap, Brain, BarChart3, Sparkles } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Silk from "@/components/Silk"
import BirdyLogo from "@/components/BirdyLogo"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

/* ---------- helper: split text into chars wrapped in spans ---------- */
function SplitChars({ text, className = "" }) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="split-char inline-block will-change-transform"
          style={{ whiteSpace: ch === " " ? "pre" : "normal" }}
        >
          {ch}
        </span>
      ))}
    </span>
  )
}

export default function Home() {
  const router = useRouter()
  const heroRef = useRef(null)
  const silkRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      /* ── Hero intro: char reveal ───────────────────────────── */
      gsap.set(".hero-line .split-char", { yPercent: 110, opacity: 0 })
      gsap.set(".hero-badge", { y: -20, opacity: 0 })
      gsap.set(".hero-sub", { y: 30, opacity: 0 })
      gsap.set(".hero-cta", { y: 30, opacity: 0 })
      gsap.set(".hero-float", { opacity: 0, scale: 0.8 })

      const tl = gsap.timeline({ defaults: { ease: "power4.out" } })
      tl.to(".hero-badge", { y: 0, opacity: 1, duration: 0.8 })
        .to(
          ".hero-line .split-char",
          {
            yPercent: 0,
            opacity: 1,
            duration: 1.1,
            stagger: { amount: 0.9, from: "start" },
          },
          "-=0.4"
        )
        .to(".hero-sub", { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
        .to(".hero-cta", { y: 0, opacity: 1, duration: 0.6 }, "-=0.4")
        .to(
          ".hero-float",
          { opacity: 1, scale: 1, duration: 1, stagger: 0.08, ease: "back.out(1.4)" },
          "-=0.8"
        )

      /* ── Parallax on scroll: silk + text layers ────────────── */
      gsap.to(silkRef.current, {
        yPercent: 25,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })

      gsap.to(".hero-content", {
        yPercent: -15,
        opacity: 0.3,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })

      /* ── Floating words drift ───────────────────────────────── */
      gsap.utils.toArray(".hero-float").forEach((el, i) => {
        gsap.to(el, {
          y: (i % 2 === 0 ? -1 : 1) * 20,
          duration: 3 + i * 0.3,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        })
      })

      /* ── Section reveals ────────────────────────────────────── */
      gsap.utils.toArray(".reveal").forEach((el) => {
        gsap.from(el, {
          y: 60,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      })

      /* ── Stats counter ──────────────────────────────────────── */
      gsap.utils.toArray(".stat-card").forEach((el, i) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          delay: i * 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
        })
      })

      /* ── Feature cards staggered ────────────────────────────── */
      gsap.from(".feature-card", {
        y: 60,
        opacity: 0,
        duration: 0.9,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".features-grid",
          start: "top 80%",
        },
      })
    }, heroRef)

    return () => ctx.revert()
  }, [])

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-slate-900">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="w-full px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <BirdyLogo variant="lockup" theme="dark" size={50} priority />
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push("/login")}
              className="text-white/80 hover:text-white transition"
            >
              Sign in
            </button>
            <button
              onClick={() => router.push("/register")}
              className="px-6 py-2 rounded-full bg-white text-purple-700 hover:bg-purple-50 font-semibold transition shadow-lg"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* HERO — Silk + scattered overlay text + GSAP */}
      <section
        ref={heroRef}
        className="relative w-full h-screen overflow-hidden"
      >
        {/* Silk background */}
        <div ref={silkRef} className="absolute inset-0">
          <Silk
            speed={5}
            scale={1}
            color="#7C3AED"
            noiseIntensity={1.5}
            rotation={0}
          />
          {/* subtle dark vignette for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 pointer-events-none" />
        </div>

        {/* Scattered floating words */}
        <div className="absolute inset-0 pointer-events-none text-white select-none">
          <span className="hero-float absolute left-[6%] top-[22%] text-sm uppercase tracking-[0.35em] text-white/70 drop-shadow">
            Marketing · Reinvented
          </span>
          <span className="hero-float absolute right-[8%] top-[18%] text-xl italic text-white/80 drop-shadow">
            AI-native.
          </span>
          <span className="hero-float absolute left-[4%] top-[55%] rotate-[-6deg] text-2xl font-light text-white/50 drop-shadow">
            Campaigns.
          </span>
          <span className="hero-float absolute right-[6%] top-[62%] rotate-[5deg] text-2xl font-light text-white/50 drop-shadow">
            Conversions.
          </span>
          <span className="hero-float absolute left-[10%] bottom-[14%] text-xs uppercase tracking-[0.3em] text-white/60 drop-shadow">
            Built for growth teams
          </span>
          <span className="hero-float absolute right-[10%] bottom-[16%] text-xs uppercase tracking-[0.3em] text-white/60 drop-shadow">
            Scroll to explore ↓
          </span>
        </div>

        {/* Hero main content */}
        <div className="hero-content relative z-10 h-full flex flex-col items-center justify-center text-center px-6 text-white">
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white text-sm font-medium">
            <Zap className="w-4 h-4" />
            AI Marketing Revolution Starts Now
          </div>

          <h1 className="mt-6 text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] drop-shadow-2xl">
            <span className="block overflow-hidden">
              <SplitChars text="Unleash Your" className="hero-line" />
            </span>
            <span className="block overflow-hidden">
              <SplitChars text="Marketing Genius" className="hero-line" />
            </span>
          </h1>

          <p className="hero-sub mt-6 text-lg md:text-xl text-white/85 max-w-2xl drop-shadow">
            Birdy isn't just AI — it's your strategic partner. Campaigns write
            themselves and revenue soars.
          </p>

          <div className="hero-cta mt-10">
            <button
              onClick={() => router.push("/login")}
              className="px-8 py-4 rounded-full bg-white text-purple-700 font-bold text-lg shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
            >
              Book your demo
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* apply .hero-line .split-char class to all split chars inside .hero-line */}
        <style jsx>{`
          :global(.hero-line .split-char) {
          }
        `}</style>
      </section>

      {/* STATS */}
      <section className="w-full border-t border-purple-200 bg-white relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <StatCard number="2.5M+" label="Campaigns Analyzed" icon={<Brain />} />
          <StatCard number="340%" label="Average ROI Increase" icon={<BarChart3 />} />
          <StatCard number="98%" label="Accuracy Rate" icon={<Zap />} />
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-20 relative z-20">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="reveal text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-violet-600">
              Superpowers for Marketers
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you need to dominate your market
            </p>
          </div>

          <div className="features-grid grid grid-cols-1 md:grid-cols-2 gap-8">
            <FeatureCard title="Smart Campaign Generation" description="AI creates campaigns tailored to your audience." icon={<Sparkles />} />
            <FeatureCard title="Real-Time Analytics" description="Instant insights that optimize performance." icon={<BarChart3 />} />
            <FeatureCard title="Automated Scaling" description="Budgets adjust automatically." icon={<Zap />} />
            <FeatureCard title="Market Intelligence" description="Daily competitive insights." icon={<Brain />} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-purple-200 relative z-20">
        <div className="reveal max-w-6xl mx-auto text-center space-y-8 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl p-12 border border-purple-300">
          <h2 className="text-4xl md:text-5xl font-black">
            Ready to Transform Your Marketing?
          </h2>
          <p className="text-xl text-slate-700">
            Join brands already scaling with Birdy
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mx-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
          >
            Book your demo
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <footer className="border-t border-purple-200 px-6 py-6 bg-white relative z-20">
        <div className="max-w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-600 text-sm">
            © 2025 Birdy AI. Bringing marketing into the future.
          </p>
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

/* ------------------ COMPONENTS ------------------ */

function StatCard({ number, label, icon }) {
  return (
    <div className="stat-card p-8 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 space-y-4">
      <div className="text-purple-600">{icon}</div>
      <p className="text-4xl font-black">{number}</p>
      <p className="text-slate-600">{label}</p>
    </div>
  )
}

function FeatureCard({ title, description, icon }) {
  return (
    <div className="feature-card p-8 rounded-xl border border-purple-200 bg-white hover:shadow-lg hover:-translate-y-1 transition-all space-y-4">
      <div className="text-purple-600">{icon}</div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  )
}
