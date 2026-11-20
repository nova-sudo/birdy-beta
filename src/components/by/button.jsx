import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING, LIFT } from "./motion";

export const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-by-md border border-transparent font-by-body font-semibold",
    "disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
    LIFT,
    FOCUS_RING,
  ),
  {
    variants: {
      kind: {
        // Lifted: a two-stop gradient with a highlight on its top edge and a
        // purple shadow beneath, both deepening on hover.
        primary:
          "bg-linear-to-b from-by-primary-from to-by-primary-to text-by-on-accent shadow-by-primary hover:from-by-primary-from-hover hover:to-by-primary-to-hover hover:shadow-by-primary-hover",
        secondary: "border-by-line bg-by-surface text-by-text shadow-by-raised hover:border-by-line-strong",
        soft: "bg-by-accent-soft text-by-accent hover:bg-by-accent-soft-hover",
        ghost: "text-by-text-2 hover:bg-by-sunken hover:text-by-text",
        danger: "bg-by-danger-bg text-by-danger hover:bg-by-danger-solid hover:text-by-on-accent",
      },
      size: {
        sm: "h-8 px-2.5 text-by-body-sm",
        md: "h-9 px-3.5 text-by-body",
        lg: "h-10 px-4 text-by-body",
      },
      iconOnly: { true: "px-0", false: "" },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", class: "w-8" },
      { iconOnly: true, size: "md", class: "w-9" },
      { iconOnly: true, size: "lg", class: "w-10" },
    ],
    defaultVariants: { kind: "secondary", size: "md", iconOnly: false },
  },
);

/**
 * The kit's button.
 *
 * @param {"primary"|"secondary"|"soft"|"ghost"|"danger"} [props.kind] secondary by default
 * @param {"sm"|"md"|"lg"} [props.size] 32, 36 or 40px nominal
 * @param {boolean} [props.iconOnly] square, for a single icon; give it an `aria-label`
 * @param {boolean} [props.loading] shows a spinner and blocks clicks; the label stays readable
 */
export function Button({ kind, size, iconOnly, loading = false, disabled, className, children, type = "button", ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ kind, size, iconOnly }), loading && "disabled:opacity-100", className)}
      {...props}
    >
      {loading && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
      {iconOnly && loading ? null : children}
    </button>
  );
}
