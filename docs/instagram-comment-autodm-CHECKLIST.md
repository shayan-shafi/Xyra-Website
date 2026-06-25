# ✅ The "I Have No Idea What I'm Doing" Checklist

Do these in order. Don't skip. Nothing here sends a real DM until the very last
section, and you control that. If a step doesn't make sense, the detailed
explanation is in `instagram-comment-autodm-setup.md`.

> **Golden rule:** the system is in **dry-run** (sends nothing) until *you* set
> `INSTAGRAM_DRY_RUN=false`. You can do every step below and still send zero DMs.

---

## Part A — One-time accounts (do once)

- [ ] My Instagram is a **Professional** account (Business or Creator), not
      personal.
- [ ] My Instagram is **linked to a Facebook Page**.
- [ ] I can log in to **developers.facebook.com**, **Supabase**, and **Vercel**.

## Part B — Database (5 minutes)

- [ ] Open Supabase → **SQL Editor**.
- [ ] Paste the contents of `supabase/setup.sql` → **Run**.
- [ ] In **Table Editor**, I can see a table called `instagram_comment_events`.

## Part C — Meta app (15 minutes)

- [ ] Created (or opened) a **Business** app at developers.facebook.com.
- [ ] Added the **Instagram** product and the **Webhooks** product.
- [ ] Copied my **App Secret** (App settings → Basic).  → I'll call it APP_SECRET
- [ ] Made up a random password-like string. → I'll call it VERIFY_TOKEN
- [ ] Got my **Instagram account id** (IG_USER_ID) and a **long-lived access
      token** (ACCESS_TOKEN) using the Graph API Explorer (setup guide §5).

## Part D — Vercel secrets (10 minutes)

In Vercel → Settings → **Environment Variables**, add:

- [ ] `INSTAGRAM_APP_SECRET` = APP_SECRET
- [ ] `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` = VERIFY_TOKEN
- [ ] `INSTAGRAM_ACCESS_TOKEN` = ACCESS_TOKEN
- [ ] `INSTAGRAM_IG_USER_ID` = IG_USER_ID
- [ ] `INSTAGRAM_WAITLIST_URL` = my waitlist link (e.g. `https://xyra.dev/?utm_source=instagram&utm_medium=social&utm_campaign=alpha`)
- [ ] I did **NOT** add `INSTAGRAM_DRY_RUN` (so it stays safe).
- [ ] (Already there from before: `SUPABASE_SERVICE_ROLE_KEY`,
      `NEXT_PUBLIC_SUPABASE_URL`, `CRON_SECRET`.)
- [ ] **Redeployed** the site so the new variables apply.

## Part E — Connect the webhook (10 minutes)

- [ ] In Meta → Webhooks, set callback URL to
      `https://MY-DOMAIN/api/instagram/webhook`.
- [ ] Pasted VERIFY_TOKEN into the "Verify token" box.
- [ ] Clicked **Verify and Save** → it succeeded (green check).
- [ ] **Subscribed** to the Instagram **`comments`** field.

## Part F — Test safely (no DMs sent)

- [ ] Hit `https://MY-DOMAIN/api/instagram/test?secret=CRON_SECRET&text=ALPHA`
      → response says `"matched": true`.
- [ ] Commented **ALPHA** from a **tester account** on one of my posts.
- [ ] In Supabase → `instagram_comment_events`, a new row appeared with
      `reply_status = dry_run`. **No DM was sent — this is correct.**

➡️ If you got here, the whole pipeline works. The only thing left is going live.

## Part G — App Review (needed for the public)

- [ ] Read `instagram-comment-autodm-app-review.md`.
- [ ] Submitted the 4 permissions with the use-case text + a screencast.
- [ ] Got approved and switched the app to **Live mode**.

## Part H — GO LIVE (this is the one that sends real DMs)

- [ ] In Vercel, set `INSTAGRAM_DRY_RUN` = `false`.
- [ ] **Redeployed.**
- [ ] Commented ALPHA from a normal account → **a real DM arrived** and the row
      says `reply_status = sent`. 🎉

## 🛑 Emergency stop (anytime)

- [ ] Set `INSTAGRAM_DRY_RUN` = `true` (or delete it) → **Redeploy**. Sending
      stops immediately. No code change needed.

---

### Where the answers live
- Step-by-step detail → `instagram-comment-autodm-setup.md`
- How to test → `instagram-comment-autodm-testing.md`
- Meta approval → `instagram-comment-autodm-app-review.md`
- All env vars explained → `.env.instagram.example`
