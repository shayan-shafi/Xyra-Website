-- ─────────────────────────────────────────────────────────────────────────
-- Changelog: every release, one row (2026-11-14)
--
-- Written by POST /api/changelog/ingest, which is called by
-- scripts/log-ship.mjs at the end of every ship script (app.xyra.dev web
-- deploys, edge functions, migrations, TestFlight builds) and by the xyra.dev
-- build itself on every production deploy.
--
-- Read by /admin/changelog. Server-only: RLS on and no policies, so only the
-- service role (SUPABASE_SERVICE_ROLE_KEY) can read or write it.
--
-- Run once in the Supabase SQL editor (the WEBSITE project, same one as
-- handoff_requests). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ship_events (
  id              BIGSERIAL PRIMARY KEY,
  dedupe_key      TEXT UNIQUE NOT NULL,          -- kind:sha:ref — a re-run of the same ship updates, never doubles
  kind            TEXT NOT NULL CHECK (kind IN ('web', 'website', 'functions', 'database', 'phone')),
  status          TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'queued', 'failed')),
  shipped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sha             TEXT,                          -- HEAD that went out
  prev_sha        TEXT,                          -- HEAD of the previous release of this kind
  branch          TEXT,
  ref             TEXT,                          -- deploy url / build number / function names
  source          TEXT NOT NULL DEFAULT 'script', -- script | vercel-build | backfill | manual
  commits         JSONB NOT NULL DEFAULT '[]',   -- [{sha, at, subject, areas[]}], newest first
  detail          JSONB NOT NULL DEFAULT '{}',   -- functions[], migrations[], build number, …
  summary         JSONB,                         -- {headline, items:[{type:'new'|'fixed'|'under_the_hood', text}]}
  summary_edited  BOOLEAN NOT NULL DEFAULT false, -- true once edited by hand; never overwritten by the AI again
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ship_events_kind_shipped_idx ON ship_events (kind, shipped_at DESC);
CREATE INDEX IF NOT EXISTS ship_events_shipped_idx ON ship_events (shipped_at DESC);

ALTER TABLE ship_events ENABLE ROW LEVEL SECURITY;
