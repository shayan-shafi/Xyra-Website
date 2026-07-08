"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PostBody from "@/components/blog/PostBody";
import type { AdminBlogPost, BlogAdminData } from "./data";

// Client dashboard for authoring + monitoring blog posts. The server page
// (page.tsx) gates auth and passes the initial data; mutations hit the
// /admin/blog/* routes and then router.refresh() re-pulls fresh server data.
//
// "New post" opens a mode chooser with two paths:
//   • AI Drafts — agentic: hand it topics (or let it suggest some), it drafts
//     full posts that appear as review cards you can preview / edit / publish.
//   • Write — a clean, focused editor for writing or pasting a post by hand.

// ── small pure helpers ───────────────────────────────────────────────────────
function slugify(input: string): string {
  return input
    .toLowerCase().trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── editor form model ────────────────────────────────────────────────────────
interface EditorState {
  id: number | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  tags: string;
  cover_image: string;
  author: string;
  status: "draft" | "published";
  seo_title: string;
  seo_description: string;
  body_md: string;
}

function emptyEditor(): EditorState {
  return {
    id: null, title: "", slug: "", slugTouched: false, excerpt: "", tags: "",
    cover_image: "", author: "Xyra", status: "draft", seo_title: "", seo_description: "", body_md: "",
  };
}

type PostLike = Pick<
  AdminBlogPost,
  "id" | "title" | "slug" | "excerpt" | "tags" | "cover_image" | "author" | "status" | "seo_title" | "seo_description" | "body_md"
>;

function editorFromPost(p: PostLike): EditorState {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    slugTouched: true,
    excerpt: p.excerpt ?? "",
    tags: (p.tags ?? []).join(", "),
    cover_image: p.cover_image ?? "",
    author: p.author ?? "Xyra",
    status: p.status,
    seo_title: p.seo_title ?? "",
    seo_description: p.seo_description ?? "",
    body_md: p.body_md ?? "",
  };
}

// A draft produced by the agentic flow, tracked per topic.
interface GenDraft {
  key: string;
  topic: string;
  state: "pending" | "done" | "error";
  error?: string;
  post?: PostLike; // the persisted draft row
}

// ── presentational bits (match the other admin dashboards) ───────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-500 uppercase tracking-[0.1em]">{label}</span>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0";

