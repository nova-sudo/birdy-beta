"use client"

import { Toaster as Sonner } from "sonner";

// The app is light-only (no `.dark` tokens in globals.css) and there is no
// next-themes ThemeProvider, so useTheme() used to fall back to "system" and
// render dark toasts against the light app whenever the OS was in dark mode.
// Pin to light, and use richColors so success/error/info carry their proper
// green/red/blue treatment instead of a plain monochrome icon.
const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        }
      }
      {...props} />
  );
}

export { Toaster }
