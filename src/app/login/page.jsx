"use client"

import { Suspense } from "react"
import LoginForm from "./LoginForm"
import AuthLayout from "@/components/auth/AuthLayout"
import { Skeleton } from "@/components/ds"

export default function LoginPage() {
  return (
    <AuthLayout
      prompt="New to Birdy?"
      linkHref="/register"
      linkLabel="Create an account"
      panelHeadline={<>Every client.<br />One brain.</>}
      panelSub="Manage your clients, campaigns, and conversations — all in one place."
    >
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="size-[52px] rounded-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-6 h-control-lg w-full" />
            <Skeleton className="h-control-lg w-full" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthLayout>
  )
}
