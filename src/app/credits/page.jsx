"use client";

import { Coins } from "lucide-react";
import { CreditsPanel } from "@/components/settings/CreditsPanel";

// The page is now just the heading and the frame — the panel below it is
// shared with the Settings Billing tab, which shows the same balance, packs
// and usage chart.
export default function CreditsPage() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Coins className="w-6 h-6 text-purple-600" /> Birdy Credits
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your AI usage this billing period. A credit is about one cent of AI work — a typical
          Ask Birdy question costs a handful.
        </p>
      </div>

      <CreditsPanel />
    </div>
  );
}
