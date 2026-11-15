-- ─────────────────────────────────────────────────────────────────────────
-- "send it to my laptop" (2026-11-14)
--
-- A phone visitor to xyra.dev leaves an email; we send them a link to start
-- on a laptop, plus up to two reminders. The link carries `token`, so the
-- account they make on app.xyra.dev traces back to the ad they came from.
--
-- Server-only: RLS on and no policies, so only the service role
-- (SUPABASE_SERVICE_ROLE_KEY, used by /api/handoff*) can read or write it.
--
-- Privacy: once the account is made (claimed_at) the email is erased.
-- Rows that never turn into an account are deleted after 30 days by
-- /api/cron/handoff-reminders.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS handoff_requests (
  id                  BIGSERIAL PRIMARY KEY,
  email               TEXT UNIQUE,              -- lowercased; NULL once claimed
  token               TEXT NOT NULL UNIQUE,     -- random, in the emailed link
  visitor_id          UUID,                     -- the site's anonymous visitor id
  first_utm_source    TEXT,
  first_utm_medium    TEXT,
  first_utm_campaign  TEXT,
  first_utm_content   TEXT,
  first_referrer      TEXT,
  first_landing_page  TEXT,
  first_ref_code      TEXT,
  twclid              TEXT,                     -- only when ad measurement was allowed
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_sent_at       TIMESTAMPTZ,              -- when email #1 went (reminders count from here)
  last_email_at       TIMESTAMPTZ,
  emails_sent         SMALLINT NOT NULL DEFAULT 0,
  opened_at           TIMESTAMPTZ,              -- first time the link was opened, any device
  laptop_opened_at    TIMESTAMPTZ,              -- first time it was opened on a laptop/desktop
  claimed_at          TIMESTAMPTZ,              -- account created on app.xyra.dev with this token
  unsubscribed_at     TIMESTAMPTZ               -- "stop these" link
);

CREATE INDEX IF NOT EXISTS handoff_requests_reminders_idx
  ON handoff_requests (emails_sent, first_sent_at)
  WHERE claimed_at IS NULL AND unsubscribed_at IS NULL;

ALTER TABLE handoff_requests ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: anon and authenticated roles get nothing.
