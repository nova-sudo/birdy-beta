"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing } from "lucide-react";
import { Button, Input } from "@/components/ds";
import BirdyAvatar from "@/components/birdy/BirdyAvatar";
import { CountUp, EASE_OUT, Pop, Reveal } from "@/components/motion";
import { publicRequest } from "@/lib/api";

// Remembers the joined email locally so a returning visitor sees the
// "already on the list" state instead of re-submitting the form.
const WAITLIST_STORAGE_KEY = "birdy_waitlist_email";

const TREND = "M0,100 C40,96 60,90 100,82 S170,70 210,60 S290,44 330,30 S380,18 400,14";

/**
 * The hero's right-hand side: a small, animated picture of Birdy at work —
 * figures land, the trend draws, an alert fires, and Birdy's recommendation
 * arrives last. It is an illustration built from the app's own pieces, not a
 * screenshot, and its numbers are made up, so it is hidden from assistive tech
 * behind a plain description.
 */
function ProductPreview() {
  return (
    <figure className="relative" role="img" aria-label="Illustration of Birdy flagging a client's rising cost per lead and recommending a fix">
      <Reveal delay={0.15} className="rounded-frame bg-background p-4 shadow-floating" aria-hidden="true">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Ad spend", "£18,903"],
            ["Leads", "1,284"],
            ["Cost per lead", "£14.72"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-surface px-3 py-2.5 shadow-surface">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                <CountUp value={value} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 rounded-surface p-2.5 shadow-surface">
          <div className="text-xs text-muted-foreground">Leads · last 30 days</div>
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="mt-1 h-[120px] w-full">
            <path d={`${TREND} L400,120 L0,120Z`} fill="var(--color-primary)" opacity=".07" />
            <motion.path
              d={TREND}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.4 }}
            />
          </svg>
        </div>

        <div className="mt-2.5 flex items-center justify-between rounded-surface px-3 py-2.5 text-xs shadow-surface">
          <span className="text-body"><b className="text-foreground">Harbourside Dental</b> · £11.09 CPL</span>
          <span className="font-semibold text-success-ink">−8.2%</span>
        </div>
      </Reveal>

      <Pop
        delay={1.4}
        aria-hidden="true"
        className="absolute -left-4 bottom-24 flex items-center gap-2.5 rounded-overlay bg-danger-soft px-3.5 py-2.5 text-xs text-danger-ink shadow-floating sm:-left-7"
      >
        <span className="flex size-8 items-center justify-center rounded-control bg-danger text-primary-foreground">
          <BellRing className="size-4" />
        </span>
        <span>
          <b className="block">CPL spike</b>
          <span>Kestrel Roofing hit £27.43</span>
        </span>
      </Pop>

      <Pop
        delay={2.2}
        aria-hidden="true"
        className="absolute -bottom-6 right-2 w-[272px] rounded-overlay bg-primary px-3.5 py-3 text-xs leading-snug text-primary-foreground shadow-floating sm:-right-5"
      >
        <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <BirdyAvatar size={24} paused />
          Birdy recommends
        </span>
        Pause 2 ad sets on Kestrel Roofing: £48 CPL vs £22 target, 0 leads in 5 days.
      </Pop>
    </figure>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | joined | already

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WAITLIST_STORAGE_KEY);
      if (saved) {
        setEmail(saved);
        setStatus("already");
      }
    } catch {
      // localStorage unavailable — just show the empty form
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || status === "loading") return;

    setStatus("loading");
    try {
      // TODO(backend): POST /api/waitlist doesn't exist yet — falls back to
      // an optimistic "joined" state until it does.
      const res = await publicRequest("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: trimmed }),
      });
      setStatus(res.status === 409 ? "already" : "joined");
    } catch {
      setStatus("joined");
    } finally {
      try { localStorage.setItem(WAITLIST_STORAGE_KEY, trimmed); } catch {}
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-frame text-foreground">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <BirdyAvatar size={34} />
          <span className="text-xl font-semibold tracking-tight">Birdy</span>
        </div>
        <span className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background">Coming soon</span>
      </header>

      {/* HERO */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-24 pt-8 md:px-10 lg:grid-cols-[1fr_1.05fr] lg:pt-14">
        <div>
          <Reveal>
            <h1 className="text-title-sm font-semibold tracking-[-0.02em] text-balance md:text-title">
              The AI Brain That Runs &amp; <span className="text-primary">Scales</span> Your Agency
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-5 max-w-[46ch] text-base text-muted-foreground">
              Birdy connects your ads, CRM, bookings, and revenue data across all clients,
              flags problems early, and guides what to fix or scale next.
            </p>
          </Reveal>

          <Reveal delay={0.16} className="mt-7 min-h-[48px]">
            {status === "joined" || status === "already" ? (
              <div className="flex items-center gap-3">
                <BirdyAvatar size={48} state="celebrate" />
                <div>
                  <p className="text-lg font-semibold">
                    {status === "joined" ? "Boom... You're on the List! 🎉" : "Hey... You're Already on the List! 😉"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {status === "joined"
                      ? "You're one step closer to running a stress-free agency"
                      : "We'll get you onboarded as quick as possible."}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  aria-label="Email address"
                  className="h-control-lg px-5 text-base sm:w-72"
                />
                <Button type="submit" variant="primary" size="lg" disabled={status === "loading"}>
                  {status === "loading" ? "Joining..." : "Join the Waitlist"}
                </Button>
              </form>
            )}
          </Reveal>
        </div>

        <ProductPreview />
      </main>

      {/* FOOTER */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border px-6 py-6 md:flex-row md:px-10">
        <div className="flex items-center gap-2">
          <BirdyAvatar size={24} paused />
          <span className="text-sm font-semibold">Birdy</span>
        </div>
        <p className="text-sm text-muted-foreground">Built by agency owners, for agency owners.</p>
      </footer>
    </div>
  );
}
