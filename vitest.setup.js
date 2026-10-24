import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// next/font is a compiler transform; outside Next the loaders do not exist.
// Stub them so anything that imports lib/fonts loads in tests.
vi.mock("next/font/google", () => {
  const loader = () => ({ className: "font-stub", variable: "--font-stub", style: {} })
  return { Outfit: loader, Geist_Mono: loader }
})

// jsdom has no matchMedia; the mascot and framer-motion ask it about
// prefers-reduced-motion. Answer "no preference" everywhere.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
