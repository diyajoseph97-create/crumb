import { NextResponse } from "next/server";
import { authConfigured, COOKIE_MAX_AGE, COOKIE_NAME, expectedToken, safeEqual } from "@/lib/server/auth";

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "Crumb isn't set up yet: the passphrase settings are missing on the server." }, { status: 500 });
  }
  const { passphrase } = await req.json().catch(() => ({ passphrase: "" }));
  if (typeof passphrase !== "string" || !safeEqual(passphrase.trim(), process.env.CRUMB_PASSPHRASE!.trim())) {
    await new Promise((r) => setTimeout(r, 800)); // slows down guessing
    return NextResponse.json({ error: "That's not the passphrase." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await expectedToken(), {
    httpOnly: true, // page scripts can't read it
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
