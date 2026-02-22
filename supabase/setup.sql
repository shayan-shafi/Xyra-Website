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
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS name               TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS survey_app_count    TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS survey_current_apps TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS survey_must_have    TEXT;

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
