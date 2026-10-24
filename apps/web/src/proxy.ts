import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { apiInternalUrl } from "@/lib/api-url";

// Exact matches only, so /free-invoice-generator/finish still needs a session.
const PUBLIC_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/free-invoice-generator",
  "/terms",
  "/privacy",
];

/**
 * Optimistic redirects based on the presence of a session cookie only. The API
 * validates the session on every request; this just avoids rendering a page
 * that would immediately bounce.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Signed in, anyone the API doesn't list as an admin gets a real 404, the same as
  // an unknown page. Signed out, there is no check: /admin falls through to the
  // sign-in redirect below, the same as any private page, so it can't be told apart.
  if (
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    getSessionCookie(request) &&
    !(await isAdmin(request))
  ) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }
  // The API rejected the session (expired, revoked, or from a reset database). Drop
  // the cookie before anything else, or the sign-in redirect below bounces back to /.
  if (pathname === "/sign-in" && request.nextUrl.searchParams.get("session") === "expired") {
    return clearSessionCookies(request, NextResponse.redirect(new URL("/sign-in", request.url)));
  }

  const hasSession = Boolean(getSessionCookie(request));

  // Signed-out visitors land on the marketing page, served at / so it stays the front door.
  if (pathname === "/landing") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!hasSession && pathname === "/") {
    return NextResponse.rewrite(new URL("/landing", request.url));
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path) || pathname.startsWith("/i/");

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (hasSession && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

/** Asks the API; any failure, network errors included, counts as no. */
async function isAdmin(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return false;
  try {
    const response = await fetch(`${apiInternalUrl}/api/v1/admin/access`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Expires every Better Auth session cookie, including the __Secure- variants used over HTTPS. */
function clearSessionCookies(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (!/^(__Secure-)?better-auth[.-]session_(token|data)/.test(name)) continue;
    response.cookies.set(name, "", { path: "/", maxAge: 0, secure: name.startsWith("__Secure-") });
  }
  return response;
}

export const config = {
  // Skip the API rewrite, Next internals, and public files.
  matcher: ["/((?!api|_next|brand|icons|favicon.ico|apple-icon.png|manifest.webmanifest).*)"],
};
