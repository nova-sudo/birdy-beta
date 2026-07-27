import { Sparkles, Wand2, Wrench } from "lucide-react";
import { RELEASES, APP_VERSION } from "@/lib/changelog";

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
    dot: "bg-purple-500",
    chip: "text-purple-700 bg-purple-50 ring-1 ring-purple-100",
  },
  {
    key: "improved",
    label: "Improved",
    Icon: Wand2,
    dot: "bg-blue-500",
    chip: "text-blue-700 bg-blue-50 ring-1 ring-blue-100",
  },
  {
    key: "fixed",
    label: "Fixed",
    Icon: Wrench,
    dot: "bg-amber-500",
    chip: "text-amber-700 bg-amber-50 ring-1 ring-amber-100",
  },
];

function CategoryBlock({ category, items }) {
  if (!items || items.length === 0) return null;
  const { label, Icon, dot, chip } = category;
  return (
    <div className="mt-4 first:mt-0">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${chip}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <ul className="mt-2.5 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-700">
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
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-100">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Currently on {APP_VERSION}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          What&apos;s new in Birdy
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Every notable change, grouped by release. Newest first.
        </p>
      </header>

      {/* Release timeline */}
      <div className="relative">
        {/* vertical rail (hidden on small screens for a cleaner stack) */}
        <div
          className="absolute left-[7px] top-2 bottom-2 hidden w-px bg-gray-200 sm:block"
          aria-hidden="true"
        />

        <ol className="space-y-10">
          {RELEASES.map((release) => (
            <li key={release.version} className="relative sm:pl-10">
              {/* timeline node */}
              <span
                className="absolute left-0 top-1.5 hidden h-[15px] w-[15px] rounded-full border-2 border-white bg-purple-500 ring-1 ring-purple-200 sm:block"
                aria-hidden="true"
              />

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-bold text-gray-900">{release.version}</h2>
                  <time dateTime={release.date} className="text-sm font-medium text-gray-400">
                    {formatDate(release.date)}
                  </time>
                </div>
                {release.summary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
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
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
