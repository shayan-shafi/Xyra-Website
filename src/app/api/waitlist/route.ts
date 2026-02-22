import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

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

    const { email, surveyAppCount, surveyCurrentApps, surveyMustHave } =
      await request.json();

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
        survey_app_count: surveyAppCount || null,
        survey_current_apps: surveyCurrentApps || null,
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