export default function BlogDashboard({ initialData }: { initialData: BlogAdminData | null }) {
  const router = useRouter();

  // modal: which surface of the "New post" flow (or edit) is open
  const [modal, setModal] = useState<"choose" | "ai" | "write" | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // agentic drafting state
  const [topicsText, setTopicsText] = useState("");
  const [angle, setAngle] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [genDrafts, setGenDrafts] = useState<GenDraft[]>([]);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // ── setup notice (no service-role key) ─────────────────────────────────────
  if (!initialData) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-3">Site database not connected</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          The Blog dashboard reads and writes the site&apos;s own Supabase project using its <strong>service-role</strong> key.
          Add it to <code className="px-1 py-0.5 bg-gray-100 rounded">.env.local</code> and Vercel, then redeploy:
        </p>
        <pre className="mt-4 text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">{`SUPABASE_SERVICE_ROLE_KEY=<site project service-role key>`}</pre>
        <p className="text-xs text-gray-400 mt-3">
          Supabase → this project → Settings → API → service_role. Also run <code className="px-1 py-0.5 bg-gray-100 rounded">supabase/setup.sql</code> so the <code>blog_posts</code> table exists.
        </p>
      </div>
    );
  }

  const { counts, posts } = initialData;

  // ── shared fetch helper ────────────────────────────────────────────────────
  async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  }

  function closeModal() {
    setModal(null);
    setEditor(null);
    setError(null);
    setConfirmDelete(null);
  }

  // ── manual editor mutations ────────────────────────────────────────────────
  async function save(publishOverride?: "draft" | "published") {
    if (!editor) return;
    setError(null);
    if (!editor.title.trim()) { setError("Title is required."); return; }
    setBusy(true);
    const payload = {
      id: editor.id,
      title: editor.title,
      slug: editor.slug || slugify(editor.title),
      excerpt: editor.excerpt,
      tags: editor.tags.split(",").map((t) => t.trim()).filter(Boolean),
      cover_image: editor.cover_image,
      author: editor.author,
      status: publishOverride ?? editor.status,
      seo_title: editor.seo_title,
      seo_description: editor.seo_description,
      body_md: editor.body_md,
    };
    const { ok, data } = await postJson("/admin/blog/save", payload);
    setBusy(false);
    if (!ok) { setError((data.error as string) ?? "Save failed."); return; }
    closeModal();
    router.refresh();
  }

  async function togglePublish(p: AdminBlogPost) {
    setBusy(true);
    const { ok, data } = await postJson("/admin/blog/publish", { id: p.id, publish: p.status !== "published" });
    setBusy(false);
    if (!ok) { setError((data.error as string) ?? "Failed."); return; }
    router.refresh();
  }

  async function doDelete(id: number) {
    setBusy(true);
    const { ok, data } = await postJson("/admin/blog/delete", { id });
    setBusy(false);
    setConfirmDelete(null);
    if (!ok) { setError((data.error as string) ?? "Delete failed."); return; }
    router.refresh();
  }

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setEditor((e) => (e ? { ...e, [key]: value } : e));

  // ── agentic drafting ───────────────────────────────────────────────────────
  async function suggestTopics() {
    setAiError(null);
    setSuggestBusy(true);
    const { ok, data } = await postJson("/admin/blog/suggest-topics", { angle, count: 6 });
    setSuggestBusy(false);
    if (!ok) { setAiError((data.error as string) ?? "Couldn't suggest topics."); return; }
    const topics = Array.isArray(data.topics) ? (data.topics as string[]) : [];
    setTopicsText((prev) => [prev.trim(), ...topics].filter(Boolean).join("\n"));
  }

  async function generateDrafts() {
    const lines = topicsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setAiError("Add at least one topic (one per line)."); return; }
    setAiError(null);
    setAiBusy(true);

    const queued: GenDraft[] = lines.map((topic, i) => ({ key: `g${Date.now()}_${i}`, topic, state: "pending" }));
    setGenDrafts((prev) => [...queued, ...prev]);

    for (const item of queued) {
      // 1) draft the post
      const gen = await postJson("/admin/blog/generate-draft", { prompt: item.topic });
      if (!gen.ok) {
        setGenDrafts((prev) => prev.map((d) => d.key === item.key ? { ...d, state: "error", error: (gen.data.error as string) ?? "Draft failed." } : d));
        continue;
      }
      const draft = (gen.data.draft ?? {}) as Record<string, unknown>;
      // 2) persist it as a draft so it survives and shows in the list
      const savePayload = {
        id: null,
        title: (draft.title as string) || item.topic,
        slug: (draft.slug as string) || slugify(item.topic),
        excerpt: (draft.excerpt as string) ?? "",
        tags: Array.isArray(draft.tags) ? (draft.tags as string[]) : [],
        cover_image: "",
        author: "Xyra",
        status: "draft",
        seo_title: (draft.seo_title as string) ?? "",
        seo_description: (draft.seo_description as string) ?? "",
        body_md: (draft.body_md as string) ?? "",
      };
      const saved = await postJson("/admin/blog/save", savePayload);
      if (!saved.ok) {
        setGenDrafts((prev) => prev.map((d) => d.key === item.key ? { ...d, state: "error", error: (saved.data.error as string) ?? "Save failed." } : d));
        continue;
      }
      const post = saved.data.post as PostLike;
      setGenDrafts((prev) => prev.map((d) => d.key === item.key ? { ...d, state: "done", post } : d));
    }

    setAiBusy(false);
    setTopicsText("");
    router.refresh();
  }

  async function publishGenerated(d: GenDraft) {
    if (!d.post) return;
    setBusy(true);
    const { ok, data } = await postJson("/admin/blog/publish", { id: d.post.id, publish: true });
    setBusy(false);
    if (!ok) { setAiError((data.error as string) ?? "Publish failed."); return; }
    setGenDrafts((prev) => prev.map((x) => x.key === d.key && x.post ? { ...x, post: { ...x.post, status: "published" } } : x));
    router.refresh();
  }

  async function discardGenerated(d: GenDraft) {
    if (d.post) {
      setBusy(true);
      await postJson("/admin/blog/delete", { id: d.post.id });
      setBusy(false);
    }
    setGenDrafts((prev) => prev.filter((x) => x.key !== d.key));
    router.refresh();
  }

  function editGenerated(d: GenDraft) {
    if (!d.post) return;
    setEditor(editorFromPost(d.post));
    setTab("write");
    setModal("write");
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {error && !modal && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total posts" value={counts.total} />
        <StatCard label="Published" value={counts.published} />
        <StatCard label="Drafts" value={counts.drafts} />
        <StatCard label="Total views" value={counts.totalViews} sub="from site analytics" />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">Posts</h2>
        <button
          onClick={() => { setModal("choose"); setError(null); }}
          className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white font-[family-name:var(--font-jetbrains)] tracking-wide hover:bg-gray-800 transition-colors"
        >
          + New post
        </button>
      </div>

      {/* Post list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {posts.length === 0 ? (
          <p className="p-8 text-sm text-gray-400 italic text-center">No posts yet. Write your first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Title", "Status", "Views", "Updated", ""].map((h, i) => (
                    <th key={h || i} className={`px-5 py-3 font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em] ${i > 1 && i < 4 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-gray-900">{p.title}</div>
                      <div className="text-xs text-gray-400 font-mono">/blog/{p.slug}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 text-right tabular-nums">{p.views}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 text-right whitespace-nowrap">{fmtDate(p.updated_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === "published" && (
                          <a href={`/blog/${p.slug}`} target="_blank" className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1">View</a>
                        )}
                        <button onClick={() => { setEditor(editorFromPost(p)); setTab("write"); setError(null); setModal("write"); }} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Edit</button>
                        <button disabled={busy} onClick={() => togglePublish(p)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 disabled:opacity-40">
                          {p.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        {confirmDelete === p.id ? (
                          <span className="flex items-center gap-1">
                            <button disabled={busy} onClick={() => doDelete(p.id)} className="text-xs font-semibold text-red-600 hover:text-red-700 px-1.5 py-1">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1">×</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDelete(p.id)} className="text-xs text-gray-400 hover:text-red-600 px-2 py-1">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mode chooser ─────────────────────────────────────────────────────── */}
      {modal === "choose" && (
        <ModalShell onClose={closeModal} title="New post" widthClass="sm:max-w-2xl">
          <p className="text-sm text-gray-500 mb-6">How do you want to create this post?</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => { setModal("ai"); setAiError(null); }}
              className="group text-left rounded-2xl border border-gray-200 bg-white p-6 hover:border-indigo-400 hover:shadow-sm transition-all"
            >
              <div className="text-2xl">✨</div>
              <div className="mt-3 font-[family-name:var(--font-playfair)] text-lg text-gray-900">Draft with AI</div>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                Hand it topics (or let it suggest some). Agents draft full posts you can preview, edit, and publish.
              </p>
              <span className="mt-4 inline-block text-xs font-medium text-indigo-600 group-hover:translate-x-0.5 transition-transform">Agentic drafting →</span>
            </button>
            <button
              onClick={() => { setEditor(emptyEditor()); setTab("write"); setModal("write"); }}
              className="group text-left rounded-2xl border border-gray-200 bg-white p-6 hover:border-gray-900 hover:shadow-sm transition-all"
            >
              <div className="text-2xl">✍️</div>
              <div className="mt-3 font-[family-name:var(--font-playfair)] text-lg text-gray-900">Write it myself</div>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                A clean editor to write in Markdown or paste something in. Full control over every field.
              </p>
              <span className="mt-4 inline-block text-xs font-medium text-gray-900 group-hover:translate-x-0.5 transition-transform">Open editor →</span>
            </button>
          </div>
        </ModalShell>
      )}

      {/* ── Agentic drafting surface ─────────────────────────────────────────── */}
      {modal === "ai" && (
        <ModalShell
          onClose={closeModal}
          title="Draft with AI"
          widthClass="sm:max-w-4xl"
          headerExtra={
            <button
              onClick={() => { setEditor(emptyEditor()); setTab("write"); setModal("write"); }}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5"
            >
              Write manually
            </button>
          }
        >
          {aiError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{aiError}</div>}

          {/* Composer */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-indigo-500 uppercase tracking-[0.12em]">Topics — one per line</span>
              <div className="flex items-center gap-2">
                <input
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  placeholder="angle (optional)"
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-gray-700 focus:outline-none focus:border-indigo-400 w-40"
                />
                <button disabled={suggestBusy} onClick={suggestTopics} className="rounded-full border border-indigo-300 text-indigo-700 text-xs px-3 py-1 hover:bg-indigo-100 disabled:opacity-40 transition-colors">
                  {suggestBusy ? "Thinking…" : "Suggest topics"}
                </button>
              </div>
            </div>
            <textarea
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              rows={5}
              placeholder={"Why voice-first beats app-switching for daily planning\nHow a personal knowledge graph ends the productivity-app graveyard\nThe case against 12 separate apps for one life"}
              className={`${inputCls} bg-white resize-y font-[family-name:var(--font-jetbrains)] text-[13px] leading-relaxed`}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-indigo-400">Each line becomes a full draft, saved for review. Nothing publishes automatically.</span>
              <button disabled={aiBusy || !topicsText.trim()} onClick={generateDrafts} className="rounded-full bg-indigo-600 text-white text-xs px-5 py-2 disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                {aiBusy ? "Drafting…" : `Generate ${topicsText.split("\n").map((l) => l.trim()).filter(Boolean).length || ""} draft${topicsText.split("\n").map((l) => l.trim()).filter(Boolean).length === 1 ? "" : "s"}`.trim()}
              </button>
            </div>
          </div>

          {/* Review queue */}
          {genDrafts.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              Drafts you generate appear here to review. They&apos;re also saved as drafts in the list.
            </p>
          ) : (
            <div className="space-y-3">
              {genDrafts.map((d) => (
                <div key={d.key} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      {d.state === "pending" && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="inline-block h-3 w-3 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                          Drafting “{d.topic}”…
                        </div>
                      )}
                      {d.state === "error" && (
                        <div className="text-sm text-red-600">Failed: {d.topic} <span className="text-red-400">— {d.error}</span></div>
                      )}
                      {d.state === "done" && d.post && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{d.post.title}</span>
                            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.post.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{d.post.status}</span>
                          </div>
                          {d.post.excerpt && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{d.post.excerpt}</p>}
                          <div className="mt-1 text-[11px] text-gray-400 font-mono">/blog/{d.post.slug}</div>
                        </>
                      )}
                    </div>
                    {d.state === "done" && d.post && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => setPreviewKey(previewKey === d.key ? null : d.key)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">{previewKey === d.key ? "Hide" : "Preview"}</button>
                        <button onClick={() => editGenerated(d)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Edit</button>
                        {d.post.status !== "published" && (
                          <button disabled={busy} onClick={() => publishGenerated(d)} className="text-xs text-white bg-black hover:bg-gray-800 rounded-full px-3 py-1 disabled:opacity-40">Publish</button>
                        )}
                        <button disabled={busy} onClick={() => discardGenerated(d)} className="text-xs text-gray-400 hover:text-red-600 px-2 py-1">Discard</button>
                      </div>
                    )}
                    {d.state === "error" && (
                      <button onClick={() => setGenDrafts((prev) => prev.filter((x) => x.key !== d.key))} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Dismiss</button>
                    )}
                  </div>
                  {previewKey === d.key && d.post && (
                    <div className="border-t border-gray-100 bg-warm-white p-6 max-h-[420px] overflow-y-auto">
                      <PostBody markdown={d.post.body_md} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}

      {/* ── Manual editor ────────────────────────────────────────────────────── */}
      {modal === "write" && editor && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
          <div className="bg-gray-50 w-full sm:max-w-5xl shadow-2xl min-h-screen sm:min-h-0 sm:my-8 sm:rounded-2xl">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/90 backdrop-blur px-5 py-3 sm:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <h3 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">{editor.id ? "Edit post" : "New post"}</h3>
                <div className="flex rounded-full bg-gray-100 p-0.5">
                  {(["write", "preview"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 text-xs rounded-full font-[family-name:var(--font-jetbrains)] tracking-wide capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeModal} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5">Cancel</button>
                <button disabled={busy} onClick={() => save("draft")} className="text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-full px-4 py-1.5 disabled:opacity-40">Save draft</button>
                <button disabled={busy} onClick={() => save("published")} className="text-sm text-white bg-black hover:bg-gray-800 rounded-full px-4 py-1.5 disabled:opacity-40">
                  {editor.status === "published" ? "Update & keep live" : "Publish"}
                </button>
              </div>
            </div>

            <div className="p-5">
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              {tab === "write" ? (
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Main column — title + body get the room */}
                  <div className="lg:col-span-2 space-y-4">
                    <input
                      value={editor.title}
                      onChange={(e) => setEditor((s) => s && ({ ...s, title: e.target.value, slug: s.slugTouched ? s.slug : slugify(e.target.value) }))}
                      className="w-full bg-transparent font-[family-name:var(--font-playfair)] text-3xl text-gray-900 placeholder:text-gray-300 focus:outline-none"
                      placeholder="Post title"
                    />
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-[family-name:var(--font-jetbrains)] uppercase tracking-wide">Markdown</span>
                      <span>·</span>
                      <span>Write or paste freely. Use the Preview tab to see it rendered.</span>
                    </div>
                    <textarea
                      value={editor.body_md}
                      onChange={(e) => set("body_md", e.target.value)}
                      rows={24}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-[family-name:var(--font-jetbrains)] text-[13px] leading-relaxed text-gray-900 focus:border-gray-900 focus:outline-none resize-y"
                      placeholder={"Start writing…\n\n## A heading\n\nA paragraph with **bold**, a [link](https://xyra.dev), and a list:\n\n- point one\n- point two"}
                    />
                  </div>

                  {/* Sidebar — everything else, tucked away */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                      <Field label="Slug" hint="url">
                        <input value={editor.slug} onChange={(e) => setEditor((s) => s && ({ ...s, slug: slugify(e.target.value), slugTouched: true }))} className={`${inputCls} font-mono text-xs`} placeholder="url-segment" />
                      </Field>
                      <Field label="Excerpt" hint="index + meta fallback">
                        <textarea value={editor.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="One or two sentences." />
                      </Field>
                      <Field label="Tags" hint="comma-separated">
                        <input value={editor.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} placeholder="productivity, ai, voice" />
                      </Field>
                      <Field label="Cover image URL">
                        <input value={editor.cover_image} onChange={(e) => set("cover_image", e.target.value)} className={`${inputCls} text-xs`} placeholder="https://…" />
                      </Field>
                      <Field label="Author">
                        <input value={editor.author} onChange={(e) => set("author", e.target.value)} className={inputCls} />
                      </Field>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.12em] mb-3">SEO</div>
                      <div className="space-y-4">
                        <Field label="SEO title" hint={`${editor.seo_title.length}/60`}>
                          <input value={editor.seo_title} onChange={(e) => set("seo_title", e.target.value)} className={inputCls} placeholder="Defaults to the title" />
                        </Field>
                        <Field label="Meta description" hint={`${editor.seo_description.length}/155`}>
                          <textarea value={editor.seo_description} onChange={(e) => set("seo_description", e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="Defaults to the excerpt" />
                        </Field>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview */
                <div className="bg-warm-white rounded-2xl border border-gray-200 p-8 max-w-3xl mx-auto">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {editor.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.14em] text-accent-dark">{t}</span>
                    ))}
                  </div>
                  <h1 className="font-[family-name:var(--font-playfair)] text-4xl text-ink leading-[1.06]">{editor.title || "Untitled"}</h1>
                  {editor.excerpt && <p className="mt-4 font-[family-name:var(--font-eb-garamond)] text-xl text-ink-light leading-relaxed">{editor.excerpt}</p>}
                  <div className="mt-8">
                    {editor.body_md.trim() ? <PostBody markdown={editor.body_md} /> : <p className="text-gray-400 italic">Nothing to preview yet.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable centered modal frame for the chooser + AI surfaces.
function ModalShell({
  title, onClose, children, widthClass = "sm:max-w-2xl", headerExtra,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
      <div className={`bg-gray-50 w-full ${widthClass} shadow-2xl min-h-screen sm:min-h-0 sm:my-8 sm:rounded-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/90 backdrop-blur px-5 py-3 sm:rounded-t-2xl">
          <h3 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5">Close</button>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
