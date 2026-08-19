import { Poppins, Inter } from "next/font/google";

// The Birdy design system specs Poppins for headings/numerals and Inter for
// body/meta, against an app that otherwise runs on Outfit. Both are declared
// here as CSS variables and applied to a screen's subtree only, so the rest of
// Birdy keeps its own typeface and neither font is a global cost.
//
// Two screens draw from this now — the Portfolio Dashboard and the Sales Hub —
// so it sits in lib rather than inside either route. next/font dedupes by
// declaration site, so one module means one font load shared between them.
export const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Applied to a screen's root: scopes both families and sets Inter as the base. */
export const pdFontClass = `${poppins.variable} ${inter.variable} font-pd-body`;
