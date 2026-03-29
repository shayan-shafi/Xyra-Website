import { supabase } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { NextResponse } from "next/server";

const POSITION_OFFSET = 250;

function buildWelcomeEmail(name: string, position: number) {
  const firstName = name.split(" ")[0];
  return `Hey ${firstName},

You're on the Xyra waitlist. You're #${position}.

I'm Shayan, one of the three founders. I wanted to write this one myself, not hand it off to a template.

Here's the honest version of what we're building:

Xyra is a personal operating system that builds itself from your voice, or your fingers. Speak it, type it, either way it constructs your dashboards, your knowledge graph, your system. No setup. No templates. No Sunday-night rebuilding rituals.

I built it because I spent four years trying to find it and couldn't. I'm guessing you know the feeling. You've had the perfect Notion setup. It lasted three weeks. You've been starting over ever since.

That ends with Xyra.

Over the next week, I'm going to send you a few emails. Not sales emails, real ones. About what we built, why it works differently, and what the first people who use it are experiencing.

One thing before I go: you can move up the waitlist. Share your referral link with one person who'd genuinely want this, and you jump 50 spots. Three people = you move to the front.

Talk soon.

Shayan
Co-founder, Xyra`;
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

    const { name, email } = await request.json();

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

    // Insert new entry
    const { error } = await supabase
      .from("waitlist")
      .insert({ name: trimmedName, email: normalizedEmail });

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

    // Calculate position: count total entries + offset
    let position = POSITION_OFFSET;
    const { count } = await supabase
      .from("waitlist")
      .select("*", { count: "exact", head: true });
    if (count !== null) {
      position = POSITION_OFFSET + count;
    }

    // Send welcome email (fire and forget — don't block the response)
    if (resend) {
      resend.emails
        .send({
          from: "Shayan from Xyra <shayan@xyra.dev>",
          to: normalizedEmail,
          subject: "You're in. Here's what happens next.",
          text: buildWelcomeEmail(trimmedName, position),
        })
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
