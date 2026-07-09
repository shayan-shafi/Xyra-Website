-- ============================================================
-- Xyra Website — Supabase Schema Setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Waitlist table (if not already created)
CREATE TABLE IF NOT EXISTS waitlist (
  id                       BIGSERIAL PRIMARY KEY,
  name                     TEXT NOT NULL,
  email                    TEXT NOT NULL UNIQUE,
  survey_app_count         TEXT,
  survey_current_apps      TEXT,
  survey_must_have         TEXT,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- Add columns if table already exists (safe to run multiple times)
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS name                TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS survey_app_count    TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS survey_current_apps TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS survey_must_have    TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS ref_code            TEXT UNIQUE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referred_by         TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referral_count      INTEGER DEFAULT 0;

-- First-party anonymous attribution (added by analytics MVP)
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS visitor_id          UUID;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_utm_source    TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_utm_medium    TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_utm_campaign  TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_utm_content   TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_referrer      TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_landing_page  TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS first_ref_code      TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_visitor ON waitlist (visitor_id);

-- Enable Row-Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Allow anonymous insert" ON waitlist;
DROP POLICY IF EXISTS "Allow anonymous select" ON waitlist;
DROP POLICY IF EXISTS "Allow anonymous update" ON waitlist;

-- Allow anonymous inserts (for the website form)
CREATE POLICY "Allow anonymous insert" ON waitlist
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous select for duplicate checking
CREATE POLICY "Allow anonymous select" ON waitlist
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous updates (for survey responses)
CREATE POLICY "Allow anonymous update" ON waitlist
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);


