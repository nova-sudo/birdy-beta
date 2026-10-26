import { Sparkles, Wand2, Wrench } from "lucide-react";
import { RELEASES, APP_VERSION } from "@/lib/changelog";
import { Badge, Surface } from "@/components/ds";
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
    dot: "bg-primary",
    tone: "primary",
  },
  {
    key: "improved",
    label: "Improved",
    Icon: Wand2,
    dot: "bg-info",
    tone: "info",
  },
  {
    key: "fixed",
    label: "Fixed",
    Icon: Wrench,
    dot: "bg-warning",
    tone: "warning",
  },
];

function CategoryBlock({ category, items }) {
  if (!items || items.length === 0) return null;
  const { label, Icon, dot, tone } = category;
  return (
    <div className="mt-4 first:mt-0">
      <Badge tone={tone}>
        <Icon aria-hidden="true" />
        {label}
      </Badge>
      <ul className="mt-2.5 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-body">
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
        <Badge tone="primary" className="mb-2">
          <Sparkles aria-hidden="true" />
          Currently on {APP_VERSION}
        </Badge>
        <h1 className="text-title-sm font-semibold tracking-[-0.02em] text-balance text-foreground md:text-title">
          What&apos;s new in Birdy
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every notable change, grouped by release. Newest first.
        </p>
      </header>

      {/* Release timeline */}
      <div className="relative">
        {/* vertical rail (hidden on small screens for a cleaner stack) */}
        <div
          className="absolute left-[7px] top-2 bottom-2 hidden w-px bg-border sm:block"
          aria-hidden="true"
        />

        <Stagger as="ol" gap={0.05} className="space-y-10">
          {RELEASES.map((release) => (
            <StaggerItem as="li" key={release.version} className="relative sm:pl-10">
              {/* timeline node */}
              <span
                className="absolute left-0 top-1.5 hidden h-[15px] w-[15px] rounded-full border-2 border-background bg-primary ring-1 ring-primary/35 sm:block"
                aria-hidden="true"
              />

              <Surface className="p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold text-foreground">{release.version}</h2>
                  <time dateTime={release.date} className="text-sm text-muted-foreground">
                    {formatDate(release.date)}
                  </time>
                </div>
                {release.summary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-body">
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
              </Surface>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
