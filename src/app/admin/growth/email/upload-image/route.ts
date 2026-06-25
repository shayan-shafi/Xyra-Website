import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";

// ── Email image upload ──────────────────────────────────────────────────────
// Admin-only. Accepts a single image file (multipart/form-data, field "file"),
// stores it in a PUBLIC Supabase Storage bucket, and returns a public HTTPS URL
// suitable for embedding in an email. Emails can't use local file paths, so the
// public URL is the whole point.
//
// Safety: admin auth required; strict image MIME + extension allowlist (no SVG,
// which can carry script); size cap; server-generated filename (no user input
// in the path). The bucket is NOT created here — see supabase/setup.sql §10.

const BUCKET = process.env.GROWTH_IMAGE_BUCKET || "email-assets";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// SVG is intentionally excluded — it can embed scripts and is an XSS vector.
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isMissingBucket(err: { message?: string; status?: number } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return m.includes("bucket not found") || m.includes("not found") || err.status === 404;
}

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPG, WEBP, or GIF (no SVG)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.` }, { status: 400 });
  }

  // Server-generated, collision-resistant filename — no user input in the path.
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `newsletter/${safeName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (upErr) {
    if (isMissingBucket(upErr as { message?: string; status?: number })) {
      return NextResponse.json(
        {
          error: `Storage bucket "${BUCKET}" not found. Create a public bucket named "${BUCKET}" (see supabase/setup.sql §10), then try again.`,
          setupNeeded: true,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
