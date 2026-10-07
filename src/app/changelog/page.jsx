import { Sparkles, Wand2, Wrench } from "lucide-react";
import { RELEASES, APP_VERSION } from "@/lib/changelog";
import { Stagger, StaggerItem } from "@/components/motion";

// Deterministic date formatting so server and client render identically
// (avoids locale-driven hydration mismatches).
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// One config per change category: same icon + color everywhere it appears.
const CATEGORIES = [
  {
    key: "added",
    label: "New",
    Icon: Sparkles,
    dot: "bg-pd-primary",
    chip: "bg-pd-primary text-white",
  },
  {
    key: "improved",
    label: "Improved",
    Icon: Wand2,
    dot: "bg-pd-info",
    chip: "bg-pd-info text-white",
  },
  {
    key: "fixed",
    label: "Fixed",
    Icon: Wrench,
    dot: "bg-pd-amber",
    chip: "bg-pd-amber text-white",
  },
];

function CategoryBlock({ category, items }) {
  if (!items || items.length === 0) return null;
  const { label, Icon, dot, chip } = category;
  return (
    <div className="mt-4 first:mt-0">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <ul className="mt-2.5 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-pd-body">
            <span
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Page header */}
      <header className="mb-10">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-pd-primary px-3 py-1 text-[11px] font-bold text-white">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Currently on {APP_VERSION}
        </div>
        <h1 className="font-pd-display text-2xl font-bold tracking-tight text-pd-ink sm:text-3xl">
          What&apos;s new in Birdy
        </h1>
        <p className="mt-1.5 text-sm text-pd-subtle">
          Every notable change, grouped by release. Newest first.
        </p>
      </header>

      {/* Release timeline */}
      <div className="relative">
        {/* vertical rail (hidden on small screens for a cleaner stack) */}
        <div
          className="absolute left-[7px] top-2 bottom-2 hidden w-px bg-pd-border sm:block"
          aria-hidden="true"
        />

        <Stagger as="ol" gap={0.05} className="space-y-10">
          {RELEASES.map((release) => (
            <StaggerItem as="li" key={release.version} className="relative sm:pl-10">
              {/* timeline node */}
              <span
                className="absolute left-0 top-1.5 hidden h-[15px] w-[15px] rounded-full border-2 border-pd-surface bg-pd-primary ring-1 ring-pd-primary-pale sm:block"
                aria-hidden="true"
              />

              <div className="rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-pd-display text-lg font-bold text-pd-ink">{release.version}</h2>
                  <time dateTime={release.date} className="text-sm font-medium text-pd-faint">
                    {formatDate(release.date)}
                  </time>
                </div>
                {release.summary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-pd-body">
                    {release.summary}
                  </p>
                )}

                <div className="mt-4">
                  {CATEGORIES.map((category) => (
                    <CategoryBlock
                      key={category.key}
                      category={category}
                      items={release.changes[category.key]}
                    />
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
