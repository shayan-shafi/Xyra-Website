import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TOKEN_RE } from "@/lib/handoff";

// GET /api/handoff/stop?t=<token> — the "stop the reminders" link in the
// emails (and the List-Unsubscribe header). One tap, no confirmation step.
// POST does the same, for mail apps that unsubscribe in the background.

async function stop(token: string | null) {
  if (!supabaseAdmin || !token || !TOKEN_RE.test(token)) return;
  const { error } = await supabaseAdmin
    .from("handoff_requests")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("token", token)
    .is("unsubscribed_at", null);
  if (error) console.error("handoff stop error:", error);
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>xyra</title></head>
<body style="margin:0;background:#fbfaf8;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:440px;margin:0 auto;padding:72px 24px;">
<div style="font-size:24px;font-weight:600;margin:0 0 24px;">xyra</div>
<p style="font-size:18px;line-height:1.5;color:#111;margin:0 0 12px;">done. no more reminders.</p>
<p style="font-size:16px;line-height:1.5;color:#555;margin:0 0 28px;">your link still works if you want it later.</p>
<a href="https://xyra.dev" style="font-family:Menlo,Consolas,monospace;font-size:12px;color:#111;">xyra.dev</a>
</div></body></html>`;

export async function GET(request: Request) {
  await stop(new URL(request.url).searchParams.get("t"));
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  await stop(new URL(request.url).searchParams.get("t"));
  return new Response(null, { status: 204 });
}
