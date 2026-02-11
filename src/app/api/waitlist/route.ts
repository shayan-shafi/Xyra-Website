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

    // Fetch the beta link in parallel with the duplicate check
    const [existingResult, betaLink] = await Promise.all([
      supabase
        .from("waitlist")
        .select("email")
        .eq("email", email.toLowerCase().trim())
        .single(),
      getBetaTestLink(),
    ]);

    if (existingResult.data) {
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
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "You're on the list!",
        ...(betaLink && { betaLink }),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
