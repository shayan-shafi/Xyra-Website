import { getBetaTestLink } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const betaLink = await getBetaTestLink();

    if (!betaLink) {
      return NextResponse.json(
        { error: "Beta link is not available yet" },
        { status: 404 }
      );
    }

    return NextResponse.json({ url: betaLink }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch beta link" },
      { status: 500 }
    );
  }
}
