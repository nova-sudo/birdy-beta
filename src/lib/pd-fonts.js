import localFont from "next/font/local";

// Birdy's type: Bricolage Grotesque for headings and numerals, Inter for body
// and meta. Both are declared as CSS variables and put on <html> by the root
// layout, so every surface — portalled dialogs, toasts and drawers included —
// resolves them. next/font dedupes by declaration site, so one module means
// one load however many places import it.
//
// Self-hosted (latin subset of Google's variable files) rather than
// next/font/google: on 2026-11-12 Google started serving font URLs with an
// extra `skey` query parameter that Next 16.0's Turbopack font loader rejects,
// which broke every production build. Local files also make builds offline-safe.
export const display = localFont({
  src: "../fonts/bricolage-grotesque-latin-var.woff2",
  variable: "--font-bricolage",
  // Variable font with wght and the optical-size axis: big headings tighten
  // up and small labels open out, which gives Bricolage its shape.
  weight: "200 800",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const inter = localFont({
  src: "../fonts/inter-latin-var.woff2",
  variable: "--font-inter",
  weight: "400 700",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

/** Both font variables, for the root element. */
export const fontVariables = `${display.variable} ${inter.variable}`;

/**
 * Once applied to a screen's subtree to scope the fonts there. The variables
 * now live on <html>, so this only sets Inter as the base; screens still
 * carrying it are harmless.
 */
export const pdFontClass = "font-pd-body";
