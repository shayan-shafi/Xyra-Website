import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TOKEN_RE } from "@/lib/handoff";

// POST /api/handoff/claim — app.xyra.dev calls this right after an account is
// made from a handoff link (?h=<token>). Stops the reminders and erases the
// email: the account has its own from here on. Answers 204 whatever happens,
// so it can never get in the way of a sign-up.

const ALLOWED_ORIGIN = /^(https:\/\/app\.xyra\.dev|http:\/\/localhost:\d+|http:\/\/127\.0\.0\.1:\d+)$/;

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGIN.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const headers = cors(request);
  try {
    const body = await request.json().catch(() => null);
    const token = body && typeof body.token === "string" ? body.token : "";
    if (supabaseAdmin && TOKEN_RE.test(token)) {
      const { error } = await supabaseAdmin
        .from("handoff_requests")
        .update({ claimed_at: new Date().toISOString(), email: null })
        .eq("token", token)
        .is("claimed_at", null);
      if (error) console.error("handoff claim error:", error);
    }
  } catch (err) {
    console.error("handoff claim error:", err);
  }
  return new NextResponse(null, { status: 204, headers });
}
