#!/usr/bin/env node
// Logs one release to the admin Changelog (xyra.dev/admin/changelog).
//
// From a ship script, after the deploy succeeded:
//   node "$LOG_SHIP" web
//   node "$LOG_SHIP" functions --detail "delete-account stripe-webhook"
//   node "$LOG_SHIP" database  --detail "20261104000000_trial_codes.sql"
//   node "$LOG_SHIP" phone --status queued
//   (LOG_SHIP="/Users/shayanshafi/Desktop/CODE BASES/Xyra-Website/scripts/log-ship.mjs")
//
// From the xyra.dev build on Vercel (package.json "postbuild"):
//   node scripts/log-ship.mjs website --vercel
//
// It asks the site for the last release of that kind, lists the commits since
// then from LOCAL git (so deploys of unpushed work are covered), keeps only the
// commits that touch that surface, and posts them. It NEVER fails the ship:
// every error prints one line and exits 0.
//
// Secret: $CHANGELOG_INGEST_SECRET, else the file ~/.xyra-changelog-secret.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APP_REPO = "/Users/shayanshafi/Desktop/CODE BASES/xyrav2-org";
const ENDPOINT = process.env.CHANGELOG_INGEST_URL || "https://xyra.dev/api/changelog/ingest";
const MAX_COMMITS = 60;

// Which paths count for each surface. Shared code rides along with every
// client because both the phone and the web app bundle it (and the functions
// keep Deno twins of it).
const PATHS = {
  web: ["web/", "packages/shared/"],
  phone: ["mobile/", "packages/shared/"],
  functions: ["backend/supabase/functions/", "packages/shared/"],
  database: ["backend/supabase/migrations/"],
  website: [], // the whole repo
};

const AREAS = [
  ["mobile/", "phone"],
  ["web/", "web"],
  ["packages/shared/", "shared"],
  ["backend/supabase/functions/", "functions"],
  ["backend/supabase/migrations/", "database"],
  ["api/", "api"],
];

function done(msg) {
  console.log(`changelog: ${msg}`);
  process.exit(0);
}

function args() {
  const [kind, ...rest] = process.argv.slice(2);
  const o = { kind, vercel: false, detail: null, status: "live", ref: null, repo: null, note: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--vercel") o.vercel = true;
    else if (a === "--detail") o.detail = rest[++i];
    else if (a === "--status") o.status = rest[++i];
    else if (a === "--ref") o.ref = rest[++i];
    else if (a === "--repo") o.repo = rest[++i];
    else if (a === "--note") o.note = rest[++i];
  }
  return o;
}

function secret() {
  if (process.env.CHANGELOG_INGEST_SECRET) return process.env.CHANGELOG_INGEST_SECRET.trim();
  try {
    return readFileSync(join(homedir(), ".xyra-changelog-secret"), "utf8").trim();
  } catch {
    return "";
  }
}

const git = (repo, ...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const tryGit = (repo, ...a) => {
  try {
    return git(repo, ...a);
  } catch {
    return null;
  }
};

function areasFor(files, kind) {
  const set = new Set();
  for (const f of files) {
    const hit = AREAS.find(([p]) => f.startsWith(p));
    if (hit) set.add(hit[1]);
  }
  if (kind === "website" && set.size === 0) set.add("website");
  return [...set];
}

// Commits in prev..HEAD (or the recent tail when prev is unknown here),
// newest first, filtered to the surface's paths.
function commitsSince(repo, prev, kind) {
  const range = prev && tryGit(repo, "cat-file", "-e", `${prev}^{commit}`) !== null ? [`${prev}..HEAD`] : ["-n", "20", "--since=7.days", "HEAD"];
  const paths = PATHS[kind];
  const out = tryGit(repo, "log", "--no-merges", "--full-diff", `--max-count=${MAX_COMMITS}`, "--format=%x1e%H%x1f%cI%x1f%s", "--name-only", ...range, ...(paths.length ? ["--", ...paths] : []));
  if (!out) return [];
  return out
    .split("\x1e")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [head, ...files] = block.split("\n");
      const [sha, at, subject] = head.split("\x1f");
      return { sha: sha.slice(0, 12), at, subject, areas: areasFor(files.filter(Boolean), kind) };
    });
}

async function main() {
  const o = args();
  if (!PATHS[o.kind]) done(`unknown kind "${o.kind}" (web | website | functions | database | phone)`);
  if (o.vercel && process.env.VERCEL_ENV !== "production") done("not a production build, skipped");

  const key = secret();
  if (!key) done("no CHANGELOG_INGEST_SECRET or ~/.xyra-changelog-secret, skipped");
  const headers = { authorization: `Bearer ${key}`, "content-type": "application/json" };

  const repo = o.repo || (o.vercel || o.kind === "website" ? process.cwd() : APP_REPO);
  const sha = (o.vercel && process.env.VERCEL_GIT_COMMIT_SHA) || tryGit(repo, "rev-parse", "HEAD");
  const branch = (o.vercel && process.env.VERCEL_GIT_COMMIT_REF) || tryGit(repo, "rev-parse", "--abbrev-ref", "HEAD");

  let prev = null;
  try {
    const r = await fetch(`${ENDPOINT}?kind=${o.kind}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (r.ok) prev = (await r.json()).sha ?? null;
    else if (r.status === 401) done("ingest secret rejected, skipped");
  } catch {
    /* site unreachable: fall back to the recent tail */
  }
  if (!prev && o.vercel) prev = process.env.VERCEL_GIT_PREVIOUS_SHA || null;

  let commits = commitsSince(repo, prev, o.kind);
  // Vercel clones shallow: when local history can't answer, keep the one commit we know.
  if (commits.length === 0 && o.vercel && process.env.VERCEL_GIT_COMMIT_MESSAGE) {
    commits = [{ sha: (sha || "").slice(0, 12), at: new Date().toISOString(), subject: process.env.VERCEL_GIT_COMMIT_MESSAGE.split("\n")[0], areas: ["website"] }];
  }
  if ((o.kind === "web" || o.kind === "website") && prev && sha && prev.startsWith(sha.slice(0, 12))) done(`${o.kind}: ${sha.slice(0, 7)} already logged`);

  const detail = {};
  if (o.detail) detail[o.kind === "database" ? "migrations" : o.kind === "functions" ? "functions" : "detail"] = o.detail.split(/[\s,]+/).filter(Boolean);
  if (o.vercel && process.env.VERCEL_URL) detail.deployment = process.env.VERCEL_URL;

  const body = {
    kind: o.kind,
    status: o.status,
    sha: sha ? sha.slice(0, 12) : null,
    prev_sha: prev,
    branch,
    ref: o.ref ?? (o.kind === "functions" || o.kind === "database" ? o.detail : null),
    source: o.vercel ? "vercel-build" : "script",
    commits,
    detail,
    note: o.note,
  };

  try {
    const r = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(70_000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) done(`${o.kind}: ingest said ${r.status} ${j.error ?? ""}`);
    done(`${o.kind} logged, ${j.commits} commit${j.commits === 1 ? "" : "s"}${j.summary ? ` — ${j.summary}` : ""}`);
  } catch (e) {
    done(`${o.kind}: could not reach ${ENDPOINT} (${e?.name ?? e})`);
  }
}

main().catch((e) => done(`error ${e?.message ?? e}`));
