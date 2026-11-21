"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SectionHeader, cn } from "@/components/by";
import { AskDock, PAGE, scopedSubtitle, useSectionChat } from "@/components/agency/section-parts";
import { SectionMore } from "@/components/agency/section-more";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { useClientGroups } from "@/lib/useClientGroups";

/**
 * A "More" page of a section (Reports, Projections): the section's header with the tab pill and More,
 * the page in a centred column, and the ask bar at its foot, as on Context.
 *
 * @param {import("./sections").SectionConfig} props.section
 * @param {string} props.tab the More page open ("reports", "projections")
 * @param {string} props.placeholder the ask bar's prompt
 * @param {(group: object|null) => React.ReactNode} props.children the page, given the client the address narrows it to
 * @param {string} [props.width] the column's max width class
 */
export function SectionPage({ section, tab, placeholder, width = "max-w-[820px]", children }) {
  const router = useRouter();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const clientId = search.get("client") || null;
  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const group = clientId ? clientGroups.find((g) => g.id === clientId) ?? null : null;
  const chat = useSectionChat(section, `ask_${tab}`, group);
  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        subtitle={scopedSubtitle(group)}
        tabs={tabs}
        tab={tab}
        more={<SectionMore section={section} tab={tab} />}
        onTabChange={(value) => router.push(sectionTabHref(section, value, search))}
      />
      <AskDock section={section} chat={chat} placeholder={placeholder}>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-8 pb-28 sm:px-7">
          <div className={cn("mx-auto flex flex-col gap-[18px]", width)}>{children(group)}</div>
        </div>
      </AskDock>
    </div>
  );
}

/** "Reports › Morning report": the way back to the list from one report. */
export function Crumbs({ parts }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 px-0.5 text-by-body-sm text-by-muted">
      {parts.map((p, i) => (
        <span key={p.label} className="inline-flex items-center gap-1.5">
          {i > 0 && <ChevronRight aria-hidden="true" className="size-3" />}
          {p.href ? (
            <Link href={p.href} className="rounded-by-sm transition-colors duration-(--by-dur-fast) hover:text-by-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">{p.label}</Link>
          ) : (
            <span aria-current="page" className="font-semibold text-by-text-2">{p.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** A page's title and the line under it. */
export function PageTitle({ title, children, aside }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h2 className="font-by-display text-[length:1.5rem] leading-[1.2] font-bold tracking-[-0.01em] text-by-text">{title}</h2>
        {children && <p className="mt-1 text-by-body text-by-text-2 text-pretty">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

/** One "Label  value" line of a definition list, the reference's Schedule card. */
export function Fact({ label, children }) {
  return (
    <>
      <dt className="text-by-muted">{label}</dt>
      <dd className="min-w-0 text-by-text">{children}</dd>
    </>
  );
}

/** A titled section inside a report's card; sections after the first are ruled off. */
export function CardSection({ title, aside, children }) {
  return (
    <section className="px-5 py-4 [&+&]:border-t [&+&]:border-by-line">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h3 className="font-by-display text-by-body-lg font-semibold">{title}</h3>
        {aside && <span className="text-by-body-sm text-by-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** The Schedule card's list. */
export function Facts({ children }) {
  return <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-by-body">{children}</dl>;
}
