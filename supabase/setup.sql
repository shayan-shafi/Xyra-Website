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
