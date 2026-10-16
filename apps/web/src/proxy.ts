import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

/**
 * Optimistic redirects based on the presence of a session cookie only. The API
 * validates the session on every request; this just avoids rendering a page
 * that would immediately bounce.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  if (hasSession && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip the API rewrite, Next internals, and public files.
  matcher: ["/((?!api|_next|brand|icons|favicon.ico|apple-icon.png|manifest.webmanifest).*)"],
};
