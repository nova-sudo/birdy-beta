"use client"

import { Suspense } from "react"
import { Skeleton } from "@/components/by"
import { AuthLayout, LegalLinks } from "@/components/auth/auth-layout"
import LoginForm from "./LoginForm"

// The form reads ?redirect= through useSearchParams, which needs a Suspense
// boundary; this is what shows for the moment before it resolves.
function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-7 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="mt-4 h-9 w-full rounded-by-md" />
      <Skeleton className="h-9 w-full rounded-by-md" />
      <Skeleton className="h-10 w-full rounded-by-md" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthLayout legal={<LegalLinks />}>
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  )
}
