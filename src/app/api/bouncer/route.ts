import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidEmail } from "@/lib/emailValidation";

// THE DOOR — server side of Bouncer Xyra, the conversational waitlist.
// The browser only ever talks to this route; this route owns ALL state
// (bouncer_sessions), rate limiting, and the verdict→invite gate, and calls
// the Xyra app's `bouncer` edge function for the actual conversation beat.
//
// Deterministic gates live HERE, not in the prompt: a model verdict of
// "convinced" is honored only with a valid email on file and enough turns.
// (Recurring lesson from the app: the model's instincts lose to determinism.)
//
// Env (server-only): APP_SUPABASE_URL + APP_SUPABASE_ANON_KEY or
// APP_SUPABASE_SERVICE_ROLE_KEY (already used by the admin feedback console).

const APP_SUPABASE_URL =
  process.env.APP_SUPABASE_URL || "https://naklqxesofjyhnehgizl.supabase.co";
const APP_KEY =
  process.env.APP_SUPABASE_ANON_KEY ||
  process.env.APP_SUPABASE_SERVICE_ROLE_KEY ||
  "";

const MAX_MESSAGE_CHARS = 600;
const MAX_TURNS = 14; // visitor messages per session before the door closes
const MIN_TURNS_TO_GRANT = 3; // no instant grants, no matter what the model says
const MAX_SESSIONS_PER_IP_24H = 6;
const HISTORY_WINDOW = 12;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TranscriptEntry = { role: "user" | "assistant"; content: string; ts: string };

function ipHash(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  const salt = process.env.BOUNCER_IP_SALT || "xyra_bouncer_v1";
  return createHash("sha256").update(ip + salt).digest("hex");
}

function generateRefCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** The door never breaks character — canned in-voice beats for non-LLM paths. */
const LINES = {
  rateLimited: "you've been at the door a lot today. sleep on it — come back tomorrow.",
  closed: "we've been at this all night. door's closed for now — come back tomorrow with the real pitch.",
  alreadyIn: "you're already in. don't make me regret it.",
  jammed: "door's jammed for a sec — say that again?",
};

async function fetchInviteLink(): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("beta_config")
    .select("value")
    .eq("key", "beta_test_link")
    .single();
  return data?.value || null;
}

