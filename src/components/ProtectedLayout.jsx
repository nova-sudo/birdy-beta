"use client"

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PUBLIC_ROUTES, PROTECTED_ROUTES } from '@/lib/constants';

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set isClient to true after mounting to ensure localStorage is accessible
    setIsClient(true);

    // Check if the current route is public or protected
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isProtectedRoute = PROTECTED_ROUTES.includes(pathname);

    // Check authentication status
    let isAuthenticated = false;
    const authData = localStorage.getItem('user_authenticated');
    if (authData) {
      try {
        const { value, expires_at } = JSON.parse(authData);
        const now = new Date();
        const expiry = new Date(expires_at);
        if (value === true && now < expiry) {
          isAuthenticated = true;
        } else {
          // Clear expired authentication data
          localStorage.removeItem('user_authenticated');
        }
      } catch (e) {
        console.error('Error parsing user_authenticated:', e);
        localStorage.removeItem('user_authenticated');
      }
    }

    // Admin routes require the admin role on top of authentication.
    const isAdminRoute = pathname.startsWith('/admin');
    let isAdmin = false;
    try {
      const rawUser = localStorage.getItem('user');
      isAdmin = (rawUser ? JSON.parse(rawUser)?.role : null) === 'admin';
    } catch {
      isAdmin = false;
    }

    // Set by LoginForm / the onboarding wizard from /api/onboarding/status.
    // While it's up, the wizard is the only place in the app the user can be.
    const onboardingIncomplete = localStorage.getItem('onboarding_incomplete') === '1';

    if ((isProtectedRoute || isAdminRoute) && !isAuthenticated) {
      // Redirect to /login for protected/admin routes if not authenticated
      // (isAdminRoute covers every /admin sub-route, not just the exact path).
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (isAuthenticated && onboardingIncomplete && pathname !== '/onboarding' && !isPublicRoute) {
      // First-run onboarding not finished — keep them in the wizard.
      router.push('/onboarding');
    } else if (isAdminRoute && isAuthenticated && !isAdmin) {
      // Authenticated but not an admin — bounce out of the admin console.
      router.push('/dashboard');
    } else if (isAuthenticated && isPublicRoute && pathname !== '/') {
      // Redirect authenticated users from /login or /register to /clients
      router.push(onboardingIncomplete ? '/onboarding' : '/clients');
    }
  }, [router, pathname]);

  // Render nothing until client-side to avoid hydration issues
  if (!isClient) {
    return null;
  }

  return <>{children}</>;
}