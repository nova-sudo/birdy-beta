import { Section, Sub } from "./kit-parts";
import { ControlsSection } from "./sections/controls";
import { DisplaySection } from "./sections/display";
import { AgentsSection } from "./sections/agents";

// The token reference: every value in src/styles/tokens.css, drawn with the
// utilities components will use. Raw ramps are shown with inline styles
// because only the token file may name them.

const SURFACES = [
  ["canvas", "bg-by-canvas"],
  ["surface", "bg-by-surface"],
  ["sunken", "bg-by-sunken"],
  ["rail", "bg-by-rail"],
];
const TEXT = [
  ["text", "text-by-text"],
  ["text-2", "text-by-text-2"],
  ["muted", "text-by-muted"],
];
const ACCENT = [
  ["accent", "bg-by-accent"],
  ["accent-hover", "bg-by-accent-hover"],
  ["accent-soft", "bg-by-accent-soft"],
  ["accent-soft-hover", "bg-by-accent-soft-hover"],
  ["accent-line", "bg-by-accent-line"],
];
const LINES = [
  ["line-soft", "border-by-line-soft"],
  ["line", "border-by-line"],
  ["line-strong", "border-by-line-strong"],
];
const STATUS = [
  ["Danger", "bg-by-danger-bg text-by-danger", "bg-by-danger-solid"],
  ["Warning", "bg-by-warning-bg text-by-warning", "bg-by-warning-solid"],
  ["Success", "bg-by-success-bg text-by-success", "bg-by-success-solid"],
];
const SECTIONS = [
  ["Agency Ops", "bg-by-ops-bg text-by-ops", "bg-by-ops"],
  ["Media Buyer", "bg-by-buyer-bg text-by-buyer", "bg-by-buyer"],
  ["Sales Coach", "bg-by-coach-bg text-by-coach", "bg-by-coach"],
  ["Clients", "bg-by-clients-bg text-by-clients", "bg-by-clients"],
];
const GREYS = [0, 50, 75, 100, 200, 300, 400, 500, 600, 700, 900];
const PURPLES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const TYPE = [
  ["display", "32", "font-by-display text-by-display font-semibold", "£2,888"],
  ["title", "24", "font-by-display text-by-title font-semibold", "Media Buyer"],
  ["heading", "18", "font-by-display text-by-heading font-semibold", "Closes halved in the last 7 days"],
  ["body-lg", "15", "text-by-body-lg", "Only 29% of leads got a call, down 9 pts."],
  ["body", "14", "text-by-body", "Pause “HIFU - Half Cut”"],
  ["body-sm", "13", "text-by-body-sm text-by-text-2", "Your entire agency"],
  ["caption", "12", "text-by-caption font-semibold", "At risk · 3 changes"],
  ["label", "11", "text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted", "Client  Status  CPL"],
];
const CORNERS = [
  ["sm", "6", "rounded-tl-by-sm", "Pills, chips, tooltips"],
  ["md", "8", "rounded-tl-by-md", "Buttons, fields, menu rows"],
  ["lg", "12", "rounded-tl-by-lg", "Cards, rail tiles, popovers"],
  ["xl", "16", "rounded-tl-by-xl", "The ask bar"],
];
const SHADOWS = [
  ["card", "shadow-by-card border border-by-line", "Cards, KPI tiles"],
  ["raised", "shadow-by-raised", "Tab chip, secondary buttons"],
  ["floating", "shadow-by-floating", "Popovers, tooltips, ask bar"],
];

function Swatch({ name, className, style }) {
  return (
    <div className="min-w-0">
      <div className={`h-12 rounded-by-md border border-by-line ${className ?? ""}`} style={style} />
      <div className="mt-1.5 truncate text-by-caption text-by-text-2">{name}</div>
    </div>
  );
}

