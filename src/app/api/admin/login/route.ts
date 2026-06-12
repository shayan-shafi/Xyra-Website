import { NextResponse } from "next/server";
import { computeToken, ADMIN_COOKIE } from "@/lib/adminAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    const adminPassword = process.env.ANALYTICS_ADMIN_PASSWORD;

    if (!adminPassword || !password || password !== adminPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = computeToken(password);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/admin",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
