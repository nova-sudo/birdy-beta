// hooks/useAuthSync.js
"use client"

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Syncs auth token from localStorage to a client-side cookie
 * so that Next.js middleware can read it
 */
export function useAuthSync() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Run on client side only
    if (typeof window === 'undefined') return
    
    const token = localStorage.getItem('auth_token')
    const publicRoutes = ['/', '/login', '/register', '/forgot-password']
    const isPublicRoute = publicRoutes.includes(pathname)
    
    if (token) {
      // Set a client-side cookie that middleware can read
      document.cookie = `client_auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
      console.log('Auth sync: Cookie set for', pathname)
    } else {
      // Remove the cookie if no token
      document.cookie = 'client_auth_token=; path=/; max-age=0'
      console.log('Auth sync: No token, cleared cookie')
      
      // Redirect to login if on protected route
      if (!isPublicRoute) {
        console.log('Auth sync: Redirecting to login from', pathname)
        router.push(`/login?redirect=${pathname}`)
      }
    }
  }, [pathname, router])
}

/**
 * Logout function to clear all auth data
 */
export function logout() {
  // Clear localStorage
  localStorage.removeItem('auth_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  
  // Clear client cookie
  document.cookie = 'client_auth_token=; path=/; max-age=0'
  
  // Redirect to login
  window.location.href = '/login'
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser() {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

/**
 * Get auth token for API requests
 */
export function getAuthToken() {
  return localStorage.getItem('auth_token')
}