"use client"

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  // Define public and protected routes
  const PUBLIC_ROUTES = ['/', '/login', '/register'];
  const PROTECTED_ROUTES = ['/clients', '/call-center', '/settings', '/campaigns', '/contacts'];

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

    if (isProtectedRoute && !isAuthenticated) {
      // Redirect to /login for protected routes if not authenticated
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (isAuthenticated && isPublicRoute && pathname !== '/') {
      // Redirect authenticated users from /login or /register to /clients
      router.push('/clients');
    }
  }, [router, pathname]);

  // Render nothing until client-side to avoid hydration issues
  if (!isClient) {
    return null;
  }

  return <>{children}</>;
}