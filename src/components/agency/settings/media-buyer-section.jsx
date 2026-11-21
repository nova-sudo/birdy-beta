"use client";

// Settings › Media Buyer: the Media Buying Analyst in Birdy's chats
// (/api/capabilities) and how strict Birdy is when it flags ads
// (/api/dashboard/settings). The agent's own settings (modes, schedule,
// clients and targets, Slack) open from here on its page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Card, OptionCard, Switch, buttonVariants } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { STRICTNESS_OPTIONS, strictnessLabel } from "@/lib/strictness";

function Strictness() {
  const [value, setValue] = useState("balanced");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest("/api/dashboard/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.strictness) setValue(data.strictness);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const change = async (next) => {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await apiRequest("/api/dashboard/settings", { method: "PUT", body: JSON.stringify({ strictness: next }) });
      if (!res.ok) throw new Error("Failed to save strictness");
      toast.success(`Suggestions set to ${strictnessLabel(next)}`, { description: "Birdy's next suggestion pass will use it." });
    } catch {
      setValue(previous);
      toast.error("Couldn't update strictness", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 border-t border-by-line-soft pt-4">
      <h4 id="strictness-h" className="text-by-body font-semibold">How strict should Birdy be when flagging ads?</h4>
      <div role="radiogroup" aria-labelledby="strictness-h" aria-busy={saving || undefined} className="grid gap-2 min-[900px]:grid-cols-3">
        {STRICTNESS_OPTIONS.map((o) => (
          <OptionCard key={o.value} selected={value === o.value} disabled={!loaded || saving} title={o.label} subtitle={o.detail} onSelect={() => change(o.value)} className="items-start" />
        ))}
      </div>
      <p className="text-by-caption text-by-muted">Applies to the weekly and monthly ad suggestions on your dashboard and in Slack. Amounts are in your account currency.</p>
    </div>
  );
}

function Analyst() {
  const [on, setOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest("/api/capabilities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOn(!!data.media_buying);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Optimistic, put back if the save fails; the server's answer is the truth.
  const toggle = async (next) => {
    const previous = on;
    setOn(next);
    setSaving(true);
    try {
      const res = await apiRequest("/api/capabilities", { method: "PUT", body: JSON.stringify({ media_buying: next }) });
      if (!res.ok) throw new Error("Failed to save capability");
      const data = await res.json();
      setOn(!!data.media_buying);
      toast.success(next ? "Capability enabled" : "Capability disabled", { description: "New Birdy chats will use this setting." });
    } catch {
      setOn(previous);
      toast.error("Couldn't update capability", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padded className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-by-display text-by-body-lg font-bold">Media Buying Analyst</h3>
          <p className="mt-1 max-w-[46rem] text-by-body-sm text-by-text-2">
            Adds senior media-buyer reasoning to Birdy chat. It diagnoses CPL, CTR, CPM and ROAS across campaigns, ad sets and ads, judges lead quality through GoHighLevel, and recommends what to scale, kill and fix. Takes effect on your next Birdy conversation.
          </p>
        </div>
        <Switch checked={on} onCheckedChange={toggle} disabled={!loaded || saving} aria-label="Media Buying Analyst" className="mt-1" />
      </div>
      {loaded && on && <Strictness />}
    </Card>
  );
}

export function MediaBuyerSection() {
  return (
    <>
      <Analyst />
      <Card padded className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-by-display text-by-body-lg font-bold">The Media Buying Agent</h3>
          <p className="mt-1 text-by-body-sm text-by-text-2">What it can change on its own, when it checks, each client’s targets, and where its cards go in Slack.</p>
        </div>
        <Link href="/hub/agents/media-buying?tab=settings" className={buttonVariants()}>
          Open its settings<ArrowRight aria-hidden="true" />
        </Link>
      </Card>
    </>
  );
}