/** Flip (or create) the waitlist row the moment the bouncer lets them in. */
async function grantOnWaitlist(email: string, name: string | null, visitorId: string | null) {
  if (!supabaseAdmin) return;
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("waitlist")
    .select("id, alpha_status")
    .eq("email", email)
    .single();
  if (existing) {
    await supabaseAdmin
      .from("waitlist")
      .update({ alpha_status: "invited", alpha_invited_at: now })
      .eq("email", email);
  } else {
    await supabaseAdmin.from("waitlist").insert({
      name: name || email.split("@")[0],
      email,
      ref_code: generateRefCode(),
      visitor_id: visitorId,
      alpha_status: "invited",
      alpha_invited_at: now,
      admin_notes: "talked their way in — bouncer",
    });
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin || !APP_KEY) {
      return NextResponse.json({ error: "Bouncer is not configured yet" }, { status: 503 });
    }

    const { sessionId, message, visitor_id } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    const userMessage = message.trim().slice(0, MAX_MESSAGE_CHARS);
    const safeVisitorId =
      typeof visitor_id === "string" && UUID_RE.test(visitor_id) ? visitor_id : null;
    const iph = ipHash(request);

    // ---- Load or open the session ----
    let session: any = null;
    if (typeof sessionId === "string" && UUID_RE.test(sessionId)) {
      const { data } = await supabaseAdmin
        .from("bouncer_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      session = data;
    }

    if (!session) {
      // New face at the door — how many times has this IP shown up today?
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("bouncer_sessions")
        .select("*", { count: "exact", head: true })
        .eq("ip_hash", iph)
        .gte("created_at", dayAgo);
      if ((count ?? 0) >= MAX_SESSIONS_PER_IP_24H) {
        return NextResponse.json(
          { messages: [LINES.rateLimited], rateLimited: true },
          { status: 429 }
        );
      }
      const { data: created, error } = await supabaseAdmin
        .from("bouncer_sessions")
        .insert({ visitor_id: safeVisitorId, ip_hash: iph })
        .select("*")
        .single();
      if (error || !created) {
        console.error("bouncer session create error:", error);
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
      }
      session = created;
    }

    // ---- Deterministic short-circuits (no LLM) ----
    if (session.verdict === "convinced") {
      const inviteLink = await fetchInviteLink();
      return NextResponse.json({
        sessionId: session.id,
        messages: [LINES.alreadyIn],
        verdict: "convinced",
        granted: true,
        inviteLink,
      });
    }
    if (session.turn_count >= MAX_TURNS) {
      return NextResponse.json({
        sessionId: session.id,
        messages: [LINES.closed],
        verdict: session.verdict,
        granted: false,
        closed: true,
      });
    }

    const transcript: TranscriptEntry[] = Array.isArray(session.transcript)
      ? session.transcript
      : [];
    const recentHistory = transcript
      .slice(-HISTORY_WINDOW)
      .map((t) => ({ role: t.role, content: t.content }));
    const newTurnCount = (session.turn_count || 0) + 1;

    // ---- One conversation beat from the app's bouncer fn ----
    let reply: {
      messages: string[];
      verdict: "vetting" | "convinced" | "denied";
      name: string | null;
      email: string | null;
      wantsToTrack: string[];
    };
    try {
      const res = await fetch(`${APP_SUPABASE_URL}/functions/v1/bouncer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: APP_KEY,
          Authorization: `Bearer ${APP_KEY}`,
        },
        body: JSON.stringify({
          message: userMessage,
          recentHistory,
          turnCount: newTurnCount,
          nameOnFile: session.name || null,
          emailOnFile: session.email || null,
          knownWants: session.wants_to_track || [],
        }),
      });
      if (!res.ok) throw new Error(`bouncer fn ${res.status}`);
      reply = await res.json();
      if (!Array.isArray(reply?.messages) || reply.messages.length === 0) {
        throw new Error("bouncer fn returned no messages");
      }
    } catch (err) {
      console.error("bouncer fn call failed:", err);
      // Don't burn a turn on our own failure.
      return NextResponse.json({
        sessionId: session.id,
        messages: [LINES.jammed],
        verdict: session.verdict,
        granted: false,
      });
    }

    // ---- Deterministic verdict gate ----
    const capturedName = reply.name || session.name || null;
    const capturedEmail =
      reply.email && isValidEmail(reply.email)
        ? reply.email.toLowerCase().trim()
        : session.email || null;
    let verdict = reply.verdict;
    if (verdict === "convinced" && (!capturedEmail || newTurnCount < MIN_TURNS_TO_GRANT)) {
      verdict = "vetting"; // the model got charmed early — the door has standards
    }
    const granted = verdict === "convinced";

    const wants = Array.from(
      new Set([...(session.wants_to_track || []), ...(reply.wantsToTrack || [])])
    ).slice(0, 12);

    // ---- Persist the turn ----
    const ts = new Date().toISOString();
    const newTranscript: TranscriptEntry[] = [
      ...transcript,
      { role: "user", content: userMessage, ts },
      ...reply.messages.map((m) => ({ role: "assistant" as const, content: m, ts })),
    ];
    await supabaseAdmin
      .from("bouncer_sessions")
      .update({
        transcript: newTranscript,
        turn_count: newTurnCount,
        verdict,
        name: capturedName,
        email: capturedEmail,
        wants_to_track: wants,
        ...(granted && !session.granted_at ? { granted_at: ts } : {}),
      })
      .eq("id", session.id);

    // ---- The rope lifts ----
    let inviteLink: string | null = null;
    if (granted) {
      await grantOnWaitlist(capturedEmail!, capturedName, safeVisitorId || session.visitor_id);
      inviteLink = await fetchInviteLink();
    }

    return NextResponse.json({
      sessionId: session.id,
      messages: reply.messages,
      verdict,
      granted,
      ...(inviteLink ? { inviteLink } : {}),
    });
  } catch (err) {
    console.error("bouncer route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
