import { cn } from "@/lib/utils";

// A row-sized trend: one polyline, no axes, no verdict. Meant for table cells,
// where a reader scans down a column of them and the shape is the point — the
// figures are in the neighbouring columns.
//
// Deliberately not coloured green or red by where the line ends: the last
// bucket is usually today, half-measured, so every row would end in a dip and
// a column of red lines would be reporting the clock rather than the client.

const W = 64;
const H = 20;
const PAD = 2;

/**
 * @param {number[]} values in time order; fewer than two points draws a dash
 * @param {string} [label] what the series is, for the accessible name
 */
export function Sparkline({ values, label, className }) {
  const series = (values ?? []).filter((v) => Number.isFinite(v));

  if (series.length < 2) {
    return (
      <span className={cn("inline-block text-pd-faint", className)}>
        <span aria-hidden="true">–</span>
        {label && <span className="sr-only">{label}: no trend</span>}
      </span>
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1e-9);
  const step = (W - PAD * 2) / (series.length - 1);
  const points = series
    .map((v, i) => `${(PAD + i * step).toFixed(1)},${(H - PAD - ((v - min) / span) * (H - PAD * 2)).toFixed(1)}`)
    .join(" ");

  const last = series[series.length - 1];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("inline-block shrink-0 align-middle text-pd-primary-light", className)}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label ? `${label} trend` : undefined}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={(PAD + (series.length - 1) * step).toFixed(1)}
        cy={(H - PAD - ((last - min) / span) * (H - PAD * 2)).toFixed(1)}
        r="2"
        fill="var(--pd-primary)"
      />
    </svg>
  );
}
