import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's stock scales. Left alone it cannot tell
// that `text-by-body` is a size and `text-by-muted` is a colour, so it would
// treat them as the same kind of class and drop the first. Registering the
// by- names keeps both, and still lets a caller's `rounded-by-lg` replace a
// component's `rounded-by-md`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["by-label", "by-caption", "by-body-sm", "by-body", "by-body-lg", "by-heading", "by-title", "by-display"],
      radius: ["by-sm", "by-md", "by-lg", "by-xl"],
      shadow: ["by-card", "by-raised", "by-floating", "by-primary", "by-primary-hover", "by-field"],
      font: ["by-display", "by-body"],
      ease: ["by-out", "by-spring"],
    },
  },
});

/** Join class names, letting later by- utilities override earlier ones of the same kind. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
