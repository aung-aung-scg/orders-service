import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const api = pathname.startsWith("/api/") ||
    pathname === "/kitchen/orders" || pathname === "/kitchen/stream" ||
    /^\/tables\/[^/]+\/qr$/.test(pathname);
  const kitchen = /^\/(?:api\/)?kitchen(?:\/|$)/.test(pathname) || pathname === "/reservations" || /^\/table-sessions(?:\/|$)/.test(pathname);
  const session = await verifySession(request.cookies.get(sessionCookie)?.value);
  if (!session) {
    if (api) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "Login required" }, {
        status: 401, headers: { "Cache-Control": "no-store" },
      });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login, 303);
  }
  if (!kitchen && session.role !== "ADMIN") {
    if (api) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Access denied" }, {
        status: 403, headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.redirect(new URL("/kitchen", request.url), 303);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/kitchen/:path*", "/tables/:path*", "/api/kitchen/:path*", "/api/tables/:path*", "/reservations", "/table-sessions/:path*"],
};
