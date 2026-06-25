import { supabase } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { NextResponse } from "next/server";

const POSITION_OFFSET = 250;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clipStr(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

type IncomingFirstTouch = {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  referrer?: unknown;
  landing_page?: unknown;
  ref_code?: unknown;
};

function pickFirstTouch(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const ft = raw as IncomingFirstTouch;
  return {
    first_utm_source: clipStr(ft.utm_source, 128),
    first_utm_medium: clipStr(ft.utm_medium, 128),
    first_utm_campaign: clipStr(ft.utm_campaign, 128),
    first_utm_content: clipStr(ft.utm_content, 128),
    first_referrer: clipStr(ft.referrer, 512),
    first_landing_page: clipStr(ft.landing_page, 512),
    first_ref_code: clipStr(ft.ref_code, 64),
  };
}

function generateRefCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST — join waitlist with email
export async function POST(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Waitlist is not configured yet" },
        { status: 503 }
      );
    }

    const { name, email, referredBy, visitor_id, first_touch } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    // Check if email already exists
    const { data: existing } = await supabase
      .from("waitlist")
      .select("email")
      .eq("email", normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { message: "You're already on the list!" },
        { status: 200 }
      );
    }

    // Generate unique referral code
    const refCode = generateRefCode();

    const safeVisitorId =
      typeof visitor_id === "string" && UUID_RE.test(visitor_id) ? visitor_id : null;
    const firstTouch = pickFirstTouch(first_touch);

    // first_ref_code is the "first referral code ever seen by this visitor"
    // — captured at first-touch and, since the Option-C backfill in
    // AnalyticsProvider.tsx (backfillFirstTouchRefCode), also updated from
    // null when the visitor later navigates to any /ref/[code] page. Once
    // set it is never overwritten (first-referral-wins). This means creators
    // get reward credit for homepage signups driven by their link, not only
    // for signups that happen directly on the /ref/[code] page itself.
    // The explicit `referredBy` param (only sent by the /ref/[code] page
    // form, never the homepage) is a last-resort fallback for visitors with
    // localStorage disabled or who somehow land on /ref/[code] with a
    // still-null first_ref_code (e.g. first_ref_code capture race on very
    // first load). Logic is unchanged — first_ref_code just now covers more
    // cases than before.
    const effectiveReferredBy =
      firstTouch?.first_ref_code || (typeof referredBy === "string" ? referredBy.trim() : "") || null;

    // Insert new entry
    const { error } = await supabase
      .from("waitlist")
      .insert({
        name: trimmedName,
        email: normalizedEmail,
        ref_code: refCode,
        referred_by: effectiveReferredBy,
        visitor_id: safeVisitorId,
        ...(firstTouch ?? {}),
      });

    if (error) {
      console.error("Supabase insert error:", error);

      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Database permissions not configured. Run setup.sql in Supabase SQL Editor." },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    // If referred by someone, increment their referral count
    if (effectiveReferredBy) {
      const { data: referrer } = await supabase
        .from("waitlist")
        .select("referral_count")
        .eq("ref_code", effectiveReferredBy)
        .single();

      if (referrer) {
        await supabase
          .from("waitlist")
          .update({ referral_count: (referrer.referral_count || 0) + 1 })
          .eq("ref_code", effectiveReferredBy);
      }
    }

    // Calculate position
    let position = POSITION_OFFSET;
    const { count } = await supabase
      .from("waitlist")
      .select("*", { count: "exact", head: true });
    if (count !== null) {
      position = POSITION_OFFSET + count;
    }

    // Send welcome email via Resend template
    if (resend) {
      const firstName = trimmedName.split(" ")[0];
      try {
        const { data, error: sendError } = await resend.emails.send({
          from: "Shayan from Xyra <shayan@xyra.dev>",
          to: normalizedEmail,
          subject: "You're in. Here's what happens next.",
          template: {
            id: "065b2a5f-d73b-462c-8875-d3d4393e0317",
            variables: {
              firstName,
              position,
              code: refCode,
            },
          },
        } as Parameters<typeof resend.emails.send>[0]);
        if (sendError) {
          console.error("Resend send error:", sendError);
        } else {
          console.log("Resend send ok:", data?.id);
        }
      } catch (err) {
        console.error("Resend threw:", err);
      }
    }

    return NextResponse.json(
      { message: "You're on the list!" },
      { status: 201 }
    );
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// PATCH — save survey responses for an existing waitlist entry
export async function PATCH(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Waitlist is not configured yet" },
        { status: 503 }
      );
    }

    const { email, surveyMustHave } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabase
      .from("waitlist")
      .update({
        survey_must_have: surveyMustHave || null,
      })
      .eq("email", normalizedEmail);

    if (error) {
      console.error("Survey update error:", error);

      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Database permissions not configured. Run setup.sql in Supabase SQL Editor." },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save survey" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Survey saved! Thank you." },
      { status: 200 }
    );
  } catch (err) {
    console.error("Survey error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
