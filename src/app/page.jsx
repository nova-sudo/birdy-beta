"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { publicRequest } from "@/lib/api";

// Remembers the joined email locally so a returning visitor sees the
// "already on the list" state instead of re-submitting the form.
const WAITLIST_STORAGE_KEY = "birdy_waitlist_email";

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
    <div className="min-h-screen w-full bg-[#F9F8FC] text-[#180F29] flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-[#ECE7F3]">
        <div className="flex items-center gap-2">
          <Image
            src="/birdy-mascot-VmH3J7Wq.png"
            alt="Birdy"
            width={32}
            height={32}
            priority
            className="rounded-full"
          />
          <span className="font-bold text-lg">AskBirdy</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#71658B] bg-white border border-[#E6E1EF] rounded-full px-4 py-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          Coming Soon
        </span>
      </header>

      {/* HERO */}
      <main className="flex-1 flex flex-col items-center px-6 pt-10 md:pt-16 pb-24">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            The AI Brain That Runs &amp; Scales Your Agency
          </h1>
          <p className="mt-6 text-lg md:text-xl text-[#71658B] max-w-2xl mx-auto">
            AskBirdy connects your ads, CRM, bookings, and revenue data across all clients,
            flags problems early, and guides what to fix or scale next.
          </p>

          <div className="mt-8 min-h-[44px] flex items-center justify-center">
            {status === "joined" || status === "already" ? (
              <div className="text-center">
                {status === "joined" ? (
                  <>
                    <p className="text-lg font-semibold">Boom... You&apos;re on the List! 🎉</p>
                    <p className="text-sm text-[#71658B] mt-1">
                      You&apos;re one step closer to running a stress-free agency
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">Hey... You&apos;re Already on the List! 😉</p>
                    <p className="text-sm text-[#71658B] mt-1">
                      We&apos;ll get you onboarded as quick as possible.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-64 h-11 rounded-xl border-[#E6E1EF] bg-white"
                />
                <Button
                  type="submit"
                  disabled={status === "loading"}
                  className="bg-[#713CDD] hover:bg-[#5f30ba] text-white rounded-xl h-11 px-6 font-medium"
                >
                  {status === "loading" ? "Joining..." : "Join the Waitlist"}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* DEMO PLACEHOLDER */}
        <div className="mt-16 w-full max-w-4xl min-h-[420px] bg-white border border-[#E6E1EF] rounded-2xl shadow-xl flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16   flex items-center justify-center overflow-hidden">
            <Image src="/birdy-mascot-VmH3J7Wq.png" alt="Birdy" width={56} height={56} className="" />
          </div>
          <p className="text-[#71658B] font-medium">Product Demo Coming Soon</p>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#ECE7F3] px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image src="/birdy-mascot-VmH3J7Wq.png" alt="Birdy" width={20} height={20} className="rounded-full" />
          <span className="font-semibold text-sm">AskBirdy</span>
        </div>
        <p className="text-sm text-[#71658B]">Built by agency owners, for agency owners.</p>
      </footer>
    </div>
  );
}
