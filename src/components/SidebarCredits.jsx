"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import {
  useSidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCredits } from "@/hooks/useCredits";

const TONES = {
  emerald: { text: "text-emerald-600", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  amber:   { text: "text-amber-600",   bar: "bg-amber-500",   dot: "bg-amber-500" },
  red:     { text: "text-red-600",     bar: "bg-red-500",     dot: "bg-red-500" },
};

/**
 * Bottom-left "credits left" indicator. Expanded: a compact bar + remaining
 * count that links to /credits. Collapsed (icon rail): a coin icon with a
 * status dot and a hover tooltip. Always visible so users can watch the balance
 * fall, per the billing strategy.
 */
export default function SidebarCredits() {
  const { open, isMobile } = useSidebar();
  const expanded = isMobile ? true : open;
  const { loading, balance, allowance, used, remainingAllowance, isOut, low, subscribed } = useCredits();

  const tone = isOut ? "red" : low ? "amber" : "emerald";
  const c = TONES[tone];

  // Bar shows the remaining fraction of the monthly allowance (top-ups keep it
  // full even with the allowance spent).
  const remainingFrac = allowance > 0
    ? Math.max(0, Math.min(1, remainingAllowance / allowance))
    : (balance > 0 ? 1 : 0);
  const barWidth = `${Math.round(remainingFrac * 100)}%`;

  const label = loading
    ? "…"
    : balance.toLocaleString();

  // ── Collapsed rail: icon + status dot + tooltip ──
  if (!expanded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton asChild>
                <Link href="/credits" className="relative">
                  <Coins className={c.text} />
                  <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${c.dot}`} />
                </Link>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent>
              {loading ? "Loading credits…" : `${balance.toLocaleString()} credits left`}
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // ── Expanded: full block ──
  return (
    <div className="px-2 pb-1">
      <Link
        href="/credits"
        className="block rounded-lg border border-gray-100 bg-gray-50/70 px-2.5 py-2 transition hover:bg-gray-100"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
            <Coins className={`h-3.5 w-3.5 ${c.text}`} />
            Credits
          </span>
          <span className={`text-[11px] font-semibold ${c.text}`}>{label}</span>
        </div>

        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: barWidth }} />
        </div>

        <p className={`mt-1 text-[10px] font-medium ${isOut ? "text-red-500" : low ? "text-amber-600" : "text-gray-400"}`}>
          {isOut
            ? "Out — top up"
            : low
              ? "Running low — top up"
              : allowance > 0
                ? `${used.toLocaleString()} / ${allowance.toLocaleString()} used`
                : subscribed
                  ? "Top-up balance"
                  : "No plan — subscribe"}
        </p>
      </Link>
    </div>
  );
}
