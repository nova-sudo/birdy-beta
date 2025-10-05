import { NextResponse } from "next/server";

export function middleware(req) {
  const url = new URL(req.url);
  const jwt = url.searchParams.get("auth_token") || req.cookies.get("auth_token")?.value;

  const { pathname } = req.nextUrl;

  const publicRoutes = ["/login", "/register"] ; 
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  if (jwt) {
    if (pathname === "/" || isPublic) {
      const dashboardUrl = new URL("/dashboard", req.url);
      const response = NextResponse.redirect(dashboardUrl);
      response.cookies.set("jwt", jwt, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      return response;
    } else {
      const response = NextResponse.next();
      response.cookies.set("jwt", jwt, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      return response;
    }
  } else if (!isPublic) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  } else {
    return NextResponse.next();
  }
}

// Define which routes the middleware runs on
export const config = {
  matcher: [
    "/",
    "register",
    "/clients",
    "/dashboard",
    "/campaigns",
    "/contacts/:locationId",
    "/settings",
    "/login",
  ],
};
