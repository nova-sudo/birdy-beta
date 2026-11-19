import localFont from "next/font/local";

// Poppins for the redesign's headings and figures. Self-hosted like the fonts
// in pd-fonts.js (Google's loader broke production builds on 2026-11-12).
//
// The root layout puts the variable on <html> beside the fonts from
// pd-fonts.js, so portalled menus and dialogs resolve it too.
//
// Files: the latin 500 and 600 cuts from @fontsource/poppins 5.3.0 (OFL-1.1).
export const poppins = localFont({
  src: [
    { path: "../fonts/poppins-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
