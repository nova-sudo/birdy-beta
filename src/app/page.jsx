"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Zap, Brain, BarChart3, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
}

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-slate-900">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 w-full z-50 border-b border-purple-200 bg-white/80 backdrop-blur-xl">
        <div className="w-full px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-violet-600">
              Birdy
            </span>
          </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/login")}
            className="text-slate-600 hover:text-purple-600 transition"
          >
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

      {/* HERO */}
      <section className="w-full pt-24 pb-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="text-center space-y-8"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 border border-purple-300 text-purple-700 text-sm font-medium">
            <Zap className="w-4 h-4" />
            AI Marketing Revolution Starts Now
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-tight"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600">
              Unleash Your
            </span>
            <br />
            <span>Marketing Genius</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto"
          >
            Birdy isn't just AI—it's your strategic partner. Campaigns write themselves and revenue soars.
          </motion.p>

          <motion.div variants={fadeUp}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/login")}
              className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg shadow-2xl flex items-center gap-2 mx-auto"
            >
              Book your demo
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* STATS */}
      <section className="w-screen border-t border-purple-200">
  <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
    <StatCard number="2.5M+" label="Campaigns Analyzed" icon={<Brain />} />
    <StatCard number="340%" label="Average ROI Increase" icon={<BarChart3 />} />
    <StatCard number="98%" label="Accuracy Rate" icon={<Zap />} />
  </div>
</section>


      {/* FEATURES */}
      <section className="px-6 py-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-6xl mx-auto space-y-16"
        >
          <motion.div variants={fadeUp} className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-violet-600">
              Superpowers for Marketers
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you need to dominate your market
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FeatureCard title="Smart Campaign Generation" description="AI creates campaigns tailored to your audience." icon={<Sparkles />} />
            <FeatureCard title="Real-Time Analytics" description="Instant insights that optimize performance." icon={<BarChart3 />} />
            <FeatureCard title="Automated Scaling" description="Budgets adjust automatically." icon={<Zap />} />
            <FeatureCard title="Market Intelligence" description="Daily competitive insights." icon={<Brain />} />
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="px-6 py-20 border-t border-purple-200"
      >
        <div className="max-w-6xl mx-auto text-center space-y-8 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl p-12 border border-purple-300">
          <h2 className="text-4xl md:text-5xl font-black">Ready to Transform Your Marketing?</h2>
          <p className="text-xl text-slate-700">Join brands already scaling with Birdy</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/login")}
            className="mx-auto px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg shadow-2xl flex items-center gap-2"
          >
            Book your demo
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.section>
      <footer className="border-t border-purple-200 px-6 left-0 right-0 w-full py-6 bg-white"> <div className="max-w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-6"> <p className="text-slate-600 text-sm">© 2025 Birdy AI. Bringing marketing into the future.</p> <div className="flex items-center gap-6 text-slate-600 text-sm"> <button className="hover:text-purple-600 transition">Privacy</button> <button className="hover:text-purple-600 transition">Terms</button> <button className="hover:text-purple-600 transition">Contact</button> </div> </div> </footer>
    </div>
  )
}

/* ------------------ COMPONENTS ------------------ */

function StatCard({ number, label, icon }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="p-8 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 space-y-4"
    >
      <div className="text-purple-600">{icon}</div>
      <p className="text-4xl font-black">{number}</p>
      <p className="text-slate-600">{label}</p>
    </motion.div>
  )
}

function FeatureCard({ title, description, icon }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="p-8 rounded-xl border border-purple-200 bg-white hover:shadow-lg space-y-4"
    >
      <div className="text-purple-600">{icon}</div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </motion.div>
  )
}
