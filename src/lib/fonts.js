import { Outfit, Geist_Mono } from "next/font/google";

// Birdy's type: Outfit for everything (figures get tabular-nums via the .num
// utility), Geist Mono for code and tabular readouts. Both are declared as CSS
// variables and put on <html> by the root layout, so every surface — portalled
// dialogs, toasts and drawers included — resolves them. next/font dedupes by
// declaration site, so one module means one load however many places import it.
export const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Both font variables, for the root element. */
export const fontVariables = `${outfit.variable} ${geistMono.variable}`;
