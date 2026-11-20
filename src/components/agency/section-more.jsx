"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger, PILL_EXTRA, cn } from "@/components/by";
import { MORE_PAGES, sectionTabHref } from "@/components/agency/tabs";

/**
 * "More" at the end of a section's tab pill: the section's pages that are not one of the four tabs.
 * While one of them is open the button wears that page's name and the pill's chip, as in the reference.
 * Links keep the client and date range the address carries, so it works inside a client too.
 *
 * @param {import("./sections").SectionConfig} props.section
 * @param {string} props.tab the page open now
 */
export function SectionMore({ section, tab }) {
  const search = useSearchParams();
  const current = MORE_PAGES.find((p) => p.value === tab) ?? null;
  return (
    <Menu>
      <MenuTrigger
        className={cn(PILL_EXTRA, "pr-2.5 data-[state=open]:text-by-text [&[data-state=open]>svg]:rotate-180 [&>svg]:transition-transform [&>svg]:duration-(--by-dur-fast) motion-reduce:[&>svg]:transition-none", current && "text-by-text")}
        data-pill-current={current ? "" : undefined}
        aria-current={current ? "page" : undefined}
      >
        {current?.label ?? "More"}
        <ChevronDown aria-hidden="true" />
      </MenuTrigger>
      <MenuContent align="end" aria-label="More pages" className="min-w-[230px]">
        {MORE_PAGES.map((page) => {
          const on = page.value === tab;
          return (
            <MenuItem key={page.value} asChild selected={on}>
              <Link href={sectionTabHref(section, page.value, search)} aria-current={on ? "page" : undefined}>
                {page.label}
                {on && <Check aria-hidden="true" className="ml-auto" />}
              </Link>
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
