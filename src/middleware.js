import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

/**
 * Middleware to check for auth_token cookie, handle redirects, and manage post-login navigation.
 * Note: Since backend is on different domain, we rely on client-side storage
 * @param {import('next/server').NextRequest} request - The incoming request object.
 * @returns {import('next/server').NextResponse} - The response object.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for Chrome DevTools and other browser requests
  if (pathname.includes('.well-known') || pathname.includes('devtools')) {
    return NextResponse.next();
  }
  
  // Check for auth token in cookies (set by client-side)
  const authToken = request.cookies.get('client_auth_token')?.value;
  
  // Also check Authorization header as fallback
  const authHeader = request.headers.get('authorization');
  const hasAuth = authToken || authHeader;

  // Only log for important routes
  if (!pathname.startsWith('/_next') && !pathname.includes('favicon')) {
    console.log('Middleware Check:', {
      pathname,
      hasAuthToken: !!hasAuth,
      cookieToken: !!authToken,
    });
  }

  // Check if the current route is public
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // If user is NOT authenticated
  if (!hasAuth) {
    // Allow access to public routes
    if (isPublicRoute) {
      return NextResponse.next();
    }
    
    // Redirect to /login for protected routes
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user IS authenticated and tries to access login/register, redirect to clients
  if (hasAuth && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/clients', request.url));
  }

  // Allow authenticated users to proceed to any other page
  return NextResponse.next();
}

// Configure middleware to run on all routes except API, static files, and Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};