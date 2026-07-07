import { supabase } from "@/lib/supabase";

// Blog domain: shared types + PUBLIC read helpers. Public pages (/blog and
// /blog/[slug]) read through the anon client, which RLS restricts to PUBLISHED
// posts only (see supabase/setup.sql section 11). Admin reads/writes live in
// src/app/admin/blog/data.ts and go through the service-role client instead.

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image: string | null;
  tags: string[];
  author: string;
  status: BlogStatus;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// Columns selected for list views — omits the (potentially large) body.
const LIST_COLUMNS =
  "id, slug, title, excerpt, cover_image, tags, author, status, published_at, created_at, updated_at";
const FULL_COLUMNS = `${LIST_COLUMNS}, body_md, seo_title, seo_description`;

/** Summary shape for cards/lists (no body). */
export type BlogPostSummary = Omit<BlogPost, "body_md" | "seo_title" | "seo_description">;

/** All published posts, newest first. Safe to call at build/request time. */
export async function getPublishedPosts(): Promise<BlogPostSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("blog_posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("getPublishedPosts:", error.message);
    return [];
  }
  return (data ?? []) as BlogPostSummary[];
}

/** A single published post by slug, or null if missing/unpublished. */
export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("getPublishedPostBySlug:", error.message);
    return null;
  }
  return (data as BlogPost | null) ?? null;
}

// ── Content utilities ────────────────────────────────────────────────────────

/** Turn a title into a url-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Rough plain-text rendering of Markdown — for meta descriptions and JSON-LD. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")        // fenced code
    .replace(/`([^`]+)`/g, "$1")             // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")   // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "")             // headings
    .replace(/^\s*>\s?/gm, "")               // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "")           // list bullets
    .replace(/[*_~]/g, "")                    // emphasis marks
    .replace(/\s+/g, " ")
    .trim();
}

/** A ~155-char meta description: explicit override → excerpt → body preview. */
export function metaDescription(post: Pick<BlogPost, "seo_description" | "excerpt" | "body_md">): string {
  const raw = post.seo_description?.trim() || post.excerpt?.trim() || stripMarkdown(post.body_md);
  if (raw.length <= 155) return raw;
  return `${raw.slice(0, 152).trimEnd()}…`;
}

/** Estimated reading time in whole minutes (min 1). */
export function readingTimeMinutes(md: string): number {
  const words = stripMarkdown(md).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
