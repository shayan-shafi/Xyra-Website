"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PostBody from "@/components/blog/PostBody";
import type { AdminBlogPost, BlogAdminData } from "./data";

// Client dashboard for authoring + monitoring blog posts. The server page
// (page.tsx) gates auth and passes the initial data; mutations hit the
// /admin/blog/* routes and then router.refresh() re-pulls fresh server data.

// ── small pure helpers ───────────────────────────────────────────────────────
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
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

function editorFromPost(p: AdminBlogPost): EditorState {
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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

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

  // ── mutations ──────────────────────────────────────────────────────────────
  async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  }

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
    setEditor(null);
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

  async function draftWithAI() {
    if (!editor || !aiPrompt.trim()) return;
    setError(null);
    setAiBusy(true);
    const { ok, data } = await postJson("/admin/blog/generate-draft", { prompt: aiPrompt });
    setAiBusy(false);
    if (!ok) { setError((data.error as string) ?? "AI draft failed."); return; }
    const d = (data.draft ?? {}) as Record<string, unknown>;
    setEditor((e) => e && ({
      ...e,
      title: (d.title as string) || e.title,
      slug: (d.slug as string) || e.slug,
      slugTouched: true,
      excerpt: (d.excerpt as string) ?? e.excerpt,
      tags: Array.isArray(d.tags) ? (d.tags as string[]).join(", ") : e.tags,
      seo_title: (d.seo_title as string) ?? e.seo_title,
      seo_description: (d.seo_description as string) ?? e.seo_description,
      body_md: (d.body_md as string) || e.body_md,
    }));
    setAiPrompt("");
  }

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setEditor((e) => (e ? { ...e, [key]: value } : e));

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {error && !editor && (
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
          onClick={() => { setEditor(emptyEditor()); setTab("write"); setError(null); }}
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
                        <button onClick={() => { setEditor(editorFromPost(p)); setTab("write"); setError(null); }} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Edit</button>
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

      {/* Editor modal */}
      {editor && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
          <div className="bg-gray-50 w-full sm:max-w-5xl sm:rounded-2xl shadow-2xl min-h-screen sm:min-h-0 sm:my-8">
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
                <button onClick={() => { setEditor(null); setError(null); }} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5">Cancel</button>
                <button disabled={busy} onClick={() => save("draft")} className="text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-full px-4 py-1.5 disabled:opacity-40">Save draft</button>
                <button disabled={busy} onClick={() => save("published")} className="text-sm text-white bg-black hover:bg-gray-800 rounded-full px-4 py-1.5 disabled:opacity-40">
                  {editor.status === "published" ? "Update & keep live" : "Publish"}
                </button>
              </div>
            </div>

            <div className="p-5">
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              {tab === "write" ? (
                <div className="grid gap-5 lg:grid-cols-3">
                  {/* Main column */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* AI assist */}
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-indigo-500 uppercase tracking-[0.12em] mb-2">Draft with AI</div>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={2}
                        placeholder="Topic or outline, e.g. 'Why voice-first beats app-switching for daily planning' — Claude drafts the title, SEO meta, and full Markdown body."
                        className={`${inputCls} resize-y bg-white`}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-indigo-400">Fills the fields below. Review before publishing.</span>
                        <button disabled={aiBusy || !aiPrompt.trim()} onClick={draftWithAI} className="rounded-full bg-indigo-600 text-white text-xs px-4 py-1.5 disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                          {aiBusy ? "Drafting…" : "Generate draft"}
                        </button>
                      </div>
                    </div>

                    <Field label="Title">
                      <input
                        value={editor.title}
                        onChange={(e) => setEditor((s) => s && ({ ...s, title: e.target.value, slug: s.slugTouched ? s.slug : slugify(e.target.value) }))}
                        className={`${inputCls} text-base`}
                        placeholder="A specific, search-worthy headline"
                      />
                    </Field>

                    <Field label="Body" hint="Markdown">
                      <textarea
                        value={editor.body_md}
                        onChange={(e) => set("body_md", e.target.value)}
                        rows={20}
                        className={`${inputCls} font-[family-name:var(--font-jetbrains)] text-[13px] leading-relaxed resize-y`}
                        placeholder={"Write in Markdown.\n\n## A heading\n\nA paragraph with **bold** and a [link](https://xyra.dev)."}
                      />
                    </Field>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-4">
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

                    <div className="pt-2 border-t border-gray-200">
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
