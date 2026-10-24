"use client"

import dynamic from "next/dynamic"
import { BIRDY_PRIMARY } from "@/lib/brand-colors"

// Silk is the WebGL wallpaper in the right-hand panel — decoration, and 877kB
// of three.js to draw it. Loaded eagerly it was the single heaviest thing on
// the page people see before they can do anything at all, and it blocked the
// form behind it.
//
// ssr:false because it needs a GL context, and no placeholder: the panel keeps
// its brand background underneath, so the wallpaper fades in a moment later
// and nothing shifts.
const Silk = dynamic(() => import("@/components/Silk"), { ssr: false })

/**
 * The brand panel beside the login and register forms.
 *
 * @param {object} props
 * @param {React.ReactNode} props.headline
 * @param {React.ReactNode} props.sub
 */
export default function AuthSilkPanel({ headline, sub }) {
  return (
    <div data-ds="auth-silk-panel" className="relative h-full p-4">
      <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-primary">
        <Silk speed={5} scale={1} color={BIRDY_PRIMARY} noiseIntensity={1.5} rotation={0} />
        <div className="pointer-events-none absolute inset-0 text-primary-foreground">
          {/* Top-left: wordmark */}
          <div className="absolute left-8 top-8">
            <span className="text-xl font-semibold text-primary-foreground">Birdy</span>
          </div>

          {/* Centered hero */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">{headline}</h2>
            <p className="mt-5 max-w-md text-base text-primary-foreground/85">{sub}</p>
          </div>

          {/* Bottom-left */}
          <span className="absolute bottom-10 left-8 max-w-xs text-sm text-primary-foreground/75">
            Built for teams that move fast and close faster.
          </span>

          {/* Bottom-right */}
          <span className="absolute bottom-10 right-10 text-sm text-primary-foreground/75">
            © Birdy 2026
          </span>
        </div>
      </div>
    </div>
  )
}