-- 2. Beta Config table — stores key/value pairs you can manage from the dashboard
CREATE TABLE IF NOT EXISTS beta_config (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE beta_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Allow anonymous read" ON beta_config;

-- Allow anonymous reads (the website fetches these)
CREATE POLICY "Allow anonymous read" ON beta_config
  FOR SELECT TO anon
  USING (true);


-- 3. Seed the beta test link
-- Update the URL below with your actual beta/test link
INSERT INTO beta_config (key, value, is_active)
VALUES ('beta_test_link', 'https://your-beta-app-url.com', true)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      is_active = EXCLUDED.is_active,
      updated_at = now();


-- 4. Analytics Events table — first-party anonymous visitor tracking
CREATE TABLE IF NOT EXISTS analytics_events (
  id            BIGSERIAL PRIMARY KEY,
  visitor_id    UUID NOT NULL,
  session_id    UUID NOT NULL,
  event_name    TEXT NOT NULL,
  path          TEXT,
  referrer      TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Safe to run multiple times — adds columns if the table already existed without them
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON analytics_events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event   ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events (created_at DESC);

-- Enable Row-Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Allow anonymous insert" ON analytics_events;

-- Anonymous role can ONLY insert. No SELECT/UPDATE/DELETE — table is read-only
-- to anyone but the service_role (the Supabase dashboard / your backend).
CREATE POLICY "Allow anonymous insert" ON analytics_events
  FOR INSERT TO anon
  WITH CHECK (true);


-- ============================================================
-- HOW TO USE:
--
-- To update the beta link, go to Supabase Dashboard → Table Editor
-- → beta_config table → edit the row with key = 'beta_test_link'
--
-- To disable the beta link (hide it from the website), set
-- is_active = false on that row.
--
-- You can add more config entries with different keys, e.g.:
--   INSERT INTO beta_config (key, value) VALUES ('announcement', 'We launch next week!');
-- ============================================================


-- 5. Analytics Digest Runs — tracks when email digests have been sent
--    Only the service_role key (supabaseAdmin) can read or write this table.
--    Anon users have no access.
CREATE TABLE IF NOT EXISTS analytics_digest_runs (
  id           BIGSERIAL PRIMARY KEY,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipients   TEXT,
  window_days  INTEGER NOT NULL DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_digest_runs_sent ON analytics_digest_runs (sent_at DESC);

ALTER TABLE analytics_digest_runs ENABLE ROW LEVEL SECURITY;
-- No RLS policies: anon role has no access.
-- The service_role key bypasses RLS and is the only accessor.


-- 6. Daily Signup Digest Runs — tracks which Chicago calendar dates have
--    already had their daily signup summary email sent, so the cron job
--    never double-sends for the same day even if it's triggered twice.
--    Only the service_role key (supabaseAdmin) can read or write this table.
CREATE TABLE IF NOT EXISTS daily_signup_digest_runs (
  id           BIGSERIAL PRIMARY KEY,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_date  DATE NOT NULL,
  recipients   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_signup_digest_runs_date ON daily_signup_digest_runs (window_date);

ALTER TABLE daily_signup_digest_runs ENABLE ROW LEVEL SECURITY;
-- No RLS policies: anon role has no access.
-- The service_role key bypasses RLS and is the only accessor.


-- ============================================================
-- 7. Growth / Alpha admin fields on waitlist  (Growth + Email Ops admin)
--    Additive + idempotent. Safe to run multiple times. Adds nullable
--    columns only — never drops, renames, or mutates existing data.
--
--    alpha_status     : free-text lifecycle marker. Suggested values:
--                       'candidate' | 'selected' | 'invited' | 'declined'.
--                       Left free-text (no CHECK) so the vocabulary can evolve
--                       without another migration. The admin Growth UI reads
--                       it; the guarded real-send path only ever writes
--                       'invited' (when an Alpha invite is actually sent).
--    alpha_invited_at : set by the guarded real-send path at invite time.
--    admin_notes      : internal free-text notes shown only in the admin UI.
-- ============================================================
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS alpha_status     TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS alpha_invited_at TIMESTAMPTZ;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS admin_notes      TEXT;

-- Optional hardening (commented out — uncomment to make the DB reject
-- unexpected status values):
-- ALTER TABLE waitlist
--   ADD CONSTRAINT waitlist_alpha_status_chk
--   CHECK (alpha_status IS NULL
--          OR alpha_status IN ('candidate','selected','invited','declined'));


-- ============================================================
-- 8. Email campaign send logging  (Growth Email Ops)
--    Used ONLY by the guarded real-send path, which is disabled unless the
--    ENABLE_GROWTH_EMAIL_SENDS env flag is "true". Preview / test-send / CSV
--    export never touch these tables. They let a real selected-user send (a)
--    record what was sent and (b) refuse to send the same campaign to the same
--    person twice.
--    Only the service_role key (supabaseAdmin) can read or write these. Anon
--    users have no access (RLS on, no policies).
-- ============================================================
CREATE TABLE IF NOT EXISTS email_campaign_runs (
  id              BIGSERIAL PRIMARY KEY,
  campaign_key    TEXT NOT NULL,           -- admin-chosen id, e.g. 'alpha-2026-06-29'
  template_id     TEXT NOT NULL,           -- 'alpha-invite' | 'newsletter'
  subject         TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_by         TEXT,                    -- optional label for who triggered it
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id            BIGSERIAL PRIMARY KEY,
  campaign_key  TEXT NOT NULL,
  template_id   TEXT NOT NULL,
  email         TEXT NOT NULL,
  run_id        BIGINT REFERENCES email_campaign_runs(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency guard: at most one row per (campaign_key, email). The send path
-- inserts here as it sends and treats a unique-violation as "already sent —
-- skip", so re-running a campaign can never double-email the same person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign_email
  ON email_campaign_recipients (campaign_key, email);

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_run ON email_campaign_recipients (run_id);

ALTER TABLE email_campaign_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
-- No RLS policies: anon role has no access.
-- The service_role key bypasses RLS and is the only accessor.


-- ============================================================
-- 9. Growth email template drafts  (Email Ops template editor)
--    Stores admin edits to the email templates so they persist across
--    sessions. Defaults always live in code (growthEmailTemplates.ts); a row
--    here OVERRIDES the code default for that template_id. "Reset to default"
--    deletes the row. Until this table exists, the editor falls back to
--    browser localStorage so editing still works for review.
--    Only the service_role key (supabaseAdmin) can read or write. Anon users
--    have no access (RLS on, no policies).
-- ============================================================
CREATE TABLE IF NOT EXISTS growth_email_templates (
  template_id   TEXT PRIMARY KEY,            -- 'alpha-invite' | 'newsletter' | 'general-message'
  subject       TEXT NOT NULL,
  values_json   JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { placeholderKey: value }
  sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { sectionKey: boolean } (enabled sections)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT
);
-- Safe to run if the table already existed without sections_json:
ALTER TABLE growth_email_templates ADD COLUMN IF NOT EXISTS sections_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE growth_email_templates ENABLE ROW LEVEL SECURITY;
-- No RLS policies: anon role has no access.
-- The service_role key bypasses RLS and is the only accessor.


-- ============================================================
-- 10. Email image storage  (Email Ops drag-and-drop image upload)
--     The newsletter "behind the scenes" block (and any future image fields)
--     upload through POST /admin/growth/email/upload-image, which stores the
--     file in a PUBLIC Supabase Storage bucket and returns a public HTTPS URL.
--     Emails require a public URL, so the bucket must be public-read.
--
--     ⚠ STORAGE IS NOT CREATED BY THIS FILE. Create the bucket explicitly
--     (it is a one-time setup, and creating it is left to you to approve):
--
--     Option A — Dashboard: Storage → New bucket →
--        name: email-assets   (or set GROWTH_IMAGE_BUCKET to match)
--        Public bucket: ON
--        (optional) allowed MIME types: image/png, image/jpeg, image/webp, image/gif
--        (optional) file size limit: 5 MB
--
--     Option B — SQL (run only if you're comfortable; creates a public bucket):
--        insert into storage.buckets (id, name, public)
--        values ('email-assets', 'email-assets', true)
--        on conflict (id) do update set public = true;
--
--     The upload route uses the service_role key, which bypasses RLS, so no
--     extra storage policies are required for uploads. Public read is provided
--     by the bucket's "public" flag. Until the bucket exists, Email Ops shows a
--     "image upload needs setup" state and the manual public-URL field still
--     works.
-- ============================================================


-- ============================================================
-- 11. Blog posts  (SEO/GEO content — public /blog + admin Blog tab)
--     Long-form marketing/SEO content authored in the admin Blog dashboard
--     and rendered at /blog and /blog/[slug]. Body is authored in Markdown.
--
--     Reads: PUBLIC. The anon role may SELECT only PUBLISHED posts (RLS below),
--            so the public site can render them with the anon key. Drafts are
--            invisible to anon and only readable via the service_role key.
--     Writes: service_role only (the admin Blog dashboard). Anon has no
--            INSERT/UPDATE/DELETE.
--
--     Safe to run multiple times (idempotent).
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,          -- url segment, e.g. 'why-voice-first'
  title            TEXT NOT NULL,
  excerpt          TEXT,                          -- 1-2 sentence summary (list + meta fallback)
  body_md          TEXT NOT NULL DEFAULT '',      -- Markdown source
  cover_image      TEXT,                          -- public image URL (optional)
  tags             TEXT[] NOT NULL DEFAULT '{}',  -- topical tags
  author           TEXT NOT NULL DEFAULT 'Xyra',
  status           TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  seo_title        TEXT,                          -- optional <title> override
  seo_description  TEXT,                          -- optional meta description override
  published_at     TIMESTAMPTZ,                   -- set when first published
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast "published, newest first" listing and slug lookups.
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON blog_posts (status, published_at DESC);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anon may read ONLY published posts. Drafts stay private (service_role only).
DROP POLICY IF EXISTS "Allow anonymous read published posts" ON blog_posts;
CREATE POLICY "Allow anonymous read published posts" ON blog_posts
  FOR SELECT TO anon
  USING (status = 'published');
-- No anon INSERT/UPDATE/DELETE policies: only the service_role key (the admin
-- Blog dashboard) can create, edit, publish, or delete posts.

-- Keep updated_at fresh on every write.
CREATE OR REPLACE FUNCTION set_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_blog_posts_updated_at();


-- ============================================================
-- 12. Saved recipient groups  (Growth Email Ops — reusable send lists)
--     Named, reusable groups of email recipients so a list (e.g. the first
--     Alpha cohort) can be saved once and loaded into the Email Ops composer
--     again later WITHOUT rebuilding it by hand. Loading a group only
--     populates the composer — it never sends. The guarded real-send path
--     (section 8) is unchanged and still requires dry-run + confirm.
--
--     ⚠ CONTAINS EMAILS (PII). Like the campaign-log tables (section 8), these
--     are admin/service-role ONLY: RLS is enabled with NO policies, so the
--     anon/public client can neither read nor write them. Every access goes
--     through supabaseAdmin (service_role) behind the /admin auth gate.
--
--     Additive + idempotent. Safe to run multiple times.
-- ============================================================
CREATE TABLE IF NOT EXISTS growth_recipient_groups (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  created_by   TEXT,                      -- optional label; app has no per-admin identity
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Soft-delete: archived groups are hidden from the default list but never
  -- destroyed, so a list can be retired without losing who was in it.
  archived_at  TIMESTAMPTZ,
  -- Set when a group is loaded into the composer, so "last used" is visible.
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS growth_recipient_group_members (
  id          BIGSERIAL PRIMARY KEY,
  group_id    BIGINT NOT NULL REFERENCES growth_recipient_groups(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  notes       TEXT,
  source      TEXT,                        -- e.g. 'manual', 'composer', 'campaign:<key>'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (group, lowercased email) — dedupe/idempotency guard. The app
-- inserts lowercased emails and relies on this to keep a member unique per
-- group even if the same address is pasted again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_group_lower_email
  ON growth_recipient_group_members (group_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_group_members_group ON growth_recipient_group_members (group_id);

ALTER TABLE growth_recipient_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_recipient_group_members ENABLE ROW LEVEL SECURITY;
-- No RLS policies: anon role has no access. service_role (supabaseAdmin) bypasses
-- RLS and is the only accessor, behind the /admin auth gate.


-- ============================================================
-- 13. Bouncer sessions  (the conversational waitlist — Xyra works the door)
--     One row per visitor conversation with Bouncer Xyra on the landing page.
--     The transcript is the intent signal for alpha selection AND the future
--     first-launch pre-seed (wants_to_track → starter dashboards in the app).
--
--     Reads/Writes: service_role ONLY. The browser never touches this table —
--     every turn goes through the /api/bouncer server route, which also
--     enforces rate limits using ip_hash/visitor_id lookups here.
--
--     verdict lifecycle: 'vetting' → 'convinced' (granted_at set, waitlist row
--     upserted with alpha_status='invited') | 'denied' (spam/abuse; can
--     recover to 'vetting'). turn_count counts VISITOR messages only.
--
--     Safe to run multiple times (idempotent).
-- ============================================================
CREATE TABLE IF NOT EXISTS bouncer_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id      UUID,                            -- analytics visitor (nullable)
  ip_hash         TEXT,                            -- sha256(ip + salt), for rate limiting
  name            TEXT,                            -- captured mid-conversation ("who's asking?")
  email           TEXT,                            -- captured mid-conversation
  transcript      JSONB NOT NULL DEFAULT '[]',     -- [{role:'user'|'assistant', content, ts}]
  verdict         TEXT NOT NULL DEFAULT 'vetting', -- 'vetting' | 'convinced' | 'denied'
  wants_to_track  TEXT[] NOT NULL DEFAULT '{}',    -- harvested life-areas (pre-seed signal)
  turn_count      INTEGER NOT NULL DEFAULT 0,      -- visitor messages so far
  granted_at      TIMESTAMPTZ,                     -- set once when verdict flips to convinced
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate-limit lookups: "sessions from this IP / visitor in the last N hours".
CREATE INDEX IF NOT EXISTS idx_bouncer_sessions_ip_created
  ON bouncer_sessions (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bouncer_sessions_visitor_created
  ON bouncer_sessions (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bouncer_sessions_email
  ON bouncer_sessions (email);

ALTER TABLE bouncer_sessions ENABLE ROW LEVEL SECURITY;
-- No anon policies at all: service_role only, via the /api/bouncer route.

-- Keep updated_at fresh on every write (reuses the blog trigger fn shape).
CREATE OR REPLACE FUNCTION set_bouncer_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bouncer_sessions_updated_at ON bouncer_sessions;
CREATE TRIGGER trg_bouncer_sessions_updated_at
  BEFORE UPDATE ON bouncer_sessions
  FOR EACH ROW EXECUTE FUNCTION set_bouncer_sessions_updated_at();
