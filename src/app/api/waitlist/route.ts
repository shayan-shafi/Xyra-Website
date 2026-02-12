import { supabase, getBetaTestLink } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Waitlist is not configured yet" },
        { status: 503 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const { data: existing } = await supabase
      .from("waitlist")
      .select("email")
      .eq("email", normalizedEmail)
      .single();

    if (existing) {
      // Fetch beta link separately — don't let it break the flow
      let betaLink: string | null = null;
      try {
        betaLink = await getBetaTestLink();
      } catch {
        // silently ignore
      }

      return NextResponse.json(
        {
          message: "You're already on the list!",
          ...(betaLink && { betaLink }),
        },
        { status: 200 }
      );
    }

    // Insert new email
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: normalizedEmail });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    // Fetch beta link separately — don't let it break the flow
    let betaLink: string | null = null;
    try {
      betaLink = await getBetaTestLink();
    } catch {
      // silently ignore
    }

    return NextResponse.json(
      {
        message: "You're on the list!",
        ...(betaLink && { betaLink }),
      },
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
