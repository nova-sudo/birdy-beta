"use client"

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { PUBLIC_ROUTES, PROTECTED_ROUTES } from '@/lib/constants';
import { writeSession, clearSession } from '@/lib/session';

/**
 * Client-side routing rules for a signed-in session.
 *
 * This used to render `null` until it had mounted, because the checks below
 * read localStorage and localStorage does not exist on the server. That single
 * `return null` cost the whole first paint: a prerendered /clients was 53KB of
 * markup with no visible text in it, and nothing appeared until the bundle had
 * downloaded, hydrated, and run this effect.
 *
 * It renders its children immediately now. The redirects still happen — an
 * effect is soon enough for rules that are about where someone should be, not
 * about what they are allowed to see. Nothing sensitive is exposed by being a
 * frame early: every figure on every page comes from the API, which checks the
 * real token and 401s, and apiRequest turns that into a trip to /login.
 *
 * middleware.js handles the same rules ahead of the render for anyone whose
 * session cookie says so. This stays as the backstop for sessions that predate
 * that cookie, and as the thing that writes it.
 */
export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isProtectedRoute = PROTECTED_ROUTES.includes(pathname);

    let isAuthenticated = false;
    let expiresAt = null;
    const authData = localStorage.getItem('user_authenticated');
    if (authData) {
      try {
        const { value, expires_at } = JSON.parse(authData);
        const now = new Date();
        const expiry = new Date(expires_at);
        if (value === true && now < expiry) {
          isAuthenticated = true;
          expiresAt = expires_at;
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
    let role = null;
    try {
      const rawUser = localStorage.getItem('user');
      role = rawUser ? JSON.parse(rawUser)?.role : null;
    } catch {
      role = null;
    }
    const isAdmin = role === 'admin';

    // Set by LoginForm / the onboarding wizard from /api/onboarding/status.
    // While it's up, the wizard is the only place in the app the user can be.
    const onboardingIncomplete = localStorage.getItem('onboarding_incomplete') === '1';

    // Mirror what localStorage already knows into a cookie the server can
    // read. Doing it on every authenticated load — not only at login — is what
    // lets sessions created before this cookie existed pick it up silently,
    // instead of everyone being bounced to /login on the deploy that added it.
    if (isAuthenticated) {
      writeSession({ expiresAt, role, onboardingIncomplete });
    } else {
      clearSession();
    }

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

  return <>{children}</>;
}
