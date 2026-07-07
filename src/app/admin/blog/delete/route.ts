import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Admin-only. Permanently delete a post.
export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Site database not connected (missing service-role key)." }, { status: 501 });
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "number" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing post id." }, { status: 400 });

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
