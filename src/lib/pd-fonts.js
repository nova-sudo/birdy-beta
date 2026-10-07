import { Bricolage_Grotesque, Inter } from "next/font/google";

// Birdy's type: Bricolage Grotesque for headings and numerals, Inter for body
// and meta. Both are declared as CSS variables and put on <html> by the root
// layout, so every surface — portalled dialogs, toasts and drawers included —
// resolves them. next/font dedupes by declaration site, so one module means
// one load however many places import it.
export const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // Variable font: the optical-size axis lets big headings tighten up and
  // small labels open out, which is most of what gives Bricolage its shape.
  axes: ["opsz"],
  display: "swap",
});

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Both font variables, for the root element. */
export const fontVariables = `${display.variable} ${inter.variable}`;

/**
 * Once applied to a screen's subtree to scope the fonts there. The variables
 * now live on <html>, so this only sets Inter as the base; screens still
 * carrying it are harmless.
 */
export const pdFontClass = "font-pd-body";
