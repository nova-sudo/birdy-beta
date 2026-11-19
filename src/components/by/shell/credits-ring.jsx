import { cn } from "../cn";

const R = 11;
const C = 2 * Math.PI * R;

/**
 * How much of the plan's credits are left, as a ring.
 * @param {number} props.left credits remaining
 * @param {number} props.percent 0 to 100, share remaining
 */
export function CreditsRing({ left, percent, className, ...props }) {
  const share = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <svg
      viewBox="0 0 28 28"
      role="img"
      aria-label={`${left.toLocaleString("en-GB")} credits left, ${Math.round(percent)}%`}
      className={cn("size-7", className)}
      {...props}
    >
      <circle cx="14" cy="14" r={R} fill="none" strokeWidth="3" className="stroke-by-line" />
      <circle
        cx="14" cy="14" r={R} fill="none" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${share * C} ${C}`} transform="rotate(-90 14 14)" className="stroke-by-accent"
      />
    </svg>
  );
}
