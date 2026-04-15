"use client"

import { Suspense } from "react"
import LoginForm from "./LoginForm"
import Silk from "@/components/Silk"
import BirdyLogo from "@/components/BirdyLogo"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Suspense
              fallback={
                <div className="shadow-md border bg-white rounded-lg p-8">
                  <div className="animate-pulse space-y-4">
                    <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto" />
                    <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                  </div>
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
            color="#7C3AED"
            noiseIntensity={1.5}
            rotation={0}
          />
          <div className="pointer-events-none absolute inset-0 text-white">
            {/* Top-left: Birdy lockup */}
            <div className="absolute left-8 top-8">
              <BirdyLogo variant="lockup" theme="dark" size={100} />
            </div>

            {/* Centered hero */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <h2 className="text-6xl font-semibold tracking-tight drop-shadow-lg">
                Welcome to Birdy
              </h2>
              <p className="mt-5 max-w-lg text-2xl text-white/90 drop-shadow-md">
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
