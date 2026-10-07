import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  // Components pull in plain CSS (the mascot's keyframes); the app's PostCSS
  // config is Tailwind's Next plugin, which Vite can't load here, so give it
  // an empty pipeline rather than letting it search for one.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    css: false,
    globals: true,
    setupFiles: ["./vitest.setup.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
