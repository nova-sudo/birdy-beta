"use client";

// Where a metric comes from: the product's logo (Meta, GoHighLevel,
// HotProspector), Birdy's star, or a quiet icon for tags and formulas. The
// same mark on the tabs, the rows and the formula's chips.

import Image from "next/image";
import { Calculator, Hash, LayoutGrid, Sparkles } from "lucide-react";
import { cn } from "@/components/by";
import { ghlIcon, hpIcon, metaIcon } from "@/lib/icons";
import { SOURCE_NAME } from "@/lib/metrics-catalog";

const LOGO = { meta: metaIcon, ghl: ghlIcon, sales: hpIcon };
const ICON = { birdy: Sparkles, tag: Hash, custom: Calculator, all: LayoutGrid };

/** @param {"all"|"meta"|"ghl"|"sales"|"birdy"|"tag"|"custom"} props.source */
export function SourceMark({ source, className }) {
  const logo = LOGO[source];
  if (logo) return <Image src={logo} alt="" width={14} height={14} className={cn("size-3.5 shrink-0 object-contain", className)} />;
  const Icon = ICON[source] ?? Sparkles;
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", source === "birdy" && "text-by-accent", className)} />;
}

const TONE = {
  meta: "bg-by-buyer-bg text-by-buyer",
  ghl: "bg-by-success-bg text-by-success",
  sales: "bg-by-warning-bg text-by-warning",
  birdy: "bg-by-accent-soft text-by-accent",
  tag: "bg-by-sunken text-by-text-2",
  custom: "bg-by-accent-soft text-by-accent",
};

/** The Source column's pill. */
export function SourcePill({ source }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-by-sm px-2 py-0.5 text-by-caption font-semibold", TONE[source] ?? TONE.birdy)}>
      <SourceMark source={source} />
      {SOURCE_NAME[source] ?? "Birdy"}
    </span>
  );
}
