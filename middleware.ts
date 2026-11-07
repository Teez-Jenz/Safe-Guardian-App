import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "safe_guardian_session";

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE_NAME);

  const { pathname } = request.nextUrl;

  // Public routes that must NEVER require login (e.g. emergency contacts tracking victim's live movement)
  if (
    pathname.startsWith("/track") ||
    pathname.startsWith("/api/track") ||
    pathname === "/login" ||
    pathname === "/signin"
  ) {
    return NextResponse.next();
  }

  // Protected routes
  const protectedRoutes = [
    "/dashboard",
    "/profile",
    "/contacts",
    "/emergency",
    "/location",
    "/checkIn",
  ];

  const isProtectedRoute =
    pathname === "/" || protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/profile/:path*",
    "/contacts/:path*",
    "/emergency/:path*",
    "/location/:path*",
    "/checkIn/:path*",
    "/emergency",
    "/location",
    "/checkIn",
  ],
};
