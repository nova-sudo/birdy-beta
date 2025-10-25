// components/AuthProvider.js
"use client"

import { usePathname } from 'next/navigation'
import { useAuthSync } from '@/hooks/useAuthSync'

export function AuthProvider({ children }) {
  const pathname = usePathname()
  
  // Don't run auth sync on login/register pages
  const isAuthPage = pathname === '/login' || pathname === '/register'
  
  if (!isAuthPage) {
    useAuthSync()
  }
  
  return <>{children}</>
}