import localFont from "next/font/local";

// Poppins for the redesign's headings and figures. Self-hosted like the fonts
// in pd-fonts.js (Google's loader broke production builds on 2026-11-12).
//
// The root layout puts the variable on <html> beside the fonts from
// pd-fonts.js, so portalled menus and dialogs resolve it too.
//
// Files: the latin 500, 600 and 700 cuts from @fontsource/poppins 5.3.0 (OFL-1.1).
// 700 is for the page greeting only, which the reference sets a step heavier than headings.
export const poppins = localFont({
  src: [
    { path: "../fonts/poppins-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/poppins-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
