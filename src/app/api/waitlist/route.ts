import { supabase } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { NextResponse } from "next/server";

const POSITION_OFFSET = 250;

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

    const { name, email, referredBy } = await request.json();

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

    // Insert new entry
    const { error } = await supabase
      .from("waitlist")
      .insert({
        name: trimmedName,
        email: normalizedEmail,
        ref_code: refCode,
        referred_by: referredBy || null,
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
    if (referredBy) {
      const { data: referrer } = await supabase
        .from("waitlist")
        .select("referral_count")
        .eq("ref_code", referredBy)
        .single();

      if (referrer) {
        await supabase
          .from("waitlist")
          .update({ referral_count: (referrer.referral_count || 0) + 1 })
          .eq("ref_code", referredBy);
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
      resend.emails
        .send({
          from: "Shayan from Xyra <shayan@xyra.dev>",
          to: normalizedEmail,
          subject: "You're in. Here's what happens next.",
          template: {
            id: "waitlist-signup-email-1",
            variables: {
              firstName,
              position,
              code: refCode,
            },
          },
        } as Parameters<typeof resend.emails.send>[0])
        .catch((err) => console.error("Resend error:", err));
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