export default function KitTokensPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-7 py-10">
      <h1 className="font-by-display text-by-display font-semibold tracking-[-0.01em]">Birdy kit</h1>
      <p className="mt-2 max-w-[640px] text-by-body-lg text-by-text-2">
        The redesign&apos;s tokens. Every component in the kit is built from these and nothing else.
      </p>

      <Section title="Colour">
        <Sub title="Surfaces">
          <div className="grid grid-cols-4 gap-3">
            {SURFACES.map(([name, cls]) => <Swatch key={name} name={name} className={cls} />)}
          </div>
        </Sub>
        <Sub title="Text">
          <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-by-lg border border-by-line bg-by-surface p-4">
            {TEXT.map(([name, cls]) => (
              <span key={name} className={`text-by-body-lg ${cls}`}>{name} · Beauty Hub MCR</span>
            ))}
            <span className="rounded-by-sm bg-by-accent px-2 text-by-body-lg text-by-on-accent">on-accent</span>
          </div>
        </Sub>
        <Sub title="Accent">
          <div className="grid grid-cols-5 gap-3">
            {ACCENT.map(([name, cls]) => <Swatch key={name} name={name} className={cls} />)}
          </div>
        </Sub>
        <Sub title="Borders">
          <div className="grid grid-cols-3 gap-3">
            {LINES.map(([name, cls]) => (
              <div key={name} className={`rounded-by-md border-2 bg-by-surface px-3 py-2.5 text-by-caption text-by-text-2 ${cls}`}>{name}</div>
            ))}
          </div>
        </Sub>
        <Sub title="Status">
          <div className="flex flex-wrap gap-3">
            {STATUS.map(([name, soft, solid]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`rounded-by-sm px-2 py-0.5 text-by-caption font-semibold ${soft}`}>{name}</span>
                <span className={`size-4 rounded-full ${solid}`} title={`${name} solid`} />
              </div>
            ))}
          </div>
        </Sub>
        <Sub title="Sections">
          <div className="flex flex-wrap gap-3">
            {SECTIONS.map(([name, soft, solid]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`grid size-10 place-items-center rounded-by-lg text-by-caption font-semibold ${soft}`}>{name[0]}</span>
                <span className={`grid size-10 place-items-center rounded-by-lg text-by-caption font-semibold text-by-on-accent ${solid}`}>{name[0]}</span>
                <span className="text-by-body-sm text-by-text-2">{name}</span>
              </div>
            ))}
          </div>
        </Sub>
        <Sub title="Raw ramps (the token file only)">
          <div className="flex overflow-hidden rounded-by-md border border-by-line">
            {GREYS.map((n) => <div key={n} className="h-9 flex-1" style={{ background: `var(--by-grey-${n})` }} title={`grey ${n}`} />)}
          </div>
          <div className="mt-2 flex overflow-hidden rounded-by-md border border-by-line">
            {PURPLES.map((n) => <div key={n} className="h-9 flex-1" style={{ background: `var(--by-purple-${n})` }} title={`purple ${n}`} />)}
          </div>
        </Sub>
      </Section>

      <Section title="Type">
        <div className="rounded-by-lg border border-by-line bg-by-surface px-5 py-2 shadow-by-card">
          {TYPE.map(([name, px, cls, sample]) => (
            <div key={name} className="flex items-baseline gap-4 border-b border-by-line-soft py-2.5 last:border-b-0">
              <span className="w-24 shrink-0 text-by-caption text-by-muted">{name} · {px}</span>
              <span className={`min-w-0 truncate ${cls}`}>{sample}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-by-caption text-by-muted">
          Poppins for display, title and heading. Inter for the rest. Weights 400, 500 and 600.
        </p>
      </Section>

      <Section title="Corners and shadows">
        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-wrap gap-5">
            {CORNERS.map(([name, px, cls, use]) => (
              <div key={name} className="w-28">
                <div className={`size-14 border-l-2 border-t-2 border-by-accent bg-by-accent-soft ${cls}`} />
                <div className="mt-1.5 text-by-caption font-semibold">{name} · {px}</div>
                <div className="text-by-caption text-by-muted">{use}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-5">
            {SHADOWS.map(([name, cls, use]) => (
              <div key={name} className="w-40">
                <div className={`grid h-16 place-items-center rounded-by-lg bg-by-surface text-by-caption font-semibold ${cls}`}>{name}</div>
                <div className="mt-2 text-by-caption text-by-muted">{use}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Motion">
        <p className="mb-3 text-by-body-sm text-by-text-2">Hover each tile. Colour changes are fast; movement uses the spring curve.</p>
        <div className="flex flex-wrap gap-4">
          <div className="grid h-16 w-44 place-items-center rounded-by-lg border border-by-line bg-by-surface text-by-caption font-semibold transition-colors duration-(--by-dur-fast) ease-by-out hover:bg-by-accent-soft hover:text-by-accent">
            fast · 160ms · ease-out
          </div>
          <div className="grid h-16 w-44 place-items-center rounded-by-lg border border-by-line bg-by-surface text-by-caption font-semibold transition-transform duration-(--by-dur-press) ease-by-spring motion-safe:hover:-translate-y-1">
            press · 260ms · spring
          </div>
          <div className="grid h-16 w-44 place-items-center rounded-by-lg border border-by-line bg-by-surface text-by-caption font-semibold transition-transform duration-(--by-dur-tab) ease-by-spring motion-safe:hover:translate-x-3">
            tab · 460ms · spring
          </div>
        </div>
      </Section>

      <ControlsSection />
      <DisplaySection />
      <AgentsSection />
    </main>
  );
}
