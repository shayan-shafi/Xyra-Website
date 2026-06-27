# Instagram Comment → DM Automation — Setup Guide

This guide walks you through everything **you** have to do by hand in Meta,
Supabase, and Vercel to turn on the "Comment ALPHA → get the waitlist DM"
automation. The code is already in the repo; this is the wiring.

> **Read this first:** The system ships with **dry-run mode ON**. Even after you
> finish every step here, it will **not send a single real DM** until you
> explicitly flip the safety switch (last section). You can do the entire setup
> safely.

---

## 0. The big picture (how it works)

1. Someone comments **ALPHA** on your Instagram post / Reel / ad.
2. Instagram sends a "comment" **webhook** (an HTTP POST) to your website at
   `/api/instagram/webhook`.
3. The website verifies it's really from Meta, checks the comment for the word
   ALPHA, records it in Supabase (so it's never handled twice), and — when live —
   sends the commenter a **private reply** (a DM) with your waitlist link.

You are connecting four things: **Instagram account → Meta app → your website
webhook → Supabase log.**

---

## 1. What you need before starting

- [ ] An **Instagram professional account** (Business or Creator). Personal
      accounts will not work.
- [ ] That Instagram account **linked to a Facebook Page** (Instagram → Settings
      → "Linked accounts" / done from the Facebook Page settings).
- [ ] Access to the **Meta Developer dashboard**: <https://developers.facebook.com/>
- [ ] Access to your **Supabase** project and your **Vercel** project.
- [ ] Your production website URL (e.g. `https://xyra.dev`).

---

## 2. Supabase — create the log/dedupe table

1. Open Supabase → your project → **SQL Editor**.
2. Open the repo file `supabase/setup.sql`, copy its contents, paste into the
   SQL Editor, and click **Run**. (It's safe to run multiple times — it only
   adds what's missing.) This creates the `instagram_comment_events` table used
   for logging and de-duplication.
3. Confirm under **Table Editor** that `instagram_comment_events` now exists.

You already have `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` set
from the rest of the site — the webhook reuses those. **The webhook will refuse
to send if the service-role key is missing** (it needs it to dedupe).

---

## 3. Meta — create / configure the app

1. Go to <https://developers.facebook.com/apps/> → **Create App** (or reuse an
   existing one).
2. Choose the **Business** app type when asked.
3. In the app, add the product **Instagram** (look for "Instagram" →
   "Instagram API setup with Facebook Login", or the Instagram Graph API
   product). Add the **Webhooks** product too.
4. Go to **App settings → Basic**. Copy the **App Secret** (click "Show").
   This becomes `INSTAGRAM_APP_SECRET`. **Treat it like a password.**

---

## 4. Meta — permissions your app needs

In **App Review → Permissions and Features** (you'll request these in the App
Review doc), the relevant permissions are:

| Permission | Why |
|---|---|
| `instagram_basic` | Read basic IG account info |
| `instagram_manage_comments` | Read incoming comments (and post public replies) |
| `instagram_manage_messages` | Send the private reply / DM |
| `pages_show_list`, `pages_read_engagement` | Resolve the linked Page/IG account (token-type dependent) |

While your app is in **Development mode**, these work **only for users with a
role on the app** (you and people you add as Testers). Real/public commenters
require **App Review approval + Live mode** — see the App Review doc.

---

## 5. Meta — get your IDs and access token

You need two values:

- **`INSTAGRAM_IG_USER_ID`** — the Instagram professional account's user id.
- **`INSTAGRAM_ACCESS_TOKEN`** — a long-lived token that can read comments and
  send messages for that account.

The simplest path using **Graph API Explorer**
(<https://developers.facebook.com/tools/explorer/>):

1. Select your app top-right.
2. Click **Generate Access Token** and grant the permissions from section 4.
3. Query `GET /me/accounts` to find your **Page** and its id.
4. Query `GET /{page-id}?fields=instagram_business_account` to get the
   **Instagram business account id** → this is `INSTAGRAM_IG_USER_ID`.
5. Exchange your short-lived token for a **long-lived token** (Meta docs:
   "Long-Lived Access Tokens"). Use that as `INSTAGRAM_ACCESS_TOKEN`.

> Tokens expire. Long-lived Page tokens can last ~60 days (or be effectively
> long-lived depending on type). Put a reminder to refresh, or implement
> token refresh later. For alpha, manual refresh is fine.

---

## 6. Invent a verify token

Make up a random string (e.g. from a password manager). This is
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`. You'll type the **same** string into Meta's
webhook config in the next step. It's only used for the one-time handshake.

---

## 7. Put the secrets into Vercel

In **Vercel → your project → Settings → Environment Variables**, add (for
Production, and Preview if you test there):

| Variable | Value |
|---|---|
| `INSTAGRAM_APP_SECRET` | from step 3 |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | the string you invented in step 6 |
| `INSTAGRAM_ACCESS_TOKEN` | from step 5 |
| `INSTAGRAM_IG_USER_ID` | from step 5 |
| `INSTAGRAM_WAITLIST_URL` | e.g. `https://xyra.dev/?utm_source=instagram&utm_medium=social&utm_campaign=alpha` |
| `INSTAGRAM_TRIGGER_KEYWORD` | `ALPHA` (optional, this is the default) |
| **leave `INSTAGRAM_DRY_RUN` UNSET** | so dry-run stays ON |

Full list with explanations: `.env.instagram.example`.

**Redeploy** so the new variables take effect. (Do not deploy until you intend
to — per your instructions, deployment is your call.)

### Per-post attribution (which post drove each signup)

You don't need to do anything extra for this — it's automatic. Whenever a
comment arrives, the system knows which post/Reel/ad it was on (the `media_id`)
and **automatically adds `utm_content=ig_media_<media_id>` to the waitlist link**
in that person's DM.

- Set `INSTAGRAM_WAITLIST_URL` once, with your campaign-wide UTMs (e.g.
  `utm_source=instagram&utm_medium=social&utm_campaign=alpha`). Those are
  **preserved** on every DM.
- The system fills in `utm_content` per post, so two different Reels produce two
  different `utm_content` values and you can see which post converts best in your
  analytics.
- `utm_content` is reserved for this — if you put your own `utm_content` in
  `INSTAGRAM_WAITLIST_URL`, it will be replaced by the per-post value.
- **Privacy:** only the post id is used. The commenter's username and user id are
  **never** put in the URL.

Example: base `https://xyra.dev/?utm_source=instagram&utm_medium=social&utm_campaign=alpha`
→ DM link becomes
`https://xyra.dev/?utm_source=instagram&utm_medium=social&utm_campaign=alpha&utm_content=ig_media_17900000000000000`.

---

## 8. Meta — subscribe the webhook

1. In your Meta app → **Webhooks** (or Instagram → Configure webhooks).
2. Add a callback URL:
   **`https://YOUR-DOMAIN/api/instagram/webhook`**
3. **Verify token:** paste the exact string from step 6.
4. Click **Verify and Save**. Meta calls your URL with a challenge; the route
   echoes it back automatically. If it fails, see Troubleshooting below.
5. Under the **Instagram** object, **Subscribe** to the **`comments`** field.
6. Make sure your IG account is subscribed to the app (the
   `POST /{ig-user-id}/subscribed_apps` step — the dashboard usually handles
   this when you connect the account).

---

## 9. Test in dry-run (still sends nothing)

Follow `docs/instagram-comment-autodm-testing.md`. In short:

- Use the preview endpoint `/api/instagram/test` to confirm keyword matching
  and the DM copy.
- Comment ALPHA from a **tester account** on a post and confirm a row appears in
  `instagram_comment_events` with `reply_status = 'dry_run'`.

---

## 10. Go live (only when you're ready)

1. Complete **App Review** (see `docs/instagram-comment-autodm-app-review.md`)
   and switch the app to **Live mode** — required for public commenters.
2. In Vercel, set `INSTAGRAM_DRY_RUN=false` and **redeploy**.
3. Comment ALPHA from a non-tester account and confirm a real DM arrives and the
   row shows `reply_status = 'sent'`.

To pause instantly at any time: set `INSTAGRAM_DRY_RUN=true` (or delete it) and
redeploy. No code change needed.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Webhook "Verify" fails in Meta | `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in Vercel doesn't match what you typed in Meta; or you didn't redeploy after setting it; or URL typo. |
| Webhook returns 401 "Invalid signature" | `INSTAGRAM_APP_SECRET` wrong/missing in Vercel. |
| Webhook 401 "Webhook not configured" | `INSTAGRAM_APP_SECRET` not set at all. |
| Comments logged but never sent | You're in dry-run (expected!), OR the comment didn't contain the keyword, OR app isn't Live for public users. |
| Nothing logged at all | IG account not subscribed to the `comments` field; or app not subscribed to the account; or the post is too old. |
| `reply_status = 'failed'` | Check `reply_error` in the row — usually a token/permission problem. Re-mint the token (step 5). |
| No dedupe / refuses to send | `SUPABASE_SERVICE_ROLE_KEY` missing — the webhook fails closed without it. |

See also: testing guide and App Review checklist in this folder.
