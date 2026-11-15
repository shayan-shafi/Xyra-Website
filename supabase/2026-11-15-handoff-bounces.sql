-- "send it to my laptop": remember each email's Resend id, so the daily
-- reminder job can skip an address whose last email bounced (2026-11-15).
-- Run once in the WEBSITE Supabase project (axeivmejklqurlzbmzry). Safe to re-run.
ALTER TABLE handoff_requests ADD COLUMN IF NOT EXISTS last_email_id TEXT;
