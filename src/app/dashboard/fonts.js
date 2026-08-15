import { Poppins, Inter } from "next/font/google";

// The handoff specs Poppins for headings/numerals and Inter for body/meta,
// against an app that otherwise runs on Outfit. Both are declared here as CSS
// variables and applied to the Portfolio Dashboard subtree only, so the rest of
// Birdy keeps its own typeface and neither font is a global cost.
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

/** Applied to the page root: scopes both families and sets Inter as the base. */
export const portfolioFontClass = `${poppins.variable} ${inter.variable} font-pd-body`;
