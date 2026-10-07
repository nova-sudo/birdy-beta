"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
// Silk is the WebGL wallpaper in the right-hand panel — decoration, and 877kB
// of three.js to draw it. Loaded eagerly it was the single heaviest thing on
// the page people see before they can do anything at all, and it blocked the
// form behind it.
//
// ssr:false because it needs a GL context, and no placeholder: the panel keeps
// its brand background underneath, so the wallpaper fades in a moment later
// and nothing shifts.
const Silk = dynamic(() => import("@/components/Silk"), { ssr: false })
import LoginForm from "./LoginForm"
import { Skeleton } from "@/components/ui/skeleton"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh bg-pd-surface lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Suspense
              fallback={
                <div className="space-y-4">
                  <Skeleton className="size-[52px] rounded-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-6 h-12 w-full rounded-full" />
                  <Skeleton className="h-12 w-full rounded-full" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block p-4">
        <div className="relative h-full w-full overflow-hidden rounded-3xl">
          <Silk
            speed={5}
            scale={1}
            color="#5B3FD6"
            noiseIntensity={1.5}
            rotation={0}
          />
          <div className="pointer-events-none absolute inset-0 text-white">
            {/* Top-left: wordmark */}
            <div className="absolute left-8 top-8">
              <span className="font-pd-display text-xl font-extrabold text-white drop-shadow">Birdy</span>
            </div>

            {/* Centered hero */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <h2 className="font-pd-display text-[64px] font-extrabold leading-[1] tracking-[-0.035em] drop-shadow-lg">
                Every client.<br />One brain.
              </h2>
              <p className="mt-5 max-w-md text-[19px] leading-relaxed text-white/85 drop-shadow-md">
                Manage your clients, campaigns, and conversations — all in one place.
              </p>
            </div>

            {/* Bottom-left */}
            <span className="absolute bottom-10 left-8 max-w-xs text-sm leading-relaxed text-white/75 drop-shadow">
              Built for teams that move fast and close faster.
            </span>

            {/* Bottom-right */}
            <span className="absolute bottom-10 right-10 text-sm font-medium tracking-wider text-white/80 drop-shadow">
              © Birdy 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
