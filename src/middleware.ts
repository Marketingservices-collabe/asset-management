import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/auth", "/api/cron", "/no-access"];

/**
 * Lightweight cookie presence check for redirect UX only.
 * Real authorization happens in the (app) layout via requireContext() and in
 * every Server Action via requirePermission().
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const hasSession =
    req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
