# Instagram Comment → DM Automation — Testing Guide

How to test the automation **without sending real DMs**. Everything here is safe
to run while dry-run is on (the default). Nothing in this guide sends a real
message unless the final "Live test" section, which you only do deliberately.

---

## Mental model: three layers of safety

1. **Dry-run by default** — real DMs only send when `INSTAGRAM_DRY_RUN` is
   explicitly `false`/`0`/`no`/`off`. Unset = safe.
2. **The preview endpoint never sends**, regardless of the dry-run setting.
3. **Dedupe** — each comment id is recorded once; replays are skipped.

---

## Test 1 — Unit-level preview (local, no Meta needed)

The preview endpoint checks keyword matching and shows the exact DM copy. It
**never** calls Instagram.

1. Run the site locally with your env vars set (at minimum `CRON_SECRET`):
   ```
   npm run dev
   ```
2. Hit the endpoint (replace `SECRET` with your `CRON_SECRET`):

   **Match case:**
   ```
   GET http://localhost:3000/api/instagram/test?secret=SECRET&text=I%20want%20ALPHA
   ```
   Expect `"matched": true` and `messageThatWouldBeSent` containing your
   waitlist URL.

   **Non-match case:**
   ```
   GET http://localhost:3000/api/instagram/test?secret=SECRET&text=alphabet%20soup
   ```
   Expect `"matched": false` (whole-word match: "alphabet" must NOT trigger).

   **POST form:**
   ```bash
   curl -X POST http://localhost:3000/api/instagram/test \
     -H "Authorization: Bearer SECRET" \
     -H "Content-Type: application/json" \
     -d '{"text":"ALPHA!! 🙌"}'
   ```

3. Confirm the response includes `"globalDryRun": true` so you know the live
   webhook would not send.

**What to check:** punctuation/emoji around ALPHA still matches; "alphabet"
does not; the message copy and URL look right.

---

## Test 2 — Webhook handshake (verification)

After you've configured everything in Vercel + Meta (setup guide §7–8):

- In Meta's webhook config, click **Verify and Save**. A success means the
  `GET /api/instagram/webhook` handshake passed (your verify token matched).
- You can also check manually:
  ```
  GET https://YOUR-DOMAIN/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=12345
  ```
  Expect the plain-text body `12345`. A wrong token returns `403 Forbidden`.

---

## Test 3 — End-to-end in DRY-RUN (the important one)

This proves the whole pipeline works **without sending a DM**.

1. Confirm `INSTAGRAM_DRY_RUN` is unset or `true` in Vercel, and the app is
   deployed.
2. From a **tester account** (an account with a role on your Meta app — required
   while in Development mode), comment **ALPHA** on one of your posts/Reels.
3. Within a few seconds, check Supabase → `instagram_comment_events`. You should
   see a new row:
   - `matched_keyword = true`
   - `reply_status = 'dry_run'`
   - `dry_run = true`
   - `commenter_username` populated
4. Check the Vercel function logs for the webhook — you'll see a line like:
   ```
   [ig-webhook][DRY-RUN] Would DM comment=... user=@tester text="Thanks for commenting!..."
   ```
   **No DM is sent.**

Also test a **non-matching** comment (e.g. "nice post") — it should be logged
with `reply_status = 'skipped_no_match'` and nothing sent.

---

## Test 4 — Dedupe

1. Note a comment id already in `instagram_comment_events`.
2. If Meta re-delivers the same comment (or you replay it), the webhook returns
   `200` with that comment marked `"status": "duplicate"` in the response, and
   **no second row** is inserted (the unique `comment_id` constraint blocks it).
3. You should never see two rows with the same `comment_id`, and a matched
   comment is never acted on twice.

---

## Test 5 — Live test (sends a REAL DM — do this deliberately)

> Only after App Review approval + Live mode, and only when you've decided to
> turn it on.

1. Set `INSTAGRAM_DRY_RUN=false` in Vercel and redeploy.
2. From a normal (non-tester) account, comment **ALPHA**.
3. Confirm:
   - A real DM arrives with the waitlist link.
   - The row shows `reply_status = 'sent'`, `dry_run = false`, `replied_at` set.
4. If it shows `reply_status = 'failed'`, read `reply_error` in the row — almost
   always a token/permission issue. Re-mint the token (setup §5).

**To stop immediately:** set `INSTAGRAM_DRY_RUN=true` (or remove it) and
redeploy.

---

## Quick verification checklist

- [ ] Preview endpoint matches ALPHA, rejects "alphabet".
- [ ] Webhook verify handshake succeeds in Meta.
- [ ] Dry-run tester comment → row with `reply_status = 'dry_run'`, no DM.
- [ ] Non-matching comment → `skipped_no_match`, no DM.
- [ ] Re-delivered comment → `duplicate`, no second row.
- [ ] (Live, deliberate) real comment → real DM, `reply_status = 'sent'`.
