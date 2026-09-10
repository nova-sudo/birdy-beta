import { NextResponse } from "next/server"
import { SESSION_COOKIE, parseSession, isExpired } from "@/lib/session"
import { PUBLIC_ROUTES, PROTECTED_ROUTES } from "@/lib/constants"

/**
 * Next 16 calls this file `proxy`; it is the same request interceptor the
 * `middleware` convention was, renamed upstream.
 *
 * Apply the session's routing rules before the page renders, so a signed-out
 * visitor never sees a frame of the app shell and a signed-in one never waits
 * on hydration to be sent where they belong.
 *
 * ── It only acts on evidence ───────────────────────────────────────────────
 *
 * The absence of the cookie is NOT read as "signed out". It cannot be: the
 * cookie is new, and every session that predates it would be thrown back to
 * /login on the deploy that introduced it — everyone signed out at once, for a
 * change that was supposed to be about speed. Those sessions are still valid,
 * and ProtectedLayout writes them the cookie on their next authenticated load.
 *
 * So this redirects only when the cookie is there and says something: present
 * and expired means signed out; present and in a role means the admin console
 * can be answered here. Anything else falls through to the client checks that
 * were doing this before.
 *
 * Once the cookie has been out long enough that live sessions have it, absence
 * can be tightened into a redirect and the client gate can go.
 *
 * ── It is not a security boundary ──────────────────────────────────────────
 *
 * The cookie carries no token and is writable by anyone with devtools. It
 * decides what to *render*; the API decides what anyone actually gets, by
 * checking the real JWT on every request. See lib/session.js.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl
  const session = parseSession(request.cookies.get(SESSION_COOKIE)?.value)

  // No hint — this is a session older than the cookie, or a genuine visitor.
  // Either way, let the page render and let the client decide.
  if (!session) return NextResponse.next()

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
  const isProtectedRoute = PROTECTED_ROUTES.includes(pathname)
  const isAdminRoute = pathname.startsWith("/admin")

  if (isExpired(session)) {
    if (isProtectedRoute || isAdminRoute) {
      return redirectTo(request, `/login?redirect=${encodeURIComponent(pathname)}`)
    }
    return NextResponse.next()
  }

  // Signed in from here down.

  if (session.ob && pathname !== "/onboarding" && !isPublicRoute) {
    return redirectTo(request, "/onboarding")
  }

  if (isAdminRoute && session.role !== "admin") {
    return redirectTo(request, "/dashboard")
  }

  if (isPublicRoute && pathname !== "/") {
    return redirectTo(request, session.ob ? "/onboarding" : "/clients")
  }

  return NextResponse.next()
}

function redirectTo(request, path) {
  return NextResponse.redirect(new URL(path, request.url))
}

export const config = {
  // Pages only. Static assets and image requests have no routing decision to
  // make, and putting middleware in front of them would tax every one of them.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.).*)"],
}
