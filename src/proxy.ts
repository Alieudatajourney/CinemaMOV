import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only: sends visitors without a session cookie to the login page,
 * preserving the exact destination. This is NOT the authorization boundary — every protected
 * layout, page and API route verifies the signed session and role on the server.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get("mcp_session")?.value) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
