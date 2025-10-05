import { NextResponse } from "next/server";

export function middleware(req) {
  const url = new URL(req.url);
  const authToken = req.cookies.get("auth_token")?.value;

  const { pathname } = req.nextUrl;

  const publicRoutes = ["/login", "/register"];
  const isPublic = publicRoutes.includes(pathname);

  // Log for debugging
  console.log(`Middleware: pathname=${pathname}, authToken=${authToken ? "present" : "missing"}`);

  if (authToken) {
    if (pathname === "/" || isPublic) {
      console.log("Redirecting to /dashboard");
      const dashboardUrl = new URL("/dashboard", req.url);
      const response = NextResponse.redirect(dashboardUrl);
      // Preserve existing cookies (auth_token, refresh_token)
      response.cookies.set("auth_token", authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // Match backend's max_age for rememberMe=true
      });
      return response;
    }
    // Proceed to requested route, preserving cookies
    return NextResponse.next();
  } else if (!isPublic) {
    console.log("Redirecting to /login");
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/register",
    "/login",
    "/dashboard",
    "/clients",
    "/campaigns",
    "/contacts/:path*",
    "/settings",
  ],
};