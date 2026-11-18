// Runs before every request. Anyone without a valid cookie is sent to /unlock
// (pages) or gets a 401 "not allowed" (API). Nothing is readable or writable without it.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, isValidSession } from "./lib/server/auth";

export async function middleware(req: NextRequest) {
  const ok = await isValidSession(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not unlocked" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the unlock page, its API, and static files.
  matcher: ["/((?!unlock|api/unlock|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
